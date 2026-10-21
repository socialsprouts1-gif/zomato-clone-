import { Download, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FunnelCard } from "@/components/partner/reports/funnel";
import { KpiCards } from "@/components/partner/reports/kpi-cards";
import { PeakHours } from "@/components/partner/reports/peak-hours";
import { RangePicker } from "@/components/partner/reports/range-picker";
import { SalesTrend } from "@/components/partner/reports/sales-trend";
import { TopDishes } from "@/components/partner/reports/top-dishes";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPartnerContext } from "@/lib/partner/context";
import { loadReport, parseReportRange } from "@/lib/partner/reports";
import { formatDay, todayIst } from "@/lib/payouts/dates";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Business reports" };

type SP = Promise<{ range?: string; from?: string; to?: string }>;

export default async function PartnerReportsPage({ searchParams }: { searchParams: SP }) {
  const { current } = await getPartnerContext("/partner/reports");
  if (!current) {
    return (
      <>
        <PageHeader title="Business reports" />
        <EmptyState icon={Store} title="No outlet yet" description="Register your restaurant to see sales and order reports." action={<Button asChild><Link href="/partner/onboarding">Register your restaurant</Link></Button>} />
      </>
    );
  }
  const range = parseReportRange(await searchParams);
  const report = await loadReport(await getSupabaseServerClient(), current.id, range);
  const qs = new URLSearchParams({ range: range.preset, ...(range.preset === "custom" ? { from: range.from, to: range.to } : {}) });
  const rangeText = range.from === range.to ? formatDay(range.from, { day: "numeric", month: "short", year: "numeric" }) : `${formatDay(range.from)} – ${formatDay(range.to, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <PageHeader
        title="Business reports"
        description={`${current.name} · ${rangeText}`}
        actions={
          <Button asChild variant="outline">
            <a href={`/partner/reports/export?${qs}`} download data-testid="export-csv">
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      <div className="space-y-4">
        <RangePicker key={`${range.preset}:${range.from}:${range.to}`} preset={range.preset} from={range.from} to={range.to} today={todayIst()} />
        <KpiCards kpis={report.kpis} />
        <SalesTrend daily={report.daily} />
        <div className="grid gap-4 lg:grid-cols-2">
          <FunnelCard funnel={report.funnel} />
          <TopDishes byQty={report.top_by_qty} byRevenue={report.top_by_revenue} />
        </div>
        <PeakHours cells={report.heatmap} />
        <p className="text-xs text-muted-foreground">
          Days and hours are in India time. Gross sales count the item total of delivered orders before discounts, packaging, taxes and fees. Rejection rate = rejected ÷ orders placed.
        </p>
      </div>
    </>
  );
}
