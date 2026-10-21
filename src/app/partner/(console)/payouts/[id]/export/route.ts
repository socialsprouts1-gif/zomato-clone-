import { NextResponse, type NextRequest } from "next/server";
import { getPartnerContext } from "@/lib/partner/context";
import { paymentLabel } from "@/lib/partner/reports";
import { computeRestaurantPayout } from "@/lib/payouts";
import { csvResponse, rupees, toCsv } from "@/lib/payouts/csv";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** GET /partner/payouts/:id/export → statement summary + included orders as CSV. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getPartnerContext("/partner/payouts");
  const db = await getSupabaseServerClient();
  // RLS: only the restaurant's team (or an admin) can read the statement.
  const { data: p } = await db.from("payouts").select("*, restaurants(name, slug)").eq("id", id).eq("payee_type", "restaurant").maybeSingle();
  if (!p?.restaurant_id) return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  const s = await computeRestaurantPayout(p.restaurant_id, p.period_start, p.period_end, db);
  const summary: [string, number][] = [
    ["Order value", p.gross_paise],
    [`Commission (${s.commission_pct}%)`, -p.commission_paise],
    [`GST on commission (${s.gst_pct}%)`, -p.gst_on_commission_paise],
    ["Food Rescue earnings", p.food_rescue_paise],
    ["Adjustments", p.adjustments_paise],
    ["Net payout", p.net_paise],
  ];
  const lines = [
    toCsv(["Statement", "Restaurant", "Period start", "Period end", "Status"], [[p.id, p.restaurants?.name ?? "", p.period_start, p.period_end, p.status]]),
    toCsv(["Line", "Amount (₹)"], summary.map(([k, v]) => [k, rupees(v)])),
    toCsv(
      ["Order number", "Delivered at", "Item total (₹)", "Packaging (₹)", "Your offer discount (₹)", "Order value (₹)", "Payment method"],
      s.orders.map((o) => [
        o.order_number,
        new Date(o.delivered_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
        rupees(o.item_total_paise),
        rupees(o.packaging_paise),
        rupees(o.restaurant_discount_paise),
        rupees(o.order_value_paise),
        paymentLabel(o.payment_method, null),
      ]),
    ),
  ];
  if (s.rescue.length) lines.push(toCsv(["Food Rescue listing", "Claimed at", "Rescue price (₹)"], s.rescue.map((r) => [r.items_summary, new Date(r.claimed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), rupees(r.rescue_price_paise)])));
  return csvResponse(lines.join("\r\n"), `${p.restaurants?.slug ?? "payout"}-statement-${p.period_start}.csv`);
}
