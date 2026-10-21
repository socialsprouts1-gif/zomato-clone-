import { ArrowLeft, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PayoutBreakdown } from "@/components/partner/payouts/breakdown";
import { PayoutOrdersTable } from "@/components/partner/payouts/orders-table";
import { PayoutStatusBadge } from "@/components/partner/payouts/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPartnerContext } from "@/lib/partner/context";
import { computeRestaurantPayout } from "@/lib/payouts";
import { formatPeriod } from "@/lib/payouts/dates";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payout statement" };

export default async function PayoutStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getPartnerContext(`/partner/payouts/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getSupabaseServerClient();
  const { data: p } = await db.from("payouts").select("*, restaurants(name)").eq("id", id).eq("payee_type", "restaurant").maybeSingle();
  if (!p?.restaurant_id) notFound();
  const s = await computeRestaurantPayout(p.restaurant_id, p.period_start, p.period_end, db);
  const period = formatPeriod({ start: p.period_start, end: p.period_end });

  return (
    <>
      <Link href="/partner/payouts" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All payouts
      </Link>
      <PageHeader
        title={`Statement · ${period}`}
        description={p.restaurants?.name ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <PayoutStatusBadge status={p.status} />
            <Button asChild variant="outline">
              <a href={`/partner/payouts/${p.id}/export`} download data-testid="payout-csv">
                <Download /> Download CSV
              </a>
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-2">
          <PayoutBreakdown
            v={{
              orderCount: p.order_count,
              gross: p.gross_paise,
              commissionPct: s.commission_pct,
              commission: p.commission_paise,
              gstPct: s.gst_pct,
              gst: p.gst_on_commission_paise,
              rescue: p.food_rescue_paise,
              adjustments: p.adjustments_paise,
              net: p.net_paise,
            }}
          />
          <p className="text-xs text-muted-foreground">
            {p.status === "paid" && p.paid_at
              ? `Paid to your bank account on ${new Date(p.paid_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}.`
              : "Generated · transfers to your bank account within 3 working days."}
          </p>
        </div>
        <PayoutOrdersTable orders={s.orders} rescue={s.rescue} />
      </div>
    </>
  );
}
