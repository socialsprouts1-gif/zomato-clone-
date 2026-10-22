import { ArrowLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDateTime } from "@/components/admin/restaurants/list-controls";
import { AddAdjustmentDialog, MarkPaidButton } from "@/components/admin/payouts/statement-actions";
import { PayoutStatusBadge } from "@/components/partner/payouts/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { computeRestaurantPayout } from "@/lib/payouts";
import { formatPeriod } from "@/lib/payouts/dates";
import { computeRiderPayout } from "@/lib/payouts/riders";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Payout statement" };

const signed = (paise: number, sign: "+" | "−" | "±") => (paise === 0 ? formatPaise(0) : `${sign === "±" ? (paise < 0 ? "−" : "+") : sign} ${formatPaise(Math.abs(paise))}`);
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

type Line = { id: string; label: string; hint?: string; value: string };

export default async function AdminPayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getSupabaseServerClient();
  const { data: p } = await db.from("payouts").select("*, restaurants(id, name, commission_pct), riders(id, name, floating_cash_paise)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: adjustments } = await db.from("payout_adjustments").select("id, amount_paise, note, created_at, profiles(name)").eq("payout_id", id).order("created_at");
  const period = formatPeriod({ start: p.period_start, end: p.period_end });
  const isRider = p.payee_type === "rider";
  const name = isRider ? (p.riders?.name ?? "Rider") : (p.restaurants?.name ?? "Restaurant");
  const payeeHref = isRider ? `/admin/riders/${p.rider_id}` : `/admin/restaurants/${p.restaurant_id}`;

  let lines: Line[];
  let detail: React.ReactNode;
  if (isRider && p.rider_id) {
    const s = await computeRiderPayout(p.rider_id, p.period_start, p.period_end, db);
    lines = [
      { id: "gross", label: "Earnings", hint: `${p.order_count} trip${p.order_count === 1 ? "" : "s"} · trip pay ${formatPaise(s.trip_pay_paise)} + tips ${formatPaise(s.tips_paise)} + incentives ${formatPaise(s.incentives_paise + s.other_paise)}`, value: formatPaise(p.gross_paise) },
      { id: "cash", label: "COD cash held", hint: `Cash collected on delivery and not yet deposited (${formatPaise(s.cod_collected_paise)} collected, ${formatPaise(s.cash_deposited_paise)} deposited this week)`, value: signed(p.cash_held_paise, "−") },
      { id: "adjustments", label: "Adjustments", value: signed(p.adjustments_paise, "±") },
    ];
    detail = (
      <section aria-labelledby="lines-title" className="space-y-2">
        <h2 id="lines-title" className="font-semibold">
          Trips &amp; incentives
        </h2>
        {s.trips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trips this week.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm" data-testid="payout-lines">
            {s.trips.map((t, i) => (
              <li key={`${t.order_id ?? "x"}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  {t.order_id && t.order_number ? (
                    <Link href={`/admin/orders/${t.order_id}`} className="font-medium hover:underline">
                      Order #{t.order_number}
                    </Link>
                  ) : (
                    <span className="font-medium capitalize">{t.kind}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {when(t.created_at)}
                    {t.tip_paise ? ` · tip ${formatPaise(t.tip_paise)}` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatPaise(t.total_paise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  } else {
    const s = await computeRestaurantPayout(p.restaurant_id!, p.period_start, p.period_end, db);
    lines = [
      { id: "gross", label: "Order value", hint: `${p.order_count} delivered order${p.order_count === 1 ? "" : "s"} · items + packaging − restaurant-funded discounts`, value: formatPaise(p.gross_paise) },
      { id: "commission", label: `Commission (${s.commission_pct}%)`, value: signed(p.commission_paise, "−") },
      { id: "gst", label: `GST on commission (${s.gst_pct}%)`, value: signed(p.gst_on_commission_paise, "−") },
      { id: "rescue", label: "Food Rescue earnings", value: signed(p.food_rescue_paise, "+") },
      { id: "adjustments", label: "Adjustments", value: signed(p.adjustments_paise, "±") },
    ];
    detail = (
      <section aria-labelledby="lines-title" className="space-y-2">
        <h2 id="lines-title" className="font-semibold">
          Orders
        </h2>
        {s.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No delivered orders this week.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card text-sm" data-testid="payout-lines">
            {s.orders.map((o) => (
              <li key={o.order_id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  <Link href={`/admin/orders/${o.order_id}`} className="font-medium hover:underline">
                    Order #{o.order_number}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{when(o.delivered_at)}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatPaise(o.order_value_paise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <>
      <Link href={`/admin/payouts?week=${p.period_start}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Statements for {period}
      </Link>
      <PageHeader
        title={name}
        description={`${isRider ? "Delivery partner" : "Restaurant"} statement · ${period}`}
        actions={
          p.status === "generated" ? (
            <div className="flex flex-wrap gap-2">
              <AddAdjustmentDialog payoutId={p.id} />
              <MarkPaidButton payoutId={p.id} label={`${name} · ${formatPaise(p.net_paise)} for ${period}.`} />
            </div>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <PayoutStatusBadge status={p.status} />
            {p.paid_at ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground" data-testid="payout-locked">
                <Lock className="size-3.5" aria-hidden /> Paid {fmtDateTime(p.paid_at)} · locked
              </span>
            ) : null}
            <Link href={payeeHref} className="font-semibold text-primary hover:underline">
              View {isRider ? "rider" : "restaurant"}
            </Link>
          </div>
          <dl className="divide-y rounded-2xl border bg-card" data-testid="payout-breakdown">
            {lines.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <dt>
                  <span className="text-sm font-medium">{r.label}</span>
                  {r.hint ? <span className="block text-xs text-muted-foreground">{r.hint}</span> : null}
                </dt>
                <dd className="shrink-0 text-sm font-semibold tabular-nums" data-testid={`payout-${r.id}`}>
                  {r.value}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 rounded-b-2xl bg-secondary/50 px-4 py-3">
              <dt className="font-display font-semibold">{p.net_paise < 0 ? "Owed to Thaali" : "Net payout"}</dt>
              <dd className="font-display text-lg font-bold tabular-nums" data-testid="payout-net">
                {formatPaise(p.net_paise)}
              </dd>
            </div>
          </dl>
          <Card>
            <CardContent className="space-y-2 p-4">
              <h2 className="font-semibold">Adjustments</h2>
              {!adjustments?.length ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="divide-y text-sm" data-testid="payout-adjustments-list">
                  {adjustments.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                      <span>
                        {a.note}
                        <span className="block text-xs text-muted-foreground">
                          {a.profiles?.name ?? "Admin"} · {fmtDateTime(a.created_at)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{signed(a.amount_paise, "±")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        {detail}
      </div>
    </>
  );
}
