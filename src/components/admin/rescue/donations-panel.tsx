import { CalendarDays, Gift, HeartHandshake, Users } from "lucide-react";
import Link from "next/link";
import { fmtDateTime, Pagination, type ListParams } from "@/components/admin/restaurants/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { addDays, todayIst } from "@/lib/payouts/dates";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";
import { StatTile } from "./stat-tile";

const PAGE_SIZE = 20;
const BASE = "/admin/rescue";
const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

/** Donation totals (all amounts in paise), grouped by India-time day and month. */
export async function donationTotals(db: TypedSupabaseClient) {
  const { data, error } = await db.from("donations").select("amount_paise, user_id, created_at").limit(50000);
  if (error) throw new Error(error.message);
  const byDay = new Map<string, number>();
  const byMonth = new Map<string, { total: number; count: number }>();
  const donors = new Set<string>();
  let total = 0;
  for (const d of data ?? []) {
    total += d.amount_paise;
    if (d.user_id) donors.add(d.user_id);
    const day = istDay(d.created_at);
    byDay.set(day, (byDay.get(day) ?? 0) + d.amount_paise);
    const m = byMonth.get(day.slice(0, 7)) ?? { total: 0, count: 0 };
    m.total += d.amount_paise;
    m.count++;
    byMonth.set(day.slice(0, 7), m);
  }
  return { total, count: data?.length ?? 0, donors: donors.size, byDay, byMonth };
}

export async function DonationsPanel({ db, params, page }: { db: TypedSupabaseClient; params: ListParams; page: number }) {
  const [t, { data, count, error }] = await Promise.all([
    donationTotals(db),
    db
      .from("donations")
      .select("id, amount_paise, created_at, profiles(id, name), orders(id, order_number)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const today = todayIst();
  const thisMonth = t.byMonth.get(today.slice(0, 7))?.total ?? 0;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const maxDay = Math.max(1, ...days.map((d) => t.byDay.get(d) ?? 0));
  const months = [...t.byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

  return (
    <section aria-labelledby="donations-title" className="space-y-4">
      <h2 id="donations-title" className="sr-only">
        Donations
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={HeartHandshake} label="Donated all time" value={formatPaise(t.total)} testId="donations-total" />
        <StatTile icon={CalendarDays} label="This month" value={formatPaise(thisMonth)} testId="donations-month" />
        <StatTile icon={Gift} label="Donations" value={String(t.count)} testId="donations-count" />
        <StatTile icon={Users} label="Donors" value={String(t.donors)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold">Last 14 days</h3>
            <ul className="space-y-1.5" data-testid="donations-by-day">
              {days.map((d) => {
                const v = t.byDay.get(d) ?? 0;
                return (
                  <li key={d} className="grid grid-cols-[6.5rem_1fr_5rem] items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{dayLabel(d)}</span>
                    <span className="h-2 rounded-full bg-muted" aria-hidden>
                      <span className="block h-2 rounded-full bg-primary" style={{ width: `${(v / maxDay) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums">{formatPaise(v)}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold">By month</h3>
            {months.length === 0 ? (
              <p className="text-sm text-muted-foreground">No donations yet.</p>
            ) : (
              <table className="w-full text-sm" data-testid="donations-by-month">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 font-medium">Month</th>
                    <th scope="col" className="py-1 text-right font-medium">Donations</th>
                    <th scope="col" className="py-1 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {months.map(([m, v]) => (
                    <tr key={m}>
                      <td className="py-1.5">{monthLabel(m)}</td>
                      <td className="py-1.5 text-right tabular-nums">{v.count}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{formatPaise(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <h3 className="font-semibold">All donations</h3>
      {rows.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="No donations yet" description="Customers can add a donation to the Feeding India fund at checkout." />
      ) : (
        <>
          <ul className="divide-y rounded-2xl border bg-card shadow-sm" aria-label="Donations">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm" data-testid="donation-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {d.profiles ? (
                      <Link href={`/admin/users/${d.profiles.id}`} className="hover:underline">
                        {d.profiles.name ?? "Customer"}
                      </Link>
                    ) : (
                      "Former customer"
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateTime(d.created_at)}
                    {d.orders ? (
                      <>
                        {" · "}
                        <Link href={`/admin/orders/${d.orders.id}`} className="text-primary hover:underline">
                          Order #{d.orders.order_number}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{formatPaise(d.amount_paise)}</p>
              </li>
            ))}
          </ul>
          <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </>
      )}
    </section>
  );
}
