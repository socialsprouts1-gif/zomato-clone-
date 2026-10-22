"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminAction, assertAdmin } from "@/lib/admin/guard";
import { driveDemoInBackground, startDemoOrder } from "@/lib/admin/demo";
import { getServerEnv, publicEnv } from "@/lib/env";
import { haversineKm } from "@/lib/geo";
import { notify } from "@/lib/notifications";
import { assignRider } from "@/lib/orders/dispatch";
import { paymentMode } from "@/lib/payments/razorpay";
import { amountPaid } from "@/lib/orders/side-effects";
import { canTransition, transition } from "@/lib/orders/state-machine";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { formatPaise } from "@/lib/utils";

type Order = Tables<"orders">;
const uuid = z.string().uuid();
const REASSIGNABLE: OrderStatus[] = ["ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED"];

async function loadOrder(id: string): Promise<Order> {
  const { data } = await getSupabaseAdminClient().from("orders").select("*").eq("id", uuid.parse(id)).maybeSingle();
  if (!data) throw new Error("Order not found");
  return data;
}

/** Online payment part of an order that can go back to the original method. */
function onlinePaid(o: Order) {
  return o.payment_method === "razorpay" && o.razorpay_payment_id && ["paid", "refunded", "partially_refunded"].includes(o.payment_status) ? o.payable_paise : 0;
}

/** Razorpay refund; in demo mode (no keys, or a demo payment id) it is simulated and recorded. */
async function refundToOriginalMethod(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<string> {
  if (paymentMode() === "demo" || paymentId.startsWith("pay_demo")) return `rfnd_demo_${randomBytes(7).toString("hex")}`;
  const auth = Buffer.from(`${publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${getServerEnv().RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, notes }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Razorpay refund failed (${res.status})`);
  return ((await res.json()) as { id: string }).id;
}

/** Claims the order's single refund slot. Returns false if it was already refunded. */
async function claimRefund(o: Order, amount: number, to: "wallet" | "original") {
  const full = amount >= amountPaid(o);
  const { data } = await getSupabaseAdminClient()
    .from("orders")
    .update({ refunded_at: new Date().toISOString(), refund_paise: amount, refund_to: to, payment_status: amount > 0 ? (full ? "refunded" : "partially_refunded") : o.payment_status })
    .eq("id", o.id)
    .is("refunded_at", null)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

async function releaseClaim(o: Order) {
  await getSupabaseAdminClient().from("orders").update({ refunded_at: null, refund_paise: 0, refund_to: null, payment_status: o.payment_status }).eq("id", o.id);
}

async function walletCredit(o: Order, amount: number, reason: string) {
  if (amount <= 0) return;
  const { error } = await getSupabaseAdminClient().rpc("wallet_apply", { p_user: o.customer_id, p_amount: amount, p_type: "refund", p_description: `Refund for order #${o.order_number}: ${reason}`, p_reference: o.id });
  if (error) throw new Error(error.message);
}

async function noteEvent(o: { id: string; status: OrderStatus }, adminId: string, note: string) {
  await getSupabaseAdminClient().from("order_events").insert({ order_id: o.id, from_status: o.status, to_status: o.status, actor_id: adminId, actor_role: "admin", note });
}

/**
 * Moves money back for a claimed refund: the online part to Razorpay (when `to` is original),
 * everything else to the wallet. Returns the provider refund id, if any.
 */
async function payOut(o: Order, amount: number, to: "wallet" | "original", reason: string) {
  if (to === "wallet") {
    await walletCredit(o, amount, reason);
    return null;
  }
  const online = Math.min(amount, onlinePaid(o));
  const refundId = online > 0 ? await refundToOriginalMethod(o.razorpay_payment_id!, online, { order_number: String(o.order_number), reason: reason.slice(0, 200) }) : null;
  await walletCredit(o, amount - online, reason);
  return refundId;
}

const cancelSchema = z.object({ orderId: uuid, reason: z.string().trim().min(3, "Add a reason").max(300), refundTo: z.enum(["wallet", "original"]) });

/** Cancel as support (→ CANCELLED via the state machine) and refund what was paid. */
export async function adminCancelOrder(raw: z.input<typeof cancelSchema>) {
  return adminAction(async (admin) => {
    const input = cancelSchema.parse(raw);
    const o = await loadOrder(input.orderId);
    if (!canTransition(o.status, "CANCELLED", "admin")) throw new Error(`An order that is ${o.status.toLowerCase().replaceAll("_", " ")} can't be cancelled`);
    const paid = amountPaid(o);
    let refundId: string | null = null;
    let refunded = 0;

    if (input.refundTo === "original") {
      if (!onlinePaid(o)) throw new Error("This order wasn't paid online. Refund to the wallet instead.");
      if (!(await claimRefund(o, paid, "original"))) throw new Error("This order has already been refunded");
      try {
        await transition(o.id, "CANCELLED", { role: "admin", id: admin.id }, { patch: { cancel_reason: input.reason }, note: `Cancelled by support: ${input.reason}` });
      } catch (e) {
        await releaseClaim(o);
        throw e;
      }
      try {
        refundId = await payOut(o, paid, "original", "cancelled by support");
        refunded = paid;
      } catch (e) {
        await releaseClaim({ ...o, status: "CANCELLED" });
        throw new Error(`Order cancelled, but the refund failed (${e instanceof Error ? e.message : "provider error"}). Use Refund to try again.`);
      }
    } else {
      // The CANCELLED side effect refunds everything paid to the wallet, at most once.
      const already = Boolean(o.refunded_at);
      await transition(o.id, "CANCELLED", { role: "admin", id: admin.id }, { patch: { cancel_reason: input.reason }, note: `Cancelled by support: ${input.reason}` });
      refunded = already ? 0 : paid;
    }
    if (refunded > 0) {
      await noteEvent({ id: o.id, status: "CANCELLED" }, admin.id, `Refund ${formatPaise(refunded)} to ${input.refundTo === "original" ? "original payment method" : "Thaali wallet"}${refundId ? ` (${refundId})` : ""}`);
    }
    return {
      data: { refunded },
      audit: { action: "order.cancel", entityType: "order", entityId: o.id, details: { order_number: o.order_number, from: o.status, reason: input.reason, refund_to: input.refundTo, refund_paise: refunded, refund_id: refundId } },
    };
  }, ["/admin", "/admin/orders", `/admin/orders/${raw.orderId}`]);
}

const refundSchema = z.object({ orderId: uuid, amountPaise: z.number().int().positive("Enter an amount"), refundTo: z.enum(["wallet", "original"]), reason: z.string().trim().min(3, "Add a reason").max(300) });

/** Full or partial refund of a finished order. One refund per order. */
export async function adminRefundOrder(raw: z.input<typeof refundSchema>) {
  return adminAction(async (admin) => {
    const input = refundSchema.parse(raw);
    const o = await loadOrder(input.orderId);
    if (ACTIVE_STATUSES.includes(o.status) || o.status === "SCHEDULED") throw new Error("This order is still in progress. Cancel it instead.");
    if (o.refunded_at) throw new Error("This order has already been refunded");
    const paid = amountPaid(o);
    if (paid <= 0) throw new Error("Nothing was paid for this order");
    if (input.amountPaise > paid) throw new Error(`You can refund up to ${formatPaise(paid)}`);
    if (input.refundTo === "original" && !onlinePaid(o)) throw new Error("This order wasn't paid online. Refund to the wallet instead.");
    if (!(await claimRefund(o, input.amountPaise, input.refundTo))) throw new Error("This order has already been refunded");
    let refundId: string | null;
    try {
      refundId = await payOut(o, input.amountPaise, input.refundTo, input.reason);
    } catch (e) {
      await releaseClaim(o);
      throw e;
    }
    const where = input.refundTo === "original" ? "your original payment method" : "your Thaali wallet";
    await noteEvent(o, admin.id, `Refund ${formatPaise(input.amountPaise)} to ${input.refundTo === "original" ? "original payment method" : "Thaali wallet"}: ${input.reason}${refundId ? ` (${refundId})` : ""}`);
    await notify(o.customer_id, { title: "Refund processed", body: `${formatPaise(input.amountPaise)} for order #${o.order_number} is on its way to ${where}.`, link: input.refundTo === "wallet" ? "/account/wallet" : `/orders/${o.id}`, type: "order" });
    return {
      data: { refunded: input.amountPaise },
      audit: { action: "order.refund", entityType: "order", entityId: o.id, details: { order_number: o.order_number, amount_paise: input.amountPaise, refund_to: input.refundTo, reason: input.reason, refund_id: refundId } },
    };
  }, ["/admin/orders", `/admin/orders/${raw.orderId}`]);
}

export type RiderOption = { id: string; name: string; vehicle: string; simulated: boolean; distanceKm: number | null };

/** Online, approved riders free to take the order, nearest to the restaurant first. */
export async function listRiderOptions(orderId: string): Promise<RiderOption[]> {
  await assertAdmin();
  const db = getSupabaseAdminClient();
  const o = await loadOrder(orderId);
  const [{ data: r }, { data: riders }] = await Promise.all([
    db.from("restaurants").select("lat, lng").eq("id", o.restaurant_id).single(),
    db.from("riders").select("id, name, vehicle_type, is_simulated, current_lat, current_lng, current_order_id").eq("status", "approved").eq("is_online", true).is("current_order_id", null),
  ]);
  return (riders ?? [])
    .filter((x) => x.id !== o.rider_id)
    .map((x) => ({
      id: x.id,
      name: x.name,
      vehicle: x.vehicle_type,
      simulated: x.is_simulated,
      distanceKm: r && x.current_lat !== null && x.current_lng !== null ? Number(haversineKm(r.lat, r.lng, x.current_lat, x.current_lng).toFixed(1)) : null,
    }))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

const reassignSchema = z.object({ orderId: uuid, riderId: uuid });

/** Give the order to another online rider (before pickup). Status doesn't change, so no transition is needed. */
export async function adminReassignRider(raw: z.input<typeof reassignSchema>) {
  return adminAction(async (admin) => {
    const input = reassignSchema.parse(raw);
    const db = getSupabaseAdminClient();
    const o = await loadOrder(input.orderId);
    if (!REASSIGNABLE.includes(o.status)) throw new Error("Riders can be changed only before pickup");
    if (o.rider_id === input.riderId) throw new Error("That rider already has this order");
    const { data: rider } = await db.from("riders").select("id, name, status, is_online, current_order_id, current_lat, current_lng").eq("id", input.riderId).maybeSingle();
    if (!rider || rider.status !== "approved" || !rider.is_online) throw new Error("That rider isn't online");
    if (rider.current_order_id) throw new Error(`${rider.name} is already on a delivery`);

    let previous: { id: string; name: string } | null = null;
    if (!o.rider_id) {
      const claimed = await assignRider(o.id, rider.id, "Assigned by support");
      if (!claimed) throw new Error("Order changed while assigning. Please refresh.");
    } else {
      const { data: old } = await db.from("riders").select("id, name").eq("id", o.rider_id).maybeSingle();
      previous = old ?? { id: o.rider_id, name: "previous rider" };
      const { data: claimed } = await db
        .from("orders")
        .update({ rider_id: rider.id, rider_assigned_at: new Date().toISOString(), rider_at_restaurant_at: null })
        .eq("id", o.id)
        .eq("rider_id", o.rider_id)
        .in("status", REASSIGNABLE)
        .select("id")
        .maybeSingle();
      if (!claimed) throw new Error("Order changed while reassigning. Please refresh.");
      await db.from("riders").update({ current_order_id: null }).eq("id", o.rider_id).eq("current_order_id", o.id);
      await db.from("riders").update({ current_order_id: o.id }).eq("id", rider.id);
      if (rider.current_lat !== null && rider.current_lng !== null) await db.from("rider_locations").insert({ rider_id: rider.id, order_id: o.id, lat: rider.current_lat, lng: rider.current_lng });
      await db.from("rider_offers").update({ status: "expired" }).eq("order_id", o.id).eq("status", "pending");
      await noteEvent(o, admin.id, `Rider reassigned by support: ${previous.name} → ${rider.name}`);
      await notify(previous.id, { title: `Order #${o.order_number} was reassigned`, body: "Support moved this delivery to another rider. You're free to take new orders.", link: "/rider", type: "rider" });
      await notify(o.customer_id, { title: "New delivery partner", body: `${rider.name} will deliver your order.`, link: `/orders/${o.id}`, type: "order" });
    }
    await notify(rider.id, { title: `Order #${o.order_number} assigned to you`, body: "Support assigned you this delivery. Head to the restaurant.", link: "/rider", type: "rider" });
    return {
      data: { riderName: rider.name },
      audit: { action: "order.reassign_rider", entityType: "order", entityId: o.id, details: { order_number: o.order_number, from_rider: previous?.name ?? null, from_rider_id: previous?.id ?? null, to_rider: rider.name, to_rider_id: rider.id } },
    };
  }, ["/admin", `/admin/orders/${raw.orderId}`]);
}

/** "Run full demo": places the demo order and returns its id (or the one already running). */
export async function runFullDemo() {
  return adminAction(async () => {
    const { orderId, resumed } = await startDemoOrder();
    driveDemoInBackground(orderId);
    return { data: { orderId, resumed }, audit: resumed ? undefined : { action: "demo.run", entityType: "order", entityId: orderId, details: { customer: "customer@demo.in", restaurant: "saffron-courtyard", payment: "cod" } } };
  }, ["/admin"]);
}
