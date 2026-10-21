import type { Enums } from "@/lib/supabase/database.types";

export type OrderStatus = Enums<"order_status">;

/** Customer-facing label and tone for each status. */
export const statusMeta: Record<OrderStatus, { label: string; tone: "live" | "done" | "bad" | "wait" }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "wait" },
  SCHEDULED: { label: "Scheduled", tone: "wait" },
  PLACED: { label: "Order placed", tone: "live" },
  ACCEPTED: { label: "Restaurant accepted", tone: "live" },
  PREPARING: { label: "Preparing", tone: "live" },
  READY: { label: "Food ready", tone: "live" },
  RIDER_ASSIGNED: { label: "Rider assigned", tone: "live" },
  PICKED_UP: { label: "Picked up", tone: "live" },
  OUT_FOR_DELIVERY: { label: "On the way", tone: "live" },
  DELIVERED: { label: "Delivered", tone: "done" },
  REJECTED: { label: "Rejected by restaurant", tone: "bad" },
  CANCELLED_BY_CUSTOMER: { label: "Cancelled", tone: "bad" },
  CANCELLED: { label: "Cancelled", tone: "bad" },
  FAILED_PAYMENT: { label: "Payment failed", tone: "bad" },
};

export const ACTIVE_STATUSES: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"];

export function isActive(status: OrderStatus) {
  return ACTIVE_STATUSES.includes(status);
}
