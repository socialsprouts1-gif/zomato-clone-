import { NextResponse, type NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { csvResponse, rupees, toCsv } from "@/lib/payouts/csv";
import { isIsoDate, weekOf } from "@/lib/payouts/dates";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/** GET /admin/payouts/export?week=YYYY-MM-DD[&type=&status=] → that week's statements as CSV (admins only). */
export async function GET(req: NextRequest) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const weekParam = sp.get("week");
  if (!isIsoDate(weekParam)) return NextResponse.json({ error: "week must be YYYY-MM-DD" }, { status: 400 });
  const week = weekOf(weekParam);
  const type = sp.get("type");
  const status = sp.get("status");
  const q = sp.get("q")?.trim().toLowerCase();

  let list = getSupabaseAdminClient().from("payouts").select("*, restaurants(name), riders(name)").eq("period_start", week.start).order("payee_type").order("net_paise", { ascending: false });
  if (type === "restaurant" || type === "rider") list = list.eq("payee_type", type);
  if (status === "generated" || status === "paid") list = list.eq("status", status);
  const { data, error } = await list;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? [])
    .map((p) => ({ ...p, payee: p.payee_type === "rider" ? (p.riders?.name ?? "") : (p.restaurants?.name ?? "") }))
    .filter((p) => !q || p.payee.toLowerCase().includes(q));
  const body = toCsv(
    ["Statement", "Payee type", "Payee", "Period start", "Period end", "Orders / trips", "Gross (₹)", "Commission (₹)", "GST on commission (₹)", "Food Rescue (₹)", "COD cash held (₹)", "Adjustments (₹)", "Net (₹)", "Status", "Paid at"],
    rows.map((p) => [
      p.id,
      p.payee_type,
      p.payee,
      p.period_start,
      p.period_end,
      p.order_count,
      rupees(p.gross_paise),
      rupees(p.commission_paise),
      rupees(p.gst_on_commission_paise),
      rupees(p.food_rescue_paise),
      rupees(p.cash_held_paise),
      rupees(p.adjustments_paise),
      rupees(p.net_paise),
      p.status,
      p.paid_at ? new Date(p.paid_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
    ]),
  );
  return csvResponse(body, `thaali-payouts-${week.start}.csv`);
}
