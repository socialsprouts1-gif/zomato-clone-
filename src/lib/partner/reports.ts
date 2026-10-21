import "server-only";

import { addDays, daysBetween, isIsoDate, todayIst } from "@/lib/payouts/dates";
import type { TypedSupabaseClient } from "@/lib/supabase/server";

/**
 * Partner business reports. Aggregation happens in SQL (public.partner_report), which checks that the
 * caller is on the outlet's team. Definitions:
 *   orders       = orders placed in the range whose payment went through (excludes pending/failed payment)
 *   gross sales  = food value (item total, before discounts; no packaging, taxes or fees) of delivered orders
 *   AOV          = gross sales ÷ delivered orders
 *   rejected     = rejected by the restaurant; rate = rejected ÷ orders
 *   cancelled    = cancelled by the customer or by Thaali
 * Days and hours are in India time.
 */

export const RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Custom" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["key"];
export type ReportRange = { preset: RangePreset; from: string; to: string };

export const MAX_RANGE_DAYS = 366;

/** Reads ?range=today|7d|30d|custom&from=&to= (defaults to the last 7 days). */
export function parseReportRange(params: { range?: string | string[]; from?: string | string[]; to?: string | string[] }, now = new Date()): ReportRange {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const today = todayIst(now);
  const preset = one(params.range);
  if (preset === "today") return { preset, from: today, to: today };
  if (preset === "30d") return { preset, from: addDays(today, -29), to: today };
  if (preset === "custom") {
    let from = one(params.from);
    let to = one(params.to);
    if (isIsoDate(from) && isIsoDate(to)) {
      if (to > today) to = today;
      if (from > to) [from, to] = [to, from];
      if (daysBetween(from, to) > MAX_RANGE_DAYS - 1) from = addDays(to, -(MAX_RANGE_DAYS - 1));
      return { preset, from, to };
    }
  }
  return { preset: "7d", from: addDays(today, -6), to: today };
}

export type ReportKpis = {
  placed: number;
  delivered: number;
  gross_paise: number;
  aov_paise: number;
  rejected: number;
  cancelled: number;
  rejection_rate: number;
};
export type DailyPoint = { day: string; sales_paise: number; orders: number; delivered: number };
export type Funnel = { menu_view: number; add_to_cart: number; checkout_start: number; orders: number };
export type DishStat = { name: string; qty: number; revenue_paise: number };
export type HeatCell = { dow: number; hour: number; orders: number };
export type ReportData = {
  kpis: ReportKpis;
  daily: DailyPoint[];
  funnel: Funnel;
  top_by_qty: DishStat[];
  top_by_revenue: DishStat[];
  heatmap: HeatCell[];
};

export async function loadReport(db: TypedSupabaseClient, restaurantId: string, range: ReportRange): Promise<ReportData> {
  const { data, error } = await db.rpc("partner_report", { rid: restaurantId, p_from: range.from, p_to: range.to });
  if (error || !data) throw new Error(error?.message ?? "Couldn't load the report");
  const r = data as unknown as ReportData;
  return { ...r, kpis: { ...r.kpis, rejection_rate: Number(r.kpis.rejection_rate) } };
}

/** IST day bounds as ISO timestamps: [from 00:00, to+1 00:00). */
export function istBounds(from: string, to: string) {
  return { fromTs: new Date(`${from}T00:00:00+05:30`).toISOString(), toTs: new Date(`${addDays(to, 1)}T00:00:00+05:30`).toISOString() };
}

export const EXPORT_HEADER = ["Order number", "Date", "Status", "Items", "Subtotal (₹)", "Discount (₹)", "Total (₹)", "Payment method"];

export type ExportOrder = {
  order_number: number;
  created_at: string;
  status: string;
  item_total_paise: number;
  discount_paise: number;
  total_paise: number;
  payment_method: string;
  payment_method_detail: string | null;
  order_items: { name: string; quantity: number; variant_name: string | null }[];
};

/** Orders in the range for the CSV export (RLS: the caller's team must own the outlet). */
export async function loadExportOrders(db: TypedSupabaseClient, restaurantId: string, range: ReportRange): Promise<ExportOrder[]> {
  const { fromTs, toTs } = istBounds(range.from, range.to);
  const rows: ExportOrder[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await db
      .from("orders")
      .select("order_number, created_at, status, item_total_paise, discount_paise, total_paise, payment_method, payment_method_detail, order_items(name, quantity, variant_name)")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", fromTs)
      .lt("created_at", toTs)
      .not("status", "in", "(PENDING_PAYMENT,FAILED_PAYMENT)")
      .order("created_at", { ascending: true })
      .range(offset, offset + page - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ExportOrder[]));
    if (!data || data.length < page) break;
  }
  return rows;
}

export function paymentLabel(method: string, detail: string | null) {
  if (method === "cod") return "Cash on delivery";
  if (method === "wallet") return "Thaali wallet";
  return detail ? `Online (${detail.toUpperCase()})` : "Online";
}

export function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
