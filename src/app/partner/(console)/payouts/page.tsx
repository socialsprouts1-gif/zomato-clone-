import { ChevronRight, Store, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PayoutBreakdown } from "@/components/partner/payouts/breakdown";
import { PayoutStatusBadge } from "@/components/partner/payouts/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPartnerContext } from "@/lib/partner/context";
import { computeRestaurantPayout, listRestaurantPayouts } from "@/lib/payouts";
import { formatPeriod, todayIst, weekOf } from "@/lib/payouts/dates";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts" };

export default async function PartnerPayoutsPage() {
  const { current } = await getPartnerContext("/partner/payouts");
  if (!current) {
    return (
      <>
        <PageHeader title="Payouts" />
        <EmptyState icon={Store} title="No outlet yet" description="Register your restaurant to receive weekly payouts." action={<Button asChild><Link href="/partner/onboarding">Register your restaurant</Link></Button>} />
      </>
    );
  }
  const db = await getSupabaseServerClient();
  const today = todayIst();
  const week = weekOf(today);
  const [payouts, estimate] = await Promise.all([listRestaurantPayouts(current.id, db), computeRestaurantPayout(current.id, week.start, today, db)]);
  const paidTotal = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.net_paise, 0);

  return (
    <>
      <PageHeader title="Payouts" description={`${current.name} · weekly statements, Monday to Sunday`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="estimate-title" className="space-y-3">
          <div>
            <h2 id="estimate-title" className="font-display text-lg font-semibold">This week so far</h2>
            <p className="text-xs text-muted-foreground">
              {formatPeriod({ start: week.start, end: today })} · estimate, settled after Sunday
            </p>
          </div>
          <div data-testid="payout-estimate">
            <PayoutBreakdown
              netLabel="Estimated payout"
              v={{
                orderCount: estimate.order_count,
                gross: estimate.gross_paise,
                commissionPct: estimate.commission_pct,
                commission: estimate.commission_paise,
                gstPct: estimate.gst_pct,
                gst: estimate.gst_on_commission_paise,
                rescue: estimate.food_rescue_paise,
                adjustments: 0,
                net: estimate.net_before_adjustments_paise,
              }}
            />
          </div>
        </section>

        <section aria-labelledby="statements-title" className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 id="statements-title" className="font-display text-lg font-semibold">Weekly statements</h2>
              <p className="text-xs text-muted-foreground">Paid out so far: {formatPaise(paidTotal)}</p>
            </div>
          </div>
          {payouts.length === 0 ? (
            <EmptyState icon={Wallet} title="No statements yet" description="Your first statement is generated the Monday after your first delivered week." />
          ) : (
            <ul className="divide-y rounded-2xl border bg-card shadow-sm" data-testid="payout-list">
              {payouts.map((p) => (
                <li key={p.id}>
                  <Link href={`/partner/payouts/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none" aria-label={`Statement ${formatPeriod({ start: p.period_start, end: p.period_end })}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{formatPeriod({ start: p.period_start, end: p.period_end })}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.order_count} orders · order value {formatPaise(p.gross_paise)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatPaise(p.net_paise)}</p>
                      <PayoutStatusBadge status={p.status} />
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
