import { NextResponse, type NextRequest } from "next/server";
import { getPartnerContext } from "@/lib/partner/context";
import { EXPORT_HEADER, loadExportOrders, parseReportRange, paymentLabel, statusLabel } from "@/lib/partner/reports";
import { csvResponse, rupees, toCsv } from "@/lib/payouts/csv";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** GET /partner/reports/export?range=… → CSV of the current outlet's orders in that range. */
export async function GET(req: NextRequest) {
  const { current } = await getPartnerContext("/partner/reports");
  if (!current) return NextResponse.json({ error: "No outlet selected" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const range = parseReportRange({ range: sp.get("range") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const orders = await loadExportOrders(await getSupabaseServerClient(), current.id, range);
  const body = toCsv(
    EXPORT_HEADER,
    orders.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
      statusLabel(o.status),
      o.order_items.map((i) => `${i.quantity} × ${i.name}${i.variant_name ? ` (${i.variant_name})` : ""}`).join("; "),
      rupees(o.item_total_paise),
      rupees(o.discount_paise),
      rupees(o.total_paise),
      paymentLabel(o.payment_method, o.payment_method_detail),
    ]),
  );
  return csvResponse(body, `${current.slug}-orders-${range.from}-to-${range.to}.csv`);
}
