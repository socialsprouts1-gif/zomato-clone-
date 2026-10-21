import "server-only";

import { transition } from "@/lib/orders/state-machine";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

type Order = Tables<"orders">;

/** Coupon usage, stock, donation and funnel event — once per order, when payment is secured. */
async function recordPlacement(o: Order) {
  const db = getSupabaseAdminClient();
  if (o.coupon_id || o.restaurant_offer_id) {
    await db.from("coupon_redemptions").insert({ coupon_id: o.coupon_id, restaurant_offer_id: o.restaurant_offer_id, order_id: o.id, user_id: o.customer_id, discount_paise: o.discount_paise });
    if (o.coupon_id) {
      const { data: c } = await db.from("coupons").select("used_count").eq("id", o.coupon_id).single();
      if (c) await db.from("coupons").update({ used_count: c.used_count + 1 }).eq("id", o.coupon_id);
    }
  }
  const { data: items } = await db.from("order_items").select("menu_item_id, quantity").eq("order_id", o.id);
  for (const it of items ?? []) {
    if (!it.menu_item_id) continue;
    const { data: m } = await db.from("menu_items").select("stock_qty").eq("id", it.menu_item_id).single();
    if (m?.stock_qty !== null && m?.stock_qty !== undefined) await db.from("menu_items").update({ stock_qty: Math.max(0, m.stock_qty - it.quantity) }).eq("id", it.menu_item_id);
  }
  if (o.donation_paise > 0) await db.from("donations").insert({ user_id: o.customer_id, order_id: o.id, amount_paise: o.donation_paise });
  await db.from("analytics_events").insert({ restaurant_id: o.restaurant_id, user_id: o.customer_id, event: "order_placed" });
  if (o.group_cart_id) await db.from("carts").update({ status: "checked_out", order_id: o.id }).eq("id", o.group_cart_id);
}

/** Deduct the wallet share (if any) and move the order into the kitchen queue. Idempotent. */
export async function finalizePaidOrder(orderId: string, paymentId: string | null, opts: { cod?: boolean } = {}) {
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!o || o.status !== "PENDING_PAYMENT") return o;
  if (o.wallet_used_paise > 0) {
    const { error } = await db.rpc("wallet_apply", { p_user: o.customer_id, p_amount: -o.wallet_used_paise, p_type: "order_payment", p_description: `Order #${o.order_number}`, p_reference: o.id });
    if (error) {
      await markOrderPaymentFailed(orderId, "Not enough wallet balance");
      throw new Error("Not enough wallet balance");
    }
  }
  const paymentStatus = opts.cod ? "cod_pending" : "paid";
  await db.from("orders").update({ payment_status: paymentStatus, razorpay_payment_id: paymentId }).eq("id", orderId);
  await recordPlacement(o);
  return transition(orderId, o.scheduled_for ? "SCHEDULED" : "PLACED", { role: "system", id: null }, { note: opts.cod ? "Cash on delivery" : paymentId ? `Payment ${paymentId}` : "Paid from wallet" });
}

export async function markOrderPaymentFailed(orderId: string, reason: string) {
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("status").eq("id", orderId).single();
  if (!o || o.status !== "PENDING_PAYMENT") return;
  await db.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
  await transition(orderId, "FAILED_PAYMENT", { role: "system", id: null }, { note: reason });
}

/** SCHEDULED orders become PLACED 45 minutes before their slot. Called by the cron route and opportunistically. */
export async function promoteDueScheduledOrders() {
  const db = getSupabaseAdminClient();
  const cutoff = new Date(Date.now() + 45 * 60000).toISOString();
  const { data } = await db.from("orders").select("id").eq("status", "SCHEDULED").lte("scheduled_for", cutoff).limit(50);
  let promoted = 0;
  for (const o of data ?? []) {
    try {
      await transition(o.id, "PLACED", { role: "system", id: null }, { note: "Scheduled slot is coming up" });
      promoted++;
    } catch {
      // another worker got it first
    }
  }
  return promoted;
}
