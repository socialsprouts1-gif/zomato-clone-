import { ChevronRight, Star, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterTabs, fmtDate, ilikeTerm, ListSearch, Pagination, parsePage, statusBadge, type ListParams } from "@/components/admin/restaurants/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Restaurants" };

const PAGE_SIZE = 20;
const STATUSES = ["pending", "approved", "suspended", "rejected"] as const;
type Status = (typeof STATUSES)[number];
const BASE = "/admin/restaurants";

export default async function AdminRestaurantsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const page = parsePage(sp.page);
  const params: ListParams = { q, status, page: sp.page };
  const supabase = await getSupabaseServerClient();

  let list = supabase
    .from("restaurants")
    .select("id, name, slug, locality, cuisines, status, commission_pct, rating_delivery, rating_count, cost_for_two_paise, created_at, is_featured, gold_partner, restaurant_private(owner_name, owner_email)", { count: "exact" })
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) list = list.eq("status", status);
  if (q) list = list.or(`name.ilike.${ilikeTerm(q)},locality.ilike.${ilikeTerm(q)},slug.ilike.${ilikeTerm(q)}`);

  const counts = await Promise.all(STATUSES.map((s) => supabase.from("restaurants").select("id", { count: "exact", head: true }).eq("status", s).then((r) => r.count ?? 0)));
  const { data, count, error } = await list;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Restaurants" description="Review applications, edit outlets, suspend and set commission." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          base={BASE}
          params={params}
          paramKey="status"
          label="Restaurant status"
          options={[{ value: "all", label: "All", count: total }, ...STATUSES.map((s, i) => ({ value: s, label: statusBadge[s]!.label, count: counts[i] }))]}
        />
        <ListSearch base={BASE} params={params} placeholder="Name, locality or slug" label="Search restaurants" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Store} title={q ? "No restaurants match your search" : "No restaurants here"} description={q ? "Try a different name or locality." : "Applications and outlets with this status appear here."} />
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Restaurants">
            {rows.map((r) => {
              const b = statusBadge[r.status]!;
              return (
                <li key={r.id}>
                  <Card className="p-0">
                    <Link href={`${BASE}/${r.id}`} className="flex items-center gap-3 p-4" data-testid="admin-restaurant-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{r.name}</p>
                          <Badge variant={b.variant}>{b.label}</Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {r.locality} · {r.cuisines.slice(0, 2).join(", ")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {Number(r.commission_pct)}% commission · {formatPaise(r.cost_for_two_paise)} for two
                        </p>
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
                  <th scope="col" className="px-4 py-2 font-medium">Restaurant</th>
                  <th scope="col" className="px-2 py-2 font-medium">Owner</th>
                  <th scope="col" className="px-2 py-2 font-medium">Status</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Rating</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Commission</th>
                  <th scope="col" className="px-4 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const b = statusBadge[r.status]!;
                  const owner = Array.isArray(r.restaurant_private) ? r.restaurant_private[0] : r.restaurant_private;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30" data-testid="admin-restaurant-row">
                      <td className="px-4 py-2.5">
                        <Link href={`${BASE}/${r.id}`} className="font-semibold hover:underline">
                          {r.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.locality} · {r.cuisines.slice(0, 3).join(", ")}
                          {r.is_featured ? " · Featured" : ""}
                          {r.gold_partner ? " · Gold" : ""}
                        </p>
                      </td>
                      <td className="px-2 py-2.5">
                        <p>{owner?.owner_name ?? "–"}</p>
                        <p className="text-xs text-muted-foreground">{owner?.owner_email ?? ""}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge variant={b.variant}>{b.label}</Badge>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {r.rating_count ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3.5 fill-current text-success" aria-hidden /> {Number(r.rating_delivery).toFixed(1)}
                          </span>
                        ) : (
                          "New"
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{Number(r.commission_pct)}%</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.created_at)}</td>
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
