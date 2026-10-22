import { Clock, HandHeart, IndianRupee, Leaf, PackageCheck } from "lucide-react";
import Link from "next/link";
import { FilterTabs, fmtDateTime, ilikeTerm, ListSearch, Pagination, type ListParams } from "@/components/admin/restaurants/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";
import { StatTile } from "./stat-tile";

const PAGE_SIZE = 20;
const BASE = "/admin/rescue";
const STATUSES = ["available", "claimed", "expired"] as const;
type Status = (typeof STATUSES)[number];

const badge: Record<Status, { label: string; variant: "default" | "secondary" | "outline" | "success" }> = {
  available: { label: "Available", variant: "default" },
  claimed: { label: "Claimed", variant: "success" },
  expired: { label: "Expired", variant: "outline" },
};

/**
 * Totals over all listings. A listing still marked available whose expiry has passed counts as expired.
 *   meals rescued = claimed listings; money saved = Σ (original − rescue price) of claimed listings.
 */
export async function rescueTotals(db: TypedSupabaseClient) {
  const { data, error } = await db.from("food_rescue_listings").select("status, expires_at, original_price_paise, rescue_price_paise").limit(10000);
  if (error) throw new Error(error.message);
  const now = Date.now();
  const t = { listed: 0, available: 0, claimed: 0, expired: 0, saved: 0, revenue: 0 };
  for (const r of data ?? []) {
    t.listed++;
    const s = effectiveStatus(r.status, r.expires_at, now);
    t[s]++;
    if (s === "claimed") {
      t.saved += r.original_price_paise - r.rescue_price_paise;
      t.revenue += r.rescue_price_paise;
    }
  }
  return t;
}

function effectiveStatus(status: string, expiresAt: string, now = Date.now()): Status {
  if (status === "available" && Date.parse(expiresAt) <= now) return "expired";
  return STATUSES.includes(status as Status) ? (status as Status) : "expired";
}

export async function RescueLog({ db, params, page }: { db: TypedSupabaseClient; params: ListParams; page: number }) {
  const status = STATUSES.includes(params.status as Status) ? (params.status as Status) : undefined;
  const q = params.q;
  const nowIso = new Date().toISOString();

  let list = db
    .from("food_rescue_listings")
    .select("id, items_summary, is_veg, original_price_paise, rescue_price_paise, status, expires_at, claimed_at, created_at, restaurants(id, name, locality), profiles(id, name), claimed_order:orders!food_rescue_listings_claimed_order_id_fkey(id, order_number)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status === "claimed") list = list.eq("status", "claimed");
  if (status === "available") list = list.eq("status", "available").gt("expires_at", nowIso);
  if (status === "expired") list = list.or(`status.eq.expired,and(status.eq.available,expires_at.lte.${nowIso})`);
  if (q) {
    const { data: rs } = await db.from("restaurants").select("id").ilike("name", ilikeTerm(q)).limit(50);
    list = list.or([`items_summary.ilike.${ilikeTerm(q)}`, ...(rs?.length ? [`restaurant_id.in.(${rs.map((r) => r.id).join(",")})`] : [])].join(","));
  }

  const [totals, { data, count, error }] = await Promise.all([rescueTotals(db), list]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  return (
    <section aria-labelledby="rescue-title" className="space-y-4">
      <h2 id="rescue-title" className="sr-only">
        Food Rescue log
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="rescue-totals">
        <StatTile icon={HandHeart} label="Meals rescued" value={String(totals.claimed)} hint={`of ${totals.listed} listed`} testId="rescue-meals" />
        <StatTile icon={IndianRupee} label="Money saved by customers" value={formatPaise(totals.saved)} hint={`${formatPaise(totals.revenue)} paid to restaurants`} testId="rescue-saved" />
        <StatTile icon={PackageCheck} label="Available now" value={String(totals.available)} testId="rescue-available" />
        <StatTile icon={Clock} label="Expired unclaimed" value={String(totals.expired)} testId="rescue-expired" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          base={BASE}
          params={params}
          paramKey="status"
          label="Listing status"
          options={[{ value: "all", label: "All", count: totals.listed }, ...STATUSES.map((s) => ({ value: s, label: badge[s].label, count: totals[s] }))]}
        />
        <ListSearch base={BASE} params={params} placeholder="Restaurant or items" label="Search listings" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Leaf} title={q ? "No listings match your search" : "No listings here"} description="Restaurants list cancelled-but-cooked orders at a discount; they show up here." />
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Food Rescue listings">
            {rows.map((r) => {
              const s = effectiveStatus(r.status, r.expires_at);
              return (
                <li key={r.id}>
                  <Card className="space-y-1 p-4" data-testid="rescue-row">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{r.restaurants?.name}</p>
                      <Badge variant={badge[s].variant}>{badge[s].label}</Badge>
                    </div>
                    <p className="text-sm">{r.items_summary}</p>
                    <p className="text-sm tabular-nums">
                      <span className="text-muted-foreground line-through">{formatPaise(r.original_price_paise)}</span> <span className="font-semibold">{formatPaise(r.rescue_price_paise)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Listed {fmtDateTime(r.created_at)} · {s === "claimed" && r.claimed_at ? `claimed ${fmtDateTime(r.claimed_at)} by ${r.profiles?.name ?? "a customer"}` : `expires ${fmtDateTime(r.expires_at)}`}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Restaurant</th>
                  <th scope="col" className="px-2 py-2 font-medium">Items</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Original</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Rescue price</th>
                  <th scope="col" className="px-2 py-2 font-medium">Status</th>
                  <th scope="col" className="px-2 py-2 font-medium">Claimed by</th>
                  <th scope="col" className="px-4 py-2 font-medium">Times</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const s = effectiveStatus(r.status, r.expires_at);
                  return (
                    <tr key={r.id} data-testid="rescue-row" className="align-top hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        {r.restaurants ? (
                          <Link href={`/admin/restaurants/${r.restaurants.id}`} className="font-semibold hover:underline">
                            {r.restaurants.name}
                          </Link>
                        ) : null}
                        <p className="text-xs text-muted-foreground">{r.restaurants?.locality}</p>
                      </td>
                      <td className="max-w-64 px-2 py-2.5">
                        <span className={r.is_veg ? "text-success" : "text-destructive"} aria-label={r.is_veg ? "Veg" : "Non-veg"}>
                          ●
                        </span>{" "}
                        {r.items_summary}
                      </td>
                      <td className="px-2 py-2.5 text-right text-muted-foreground tabular-nums line-through">{formatPaise(r.original_price_paise)}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{formatPaise(r.rescue_price_paise)}</td>
                      <td className="px-2 py-2.5">
                        <Badge variant={badge[s].variant}>{badge[s].label}</Badge>
                      </td>
                      <td className="px-2 py-2.5">
                        {s === "claimed" ? (
                          <>
                            {r.profiles ? (
                              <Link href={`/admin/users/${r.profiles.id}`} className="hover:underline">
                                {r.profiles.name ?? "Customer"}
                              </Link>
                            ) : (
                              "Customer"
                            )}
                            {r.claimed_order ? (
                              <Link href={`/admin/orders/${r.claimed_order.id}`} className="block text-xs text-primary hover:underline">
                                Order #{r.claimed_order.order_number}
                              </Link>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        <p>Listed {fmtDateTime(r.created_at)}</p>
                        <p>{s === "claimed" && r.claimed_at ? `Claimed ${fmtDateTime(r.claimed_at)}` : `Expires ${fmtDateTime(r.expires_at)}`}</p>
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
    </section>
  );
}
