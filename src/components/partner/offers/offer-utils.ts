import type { Tables } from "@/lib/supabase/database.types";
import { formatPaise } from "@/lib/utils";

export type Offer = Tables<"restaurant_offers">;
export type OfferStatus = "active" | "scheduled" | "expired" | "paused";

export function offerStatus(o: Pick<Offer, "is_active" | "valid_from" | "valid_until">, now = new Date()): OfferStatus {
  if (o.valid_until && new Date(o.valid_until) < now) return "expired";
  if (!o.is_active) return "paused";
  if (new Date(o.valid_from) > now) return "scheduled";
  return "active";
}

/** One-line description of what the customer gets, e.g. "20% off up to ₹150 · on orders above ₹299". */
export function offerSummary(o: Offer, dishName: (id: string | null) => string | undefined) {
  const what =
    o.discount_type === "percent"
      ? `${o.discount_value}% off${o.max_discount_paise ? ` up to ${formatPaise(o.max_discount_paise)}` : ""}`
      : o.discount_type === "flat"
        ? `${formatPaise(o.discount_value)} off`
        : o.discount_type === "free_delivery"
          ? "Free delivery"
          : o.discount_type === "bogo"
            ? `Buy 1 get 1 on ${dishName(o.bogo_item_id) ?? "a dish"}`
            : `Free ${dishName(o.free_item_id) ?? "dish"}`;
  const min = o.min_order_paise ? ` · on orders above ${formatPaise(o.min_order_paise)}` : "";
  return what + min;
}

/** YYYY-MM-DD of a timestamp in IST, for date inputs. */
export function istDate(ts: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ts));
}

export function shortDate(ts: string | Date) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
