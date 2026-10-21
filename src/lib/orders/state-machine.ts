import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";
import type { OrderStatus } from "./status";

/**
 * Single source of truth for order status changes.
 *
 *   PENDING_PAYMENT → PLACED | SCHEDULED | FAILED_PAYMENT
 *   SCHEDULED → PLACED (slot − 45 min) | CANCELLED_BY_CUSTOMER
 *   PLACED → ACCEPTED → PREPARING → READY → RIDER_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
 *   PLACED → REJECTED (restaurant, auto-refund)
 *   PLACED…RIDER_ASSIGNED → CANCELLED_BY_CUSTOMER (before ACCEPTED: full refund; after: Food Rescue)
 *   any active → CANCELLED (admin)
 *
 * Every change writes an order_events row (who, when, from, to).
 */
export type Actor = { role: "customer" | "restaurant" | "rider" | "admin" | "system"; id: string | null };

const ACTIVE_BEFORE_PICKUP: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED"];

export const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Actor["role"][]>>> = {
  PENDING_PAYMENT: { PLACED: ["system", "customer"], SCHEDULED: ["system", "customer"], FAILED_PAYMENT: ["system", "customer"] },
  SCHEDULED: { PLACED: ["system", "admin"], CANCELLED_BY_CUSTOMER: ["customer"], CANCELLED: ["admin"] },
  PLACED: { ACCEPTED: ["restaurant", "system", "admin"], REJECTED: ["restaurant", "system", "admin"], CANCELLED_BY_CUSTOMER: ["customer"], CANCELLED: ["admin"] },
  ACCEPTED: { PREPARING: ["restaurant", "system", "admin"], CANCELLED_BY_CUSTOMER: ["customer"], CANCELLED: ["admin"] },
  PREPARING: { READY: ["restaurant", "system", "admin"], CANCELLED_BY_CUSTOMER: ["customer"], CANCELLED: ["admin"] },
  READY: { RIDER_ASSIGNED: ["system", "rider", "admin"], CANCELLED_BY_CUSTOMER: ["customer"], CANCELLED: ["admin"] },
  RIDER_ASSIGNED: { PICKED_UP: ["rider", "system", "admin"], CANCELLED_BY_CUSTOMER: ["customer"], CANCELLED: ["admin"] },
  PICKED_UP: { OUT_FOR_DELIVERY: ["rider", "system", "admin"], CANCELLED: ["admin"] },
  OUT_FOR_DELIVERY: { DELIVERED: ["rider", "system", "admin"], CANCELLED: ["admin"] },
  DELIVERED: {},
  REJECTED: {},
  CANCELLED_BY_CUSTOMER: {},
  CANCELLED: {},
  FAILED_PAYMENT: {},
};

export function canTransition(from: OrderStatus, to: OrderStatus, role: Actor["role"]): boolean {
  return Boolean(TRANSITIONS[from]?.[to]?.includes(role));
}

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

const TIMESTAMP_FOR: Partial<Record<OrderStatus, keyof TablesUpdate<"orders">>> = {
  PLACED: "placed_at",
  ACCEPTED: "accepted_at",
  READY: "ready_at",
  RIDER_ASSIGNED: "rider_assigned_at",
  PICKED_UP: "picked_up_at",
  OUT_FOR_DELIVERY: "out_for_delivery_at",
  DELIVERED: "delivered_at",
  CANCELLED_BY_CUSTOMER: "cancelled_at",
  CANCELLED: "cancelled_at",
  REJECTED: "cancelled_at",
};

/**
 * Move an order to a new status if allowed, atomically (compare-and-set on the current status),
 * record the event and run side effects. Returns the updated order.
 */
export async function transition(
  orderId: string,
  to: OrderStatus,
  actor: Actor,
  opts: { note?: string; patch?: TablesUpdate<"orders">; expectFrom?: OrderStatus[] } = {},
): Promise<Tables<"orders">> {
  const db = getSupabaseAdminClient();
  const { data: order, error } = await db.from("orders").select("*").eq("id", orderId).single();
  if (error || !order) throw new TransitionError("Order not found");
  const from = order.status;
  if (opts.expectFrom && !opts.expectFrom.includes(from)) throw new TransitionError(`Order is ${from}, expected ${opts.expectFrom.join(" or ")}`);
  if (!canTransition(from, to, actor.role)) throw new TransitionError(`Can't move order from ${from} to ${to} as ${actor.role}`);

  const now = new Date().toISOString();
  const tsCol = TIMESTAMP_FOR[to];
  const patch: TablesUpdate<"orders"> = { ...opts.patch, status: to, ...(tsCol ? { [tsCol]: now } : {}) };
  const { data: updated, error: upErr } = await db.from("orders").update(patch).eq("id", orderId).eq("status", from).select("*").maybeSingle();
  if (upErr) throw new TransitionError(upErr.message);
  if (!updated) throw new TransitionError("Order changed while updating. Please refresh.");

  await db.from("order_events").insert({ order_id: orderId, from_status: from, to_status: to, actor_id: actor.id, actor_role: actor.role, note: opts.note ?? null });
  const { runSideEffects } = await import("./side-effects");
  await runSideEffects(updated, from, to, actor);
  return updated;
}

export function isCancellableByCustomer(status: OrderStatus) {
  return status === "SCHEDULED" || ACTIVE_BEFORE_PICKUP.includes(status);
}

/** Before the restaurant accepts, cancellation is free; after, food goes to Food Rescue and there's no refund. */
export function cancellationPolicy(status: OrderStatus): { refund: boolean; message: string } {
  if (status === "PLACED" || status === "SCHEDULED") return { refund: true, message: "You'll get a full refund to your Thaali wallet." };
  return {
    refund: false,
    message: "The restaurant has already started on your order, so this cancellation isn't refundable. The food will be offered nearby at a discount through Food Rescue, so it doesn't go to waste.",
  };
}
