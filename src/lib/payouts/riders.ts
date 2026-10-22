import "server-only";

import { getSupabaseAdminClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import { lastCompleteWeek, type Period } from "./dates";
import type { PayoutRow } from "./index";

/**
 * Rider payouts. The rules live in SQL (public.rider_payout_statement) so the admin console and the
 * weekly cron agree:
 *   earnings  = Σ rider_earnings in the period (trip base + distance pay + tips + incentives)
 *   cash held = COD cash the rider still holds (floating cash) not claimed by another unpaid statement
 *   net       = earnings − cash held ± adjustments   (negative → the rider owes Thaali)
 * Marking a rider statement paid settles the netted cash (recorded as a "PAYOUT-<week>" deposit).
 * Stored on payouts as: order_count = trips, gross_paise = earnings, cash_held_paise, net_paise.
 */

export type RiderTripLine = {
  order_id: string | null;
  order_number: number | null;
  created_at: string;
  kind: string;
  total_paise: number;
  tip_paise: number;
  incentive_paise: number;
  note: string | null;
};

export type RiderPayoutStatement = {
  rider_id: string;
  period_start: string;
  period_end: string;
  trip_count: number;
  earnings_paise: number;
  trip_pay_paise: number;
  tips_paise: number;
  incentives_paise: number;
  other_paise: number;
  cod_collected_paise: number;
  cash_deposited_paise: number;
  floating_cash_paise: number;
  cash_held_paise: number;
  net_before_adjustments_paise: number;
  trips: RiderTripLine[];
};

/** net = earnings − cash held + adjustments (the stored rider net always satisfies this). */
export function riderPayoutNet(p: Pick<PayoutRow, "gross_paise" | "cash_held_paise" | "adjustments_paise">) {
  return p.gross_paise - p.cash_held_paise + p.adjustments_paise;
}

/** Live statement for one rider and period. Service role by default — authorize the caller first. */
export async function computeRiderPayout(riderId: string, periodStart: string, periodEnd: string, db: TypedSupabaseClient = getSupabaseAdminClient()): Promise<RiderPayoutStatement> {
  const { data, error } = await db.rpc("rider_payout_statement", { p_rider: riderId, p_start: periodStart, p_end: periodEnd });
  if (error || !data) throw new Error(error?.message ?? "Couldn't compute the rider payout");
  return data as unknown as RiderPayoutStatement;
}

/** Stores (or refreshes, while unpaid) one rider's statement. Service-role only. */
export async function generateRiderPayout(riderId: string, period: Period): Promise<PayoutRow> {
  const { data, error } = await getSupabaseAdminClient().rpc("generate_rider_payout", { p_rider: riderId, p_start: period.start, p_end: period.end });
  if (error || !data) throw new Error(error?.message ?? "Couldn't generate the rider payout");
  return data;
}

/** Statements for every approved rider for a Mon–Sun period (default: last complete week). Idempotent. */
export async function generateRiderPayouts(period: Period = lastCompleteWeek()): Promise<{ period: Period; payouts: PayoutRow[] }> {
  const db = getSupabaseAdminClient();
  const { data: riders, error } = await db.from("riders").select("id").eq("status", "approved");
  if (error) throw new Error(error.message);
  const payouts: PayoutRow[] = [];
  for (const r of riders ?? []) payouts.push(await generateRiderPayout(r.id, period));
  return { period, payouts };
}
