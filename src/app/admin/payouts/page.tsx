import { Bike, ChevronRight, Download, IndianRupee, ReceiptText, Store, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterTabs, ilikeTerm, ListSearch, listHref, Pagination, parsePage, type ListParams } from "@/components/admin/restaurants/list-controls";
import { GenerateButton, WeekSelect } from "@/components/admin/payouts/week-controls";
import { StatTile } from "@/components/admin/rescue/stat-tile";
import { PayoutStatusBadge } from "@/components/partner/payouts/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, formatPeriod, isIsoDate, lastCompleteWeek, weekOf } from "@/lib/payouts/dates";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts" };

const PAGE_SIZE = 25;
const BASE = "/admin/payouts";
const TYPES = ["restaurant", "rider"] as const;
const STATUSES = ["generated", "paid"] as const;

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ week?: string; type?: string; status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const last = lastCompleteWeek();
  const week = isIsoDate(sp.week) && weekOf(sp.week).end <= last.end ? weekOf(sp.week) : last;
  const type = TYPES.find((t) => t === sp.type);
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const page = parsePage(sp.page);
  const params: ListParams = { week: week.start === last.start ? undefined : week.start, type, status, q, page: sp.page };
  const db = await getSupabaseServerClient();

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(last.start, -7 * i);
    return { start, label: formatPeriod({ start, end: addDays(start, 6) }) };
  });
  if (!weeks.some((w) => w.start === week.start)) weeks.push({ start: week.start, label: formatPeriod(week) });

  let payeeFilter: string | null = null;
  if (q) {
    const [{ data: rs }, { data: rd }] = await Promise.all([
      db.from("restaurants").select("id").ilike("name", ilikeTerm(q)).limit(50),
      db.from("riders").select("id").ilike("name", ilikeTerm(q)).limit(50),
    ]);
    const parts = [...(rs?.length ? [`restaurant_id.in.(${rs.map((r) => r.id).join(",")})`] : []), ...(rd?.length ? [`rider_id.in.(${rd.map((r) => r.id).join(",")})`] : [])];
    payeeFilter = parts.length ? parts.join(",") : "id.is.null";
  }

  let list = db
    .from("payouts")
    .select("*, restaurants(name, locality), riders(name)", { count: "exact" })
    .eq("period_start", week.start)
    .order("payee_type", { ascending: true })
    .order("net_paise", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type) list = list.eq("payee_type", type);
  if (status) list = list.eq("status", status);
  if (payeeFilter) list = list.or(payeeFilter);

  const [{ data, count, error }, { data: all }] = await Promise.all([list, db.from("payouts").select("payee_type, status, net_paise").eq("period_start", week.start)]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const sums = (all ?? []).reduce(
    (a, p) => {
      a.count++;
      a.net += p.net_paise;
      if (p.status === "paid") a.paid++;
      else a.unpaid += p.net_paise;
      if (p.payee_type === "rider") a.riders++;
      else a.restaurants++;
      return a;
    },
    { count: 0, net: 0, unpaid: 0, paid: 0, riders: 0, restaurants: 0 },
  );
  const csvHref = listHref(`${BASE}/export`, { week: week.start, type, status, q });

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Weekly Mon–Sun statements for restaurants and delivery partners."
        actions={
          <div className="flex flex-wrap gap-2">
            {sums.count ? (
              <Button asChild variant="outline">
                <a href={csvHref} download data-testid="payouts-csv">
                  <Download /> Export CSV
                </a>
              </Button>
            ) : null}
            <GenerateButton week={week.start} hasStatements={sums.count > 0} />
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <WeekSelect weeks={weeks} value={week.start} keep={{ type, status }} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ReceiptText} label="Statements" value={String(sums.count)} hint={`${sums.restaurants} restaurants · ${sums.riders} riders`} testId="payouts-count" />
        <StatTile icon={IndianRupee} label="Net total" value={formatPaise(sums.net)} testId="payouts-net-total" />
        <StatTile icon={Wallet} label="Still to pay" value={formatPaise(sums.unpaid)} hint={`${sums.count - sums.paid} unpaid`} />
        <StatTile icon={Store} label="Paid" value={`${sums.paid}/${sums.count}`} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterTabs base={BASE} params={params} paramKey="type" label="Payee type" options={[{ value: "all", label: "All" }, { value: "restaurant", label: "Restaurants" }, { value: "rider", label: "Riders" }]} />
          <FilterTabs base={BASE} params={params} paramKey="status" label="Payout status" options={[{ value: "all", label: "Any status" }, { value: "generated", label: "Unpaid" }, { value: "paid", label: "Paid" }]} />
        </div>
        <ListSearch base={BASE} params={params} placeholder="Restaurant or rider name" label="Search payees" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={sums.count ? "No statements match these filters" : "No statements for this week yet"}
          description={sums.count ? "Clear the filters to see every statement." : `Generate statements for ${formatPeriod(week)} to settle restaurants and riders.`}
        />
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Statements">
            {rows.map((p) => {
              const name = p.payee_type === "rider" ? (p.riders?.name ?? "Rider") : (p.restaurants?.name ?? "Restaurant");
              return (
                <li key={p.id}>
                  <Card className="p-0">
                    <Link href={`${BASE}/${p.id}`} className="flex items-center gap-3 p-4" data-testid="payout-row" aria-label={`${name} statement`}>
                      {p.payee_type === "rider" ? <Bike className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : <Store className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {p.order_count} {p.payee_type === "rider" ? "trips" : "orders"} · gross {formatPaise(p.gross_paise)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatPaise(p.net_paise)}</p>
                        <PayoutStatusBadge status={p.status} />
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Payee</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Orders / trips</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Gross</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Commission</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">GST</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Rescue</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">COD cash</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Adjustments</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Net</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p) => {
                  const name = p.payee_type === "rider" ? (p.riders?.name ?? "Rider") : (p.restaurants?.name ?? "Restaurant");
                  return (
                    <tr key={p.id} className="hover:bg-muted/30" data-testid="payout-row">
                      <td className="px-4 py-2.5">
                        <Link href={`${BASE}/${p.id}`} className="font-semibold hover:underline">
                          {name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{p.payee_type === "rider" ? "Delivery partner" : (p.restaurants?.locality ?? "Restaurant")}</p>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.order_count}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatPaise(p.gross_paise)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.commission_paise ? `− ${formatPaise(p.commission_paise)}` : "–"}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.gst_on_commission_paise ? `− ${formatPaise(p.gst_on_commission_paise)}` : "–"}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.food_rescue_paise ? `+ ${formatPaise(p.food_rescue_paise)}` : "–"}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.cash_held_paise ? `− ${formatPaise(p.cash_held_paise)}` : "–"}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.adjustments_paise ? formatPaise(p.adjustments_paise) : "–"}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums" data-testid="payout-row-net">
                        {formatPaise(p.net_paise)}
                      </td>
                      <td className="px-4 py-2.5">
                        <PayoutStatusBadge status={p.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </>
      )}
    </>
  );
}
