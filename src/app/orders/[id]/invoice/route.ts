import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { renderInvoicePdf } from "@/lib/orders/invoice";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

/** GET /orders/:id/invoice → PDF (customer, restaurant team or admin; RLS decides). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const supabase = await getSupabaseServerClient();
  const { data: o } = await supabase.from("orders").select("*, restaurants(name, address, fssai), order_items(*)").eq("id", id).maybeSingle();
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (o.status !== "DELIVERED") return NextResponse.json({ error: "Invoices are available once the order is delivered" }, { status: 400 });
  const { data: priv } = await getSupabaseAdminClient().from("restaurant_private").select("gst_number").eq("restaurant_id", o.restaurant_id).maybeSingle();
  const addr = o.delivery_address as { label?: string; line1?: string };
  const bill = [
    { label: "Item total", amount: o.item_total_paise },
    { label: "Delivery fee", amount: o.delivery_fee_paise },
    { label: "Platform fee", amount: o.platform_fee_paise },
    { label: "Packaging charges", amount: o.packaging_fee_paise },
    { label: "GST (5%)", amount: o.gst_paise },
    ...(o.tip_paise ? [{ label: "Rider tip", amount: o.tip_paise }] : []),
    ...(o.donation_paise ? [{ label: "Feeding India donation", amount: o.donation_paise }] : []),
    ...(o.discount_paise ? [{ label: `Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`, amount: o.discount_paise, negative: true }] : []),
  ];
  const pdf = await renderInvoicePdf({
    orderNumber: o.order_number,
    date: new Date(o.delivered_at ?? o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
    restaurant: { name: o.restaurants?.name ?? "", address: o.restaurants?.address ?? "", fssai: o.restaurants?.fssai ?? null, gstin: priv?.gst_number ?? null },
    customer: { name: o.customer_name ?? "Customer", address: `${addr.label ?? ""}: ${addr.line1 ?? ""}` },
    items: o.order_items.map((i) => ({
      name: i.name,
      detail: [i.variant_name, ...((i.addons as { name: string }[] | null) ?? []).map((a) => a.name)].filter(Boolean).join(", "),
      qty: i.quantity,
      unit: i.unit_price_paise,
      total: i.total_paise,
    })),
    bill,
    total: o.total_paise,
    paymentLabel: o.payment_method === "cod" ? "Paid in cash on delivery" : o.payment_method === "wallet" ? "Paid from Thaali wallet" : `Paid online (${(o.payment_method_detail ?? "razorpay").toUpperCase()})${o.wallet_used_paise ? ` + wallet` : ""}`,
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="thaali-invoice-${o.order_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
