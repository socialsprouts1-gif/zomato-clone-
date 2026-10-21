"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createProviderOrder, paymentMode, type PaymentIntent } from "@/lib/payments/razorpay";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { finalizePaidOrder } from "./finalize";
import { computeQuote } from "./pricing";
import { quoteInputSchema, type QuoteInput } from "./types";

export async function getQuote(input: QuoteInput) {
  const user = await getSessionUser();
  try {
    return { ok: true as const, quote: await computeQuote(input, user?.id ?? null) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Couldn't price your cart" };
  }
}

const placeSchema = quoteInputSchema.extend({
  addressId: z.string().uuid(),
  cookingInstructions: z.string().trim().max(300).optional(),
  noCutlery: z.boolean().default(false),
  deliveryInstructions: z.object({ avoidCalling: z.boolean(), leaveAtDoor: z.boolean(), directions: z.string().trim().max(200) }).partial().default({}),
  groupCartId: z.string().uuid().nullable().optional(),
  source: z.enum(["app", "group", "reorder"]).default("app"),
});
export type PlaceOrderInput = z.input<typeof placeSchema>;

export type PlaceOrderResult =
  | { ok: true; orderId: string; next: "done" }
  | { ok: true; orderId: string; next: "pay"; intent: PaymentIntent }
  | { ok: false; error: string; errors?: string[] };

export async function placeOrder(raw: PlaceOrderInput): Promise<PlaceOrderResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in to place your order." };
  if (user.profile.is_blocked) return { ok: false, error: "Your account is blocked." };
  const parsed = placeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order" };
  const input = parsed.data;

  if (input.scheduledFor) {
    const t = new Date(input.scheduledFor).getTime();
    const now = Date.now();
    if (t < now + 2 * 3600000 - 5 * 60000 || t > now + 48 * 3600000) return { ok: false, error: "Scheduled orders can be placed from 2 hours to 2 days ahead." };
  }

  const db = getSupabaseAdminClient();
  // Funnel event for partner reports; logged on every attempt, so checkouts >= orders.
  await db.from("analytics_events").insert({ restaurant_id: input.restaurantId, user_id: user.id, event: "checkout_start" });
  const { data: address } = await db.from("addresses").select("*").eq("id", input.addressId).single();
  if (!address || address.user_id !== user.id) return { ok: false, error: "Choose a delivery address." };

  const quote = await computeQuote(input, user.id);
  if (!quote.ok) return { ok: false, error: quote.errors[0] ?? "Please review your cart", errors: quote.errors };
  if (input.couponCode && !quote.coupon.applied) return { ok: false, error: quote.coupon.message ?? "Coupon not applicable" };

  const b = quote.bill;
  const method = b.payable_paise === 0 ? "wallet" : input.paymentMethod === "cod" ? "cod" : "razorpay";
  const { data: order, error } = await db
    .from("orders")
    .insert({
      customer_id: user.id,
      restaurant_id: input.restaurantId,
      address_id: address.id,
      status: "PENDING_PAYMENT",
      source: input.groupCartId ? "group" : input.source,
      customer_name: user.profile.name,
      customer_phone: user.profile.phone,
      delivery_address: { label: address.custom_label || address.label, line1: [address.flat, address.line1].filter(Boolean).join(", "), landmark: address.landmark, area: address.area, lat: address.lat, lng: address.lng },
      delivery_instructions: { ...input.deliveryInstructions, ...(address.instructions && !input.deliveryInstructions.directions ? { directions: address.instructions } : {}) },
      cooking_instructions: input.cookingInstructions || null,
      no_cutlery: input.noCutlery,
      distance_km: Number(quote.distanceKm.toFixed(2)),
      eta_minutes: quote.etaMinutes,
      scheduled_for: input.scheduledFor ?? null,
      item_total_paise: b.item_total_paise,
      delivery_fee_paise: b.delivery_fee_paise,
      platform_fee_paise: b.platform_fee_paise,
      packaging_fee_paise: b.packaging_fee_paise,
      gst_paise: b.gst_paise,
      tip_paise: b.tip_paise,
      discount_paise: b.discount_paise,
      donation_paise: b.donation_paise,
      total_paise: b.total_paise,
      wallet_used_paise: b.wallet_used_paise,
      payable_paise: b.payable_paise,
      gold_savings_paise: b.gold_savings_paise,
      coupon_code: b.coupon_code,
      coupon_id: quote.coupon.couponId,
      restaurant_offer_id: quote.coupon.offerId,
      payment_method: method,
      payment_method_detail: method === "razorpay" ? (input.paymentMethod === "wallet_app" ? "wallet" : input.paymentMethod) : null,
      payment_status: "pending",
      group_cart_id: input.groupCartId ?? null,
      is_gold_order: quote.isGold,
    })
    .select("*")
    .single();
  if (error || !order) return { ok: false, error: error?.message ?? "Couldn't create the order" };

  const { error: itemsError } = await db.from("order_items").insert(
    quote.lines.map((l) => ({
      order_id: order.id,
      menu_item_id: l.itemId,
      name: l.free ? `${l.name} (free)` : l.name,
      variant_id: l.variantId,
      variant_name: l.variantName,
      addons: l.addons,
      quantity: l.qty,
      unit_price_paise: l.unitPaise,
      total_paise: l.totalPaise,
      is_veg: l.isVeg,
      added_by_name: l.addedByName ?? null,
    })),
  );
  if (itemsError) {
    await db.from("orders").delete().eq("id", order.id);
    return { ok: false, error: `Couldn't save your items (${itemsError.message}). Please try again.` };
  }
  await db.from("order_events").insert({ order_id: order.id, from_status: null, to_status: "PENDING_PAYMENT", actor_id: user.id, actor_role: "customer", note: `Checkout · ${method}` });

  if (method === "wallet" || method === "cod") {
    try {
      await finalizePaidOrder(order.id, null, { cod: method === "cod" });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't place the order" };
    }
    return { ok: true, orderId: order.id, next: "done" };
  }

  try {
    const providerOrderId = await createProviderOrder({ purpose: "order", referenceId: order.id, amountPaise: b.payable_paise, receipt: `order_${order.order_number}` });
    await db.from("orders").update({ razorpay_order_id: providerOrderId }).eq("id", order.id);
    const methodMap = { upi: "upi", card: "card", netbanking: "netbanking", wallet_app: "wallet", cod: undefined } as const;
    return {
      ok: true,
      orderId: order.id,
      next: "pay",
      intent: {
        mode: paymentMode(),
        purpose: "order",
        referenceId: order.id,
        providerOrderId,
        amountPaise: b.payable_paise,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        description: `Order #${order.order_number}`,
        prefill: { name: user.profile.name ?? undefined, email: user.profile.email ?? user.email ?? undefined, contact: user.profile.phone ?? undefined },
        method: methodMap[input.paymentMethod],
      },
    };
  } catch (e) {
    await db.from("orders").update({ payment_status: "failed", status: "FAILED_PAYMENT" }).eq("id", order.id);
    return { ok: false, error: e instanceof Error ? e.message : "Payment provider error" };
  }
}

/** Saved addresses + wallet for the cart page. */
export async function getCheckoutContext() {
  const user = await getSessionUser();
  if (!user) return { loggedIn: false as const };
  const db = getSupabaseAdminClient();
  const [{ data: addresses }, { data: wallet }] = await Promise.all([
    db.from("addresses").select("id, label, custom_label, flat, line1, landmark, lat, lng, is_default").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    db.from("wallets").select("balance_paise").eq("user_id", user.id).maybeSingle(),
  ]);
  return { loggedIn: true as const, addresses: addresses ?? [], walletBalancePaise: wallet?.balance_paise ?? 0, name: user.profile.name };
}
