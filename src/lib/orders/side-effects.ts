import "server-only";

import { notify, notifyRestaurantTeam } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { Actor } from "./state-machine";
import { statusMeta, type OrderStatus } from "./status";

type Order = Tables<"orders">;

const CUSTOMER_COPY: Partial<Record<OrderStatus, (o: Order) => string>> = {
  PLACED: () => "We've sent your order to the restaurant.",
  SCHEDULED: (o) => `Scheduled for ${new Date(o.scheduled_for ?? Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`,
  ACCEPTED: (o) => `The restaurant accepted your order and will have it ready in about ${o.prep_minutes ?? 20} minutes.`,
  READY: () => "Your food is packed and ready.",
  RIDER_ASSIGNED: () => "A delivery partner is on the way to the restaurant.",
  PICKED_UP: () => "Your order has been picked up.",
  OUT_FOR_DELIVERY: (o) => `On the way! Share OTP ${o.delivery_otp} with the rider at your door.`,
  DELIVERED: () => "Delivered. Enjoy your meal! Tap to rate your order.",
  REJECTED: (o) => `The restaurant couldn't take your order${o.reject_reason ? ` (${o.reject_reason})` : ""}. A full refund is on its way to your wallet.`,
  CANCELLED: () => "Your order was cancelled by support. Any amount paid has been refunded.",
  CANCELLED_BY_CUSTOMER: () => "Your order has been cancelled.",
  FAILED_PAYMENT: () => "Payment didn't go through, so the order wasn't placed. No money was taken.",
};

/** Money that actually reached us for this order (online payment + wallet). */
export function amountPaid(o: Order) {
  const online = o.payment_method === "razorpay" && o.payment_status === "paid" ? o.payable_paise : 0;
  const cod = o.payment_status === "cod_collected" ? o.payable_paise : 0;
  return online + cod + o.wallet_used_paise;
}

/** Refunds at most once per order: the refund is claimed (refunded_at is null → now) before money moves. */
export async function refundToWallet(o: Order, reason: string, amount = amountPaid(o)) {
  const db = getSupabaseAdminClient();
  const { data: claimed } = await db
    .from("orders")
    .update({ refund_paise: amount, refund_to: "wallet", refunded_at: new Date().toISOString(), payment_status: amount > 0 ? "refunded" : o.payment_status })
    .eq("id", o.id)
    .is("refunded_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return false;
  if (amount > 0) {
    await db.rpc("wallet_apply", { p_user: o.customer_id, p_amount: amount, p_type: "refund", p_description: `Refund for order #${o.order_number}: ${reason}`, p_reference: o.id });
  }
  return true;
}

async function restock(orderId: string) {
  const db = getSupabaseAdminClient();
  const { data: items } = await db.from("order_items").select("menu_item_id, quantity").eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.menu_item_id) continue;
    const { data: m } = await db.from("menu_items").select("stock_qty").eq("id", it.menu_item_id).single();
    if (m?.stock_qty !== null && m?.stock_qty !== undefined) await db.from("menu_items").update({ stock_qty: m.stock_qty + it.quantity }).eq("id", it.menu_item_id);
  }
}

/** Runs after every status change. Each branch is idempotent enough to be retried safely. */
export async function runSideEffects(o: Order, from: OrderStatus, to: OrderStatus, actor: Actor) {
  const db = getSupabaseAdminClient();
  const copy = CUSTOMER_COPY[to];
  if (copy) await notify(o.customer_id, { title: statusMeta[to].label, body: copy(o), link: `/orders/${o.id}`, type: "order" });

  switch (to) {
    case "PLACED": {
      await notifyRestaurantTeam(o.restaurant_id, { title: `New order #${o.order_number}`, body: `${o.customer_name ?? "A customer"} · ₹${Math.round(o.total_paise / 100)}`, link: "/partner" });
      const { data: r } = await db.from("restaurants").select("auto_accept, avg_prep_minutes").eq("id", o.restaurant_id).single();
      if (r?.auto_accept) {
        const { acceptOrder } = await import("./actions-core");
        await acceptOrder(o.id, r.avg_prep_minutes, { role: "system", id: null }, "Auto-accepted");
      }
      break;
    }
    case "ACCEPTED": {
      const { onOrderAccepted } = await import("./dispatch");
      await onOrderAccepted(o);
      break;
    }
    case "READY": {
      // A rider may already be assigned (dispatched at acceptance): move straight on.
      if (o.rider_id) {
        const { transition } = await import("./state-machine");
        await transition(o.id, "RIDER_ASSIGNED", { role: "system", id: null }, { note: "Rider already assigned" });
      }
      break;
    }
    case "REJECTED":
    case "CANCELLED": {
      await refundToWallet(o, to === "REJECTED" ? "rejected by restaurant" : "cancelled by support");
      await restock(o.id);
      await releaseRider(o);
      break;
    }
    case "CANCELLED_BY_CUSTOMER": {
      if (from === "PLACED" || from === "SCHEDULED") {
        await refundToWallet(o, "cancelled before the restaurant accepted");
        await restock(o.id);
      } else {
        const { listForFoodRescue } = await import("./food-rescue");
        await listForFoodRescue(o);
      }
      await releaseRider(o);
      await notifyRestaurantTeam(o.restaurant_id, { title: `Order #${o.order_number} was cancelled`, body: from === "PLACED" ? "Cancelled before you accepted." : "Moved to Food Rescue. You'll still be paid.", link: "/partner" });
      break;
    }
    case "DELIVERED": {
      const { onDelivered } = await import("./dispatch");
      await onDelivered(o);
      break;
    }
    default:
      break;
  }
  void actor;
}

async function releaseRider(o: Order) {
  if (!o.rider_id) return;
  const db = getSupabaseAdminClient();
  await db.from("riders").update({ current_order_id: null }).eq("id", o.rider_id).eq("current_order_id", o.id);
  await notify(o.rider_id, { title: `Order #${o.order_number} was cancelled`, body: "You're free to take new orders.", link: "/rider", type: "rider" });
}
