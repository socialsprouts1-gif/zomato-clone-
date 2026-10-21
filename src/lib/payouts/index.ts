import "server-only";

import { getSupabaseAdminClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { lastCompleteWeek, type Period } from "./dates";

/**
 * Restaurant payouts. The money rules live in SQL (public.payout_statement) so the partner console,
 * the admin console and the weekly cron all agree:
 *   order value = item total + packaging − restaurant-funded offer discount (DELIVERED orders, by delivered_at)
 *   net         = order value − commission − 18% GST on commission + Food Rescue earnings ± adjustments
 * Platform coupons and Gold discounts are funded by Thaali and don't reduce the order value.
 */

export type PayoutRow = Tables<"payouts">;

export type PayoutOrderLine = {
  order_id: string;
  order_number: number;
  delivered_at: string;
  item_total_paise: number;
  packaging_paise: number;
  restaurant_discount_paise: number;
  order_value_paise: number;
  payment_method: string;
};

export type RescueLine = { id: string; items_summary: string; claimed_at: string; rescue_price_paise: number };

export type PayoutStatement = {
  restaurant_id: string;
  period_start: string;
  period_end: string;
  order_count: number;
  gross_paise: number;
  commission_pct: number;
  commission_paise: number;
  gst_pct: number;
  gst_on_commission_paise: number;
  food_rescue_paise: number;
  net_before_adjustments_paise: number;
  orders: PayoutOrderLine[];
  rescue: RescueLine[];
};

/** net = gross − commission − GST + rescue + adjustments (the stored net must always satisfy this). */
export function payoutNet(p: Pick<PayoutRow, "gross_paise" | "commission_paise" | "gst_on_commission_paise" | "food_rescue_paise" | "adjustments_paise">) {
  return p.gross_paise - p.commission_paise - p.gst_on_commission_paise + p.food_rescue_paise + p.adjustments_paise;
}

/**
 * Live statement for one restaurant and period (inclusive IST dates). Defaults to the service-role
 * client — authorize the caller first; pass the user's client to let the database check membership.
 */
export async function computeRestaurantPayout(restaurantId: string, periodStart: string, periodEnd: string, db: TypedSupabaseClient = getSupabaseAdminClient()): Promise<PayoutStatement> {
  const { data, error } = await db.rpc("payout_statement", { rid: restaurantId, p_start: periodStart, p_end: periodEnd });
  if (error || !data) throw new Error(error?.message ?? "Couldn't compute the payout");
  const s = data as unknown as PayoutStatement;
  return { ...s, commission_pct: Number(s.commission_pct), gst_pct: Number(s.gst_pct) };
}

/** Stores (or refreshes, while unpaid) one restaurant's statement. Service-role only. */
export async function generateRestaurantPayout(restaurantId: string, period: Period): Promise<PayoutRow> {
  const { data, error } = await getSupabaseAdminClient().rpc("generate_restaurant_payout", { rid: restaurantId, p_start: period.start, p_end: period.end });
  if (error || !data) throw new Error(error?.message ?? "Couldn't generate the payout");
  return data;
}

/**
 * Generates statements for every approved restaurant for a Mon–Sun period (default: last complete
 * week). Idempotent — re-running refreshes unpaid statements and never touches paid ones.
 */
export async function generatePayouts(period: Period = lastCompleteWeek()): Promise<{ period: Period; payouts: PayoutRow[] }> {
  const db = getSupabaseAdminClient();
  const { data: restaurants, error } = await db.from("restaurants").select("id").eq("status", "approved");
  if (error) throw new Error(error.message);
  const payouts: PayoutRow[] = [];
  for (const r of restaurants ?? []) payouts.push(await generateRestaurantPayout(r.id, period));
  return { period, payouts };
}

/** A restaurant's statements, newest first (RLS-scoped when given the user's client). */
export async function listRestaurantPayouts(restaurantId: string, db: TypedSupabaseClient, limit = 26): Promise<PayoutRow[]> {
  const { data } = await db
    .from("payouts")
    .select("*")
    .eq("payee_type", "restaurant")
    .eq("restaurant_id", restaurantId)
    .order("period_start", { ascending: false })
    .limit(limit);
  return data ?? [];
}
