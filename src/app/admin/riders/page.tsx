import { Bike, ChevronRight, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterTabs, fmtDate, ilikeTerm, ListSearch, Pagination, parsePage, statusBadge, type ListParams } from "@/components/admin/restaurants/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Riders" };

const PAGE_SIZE = 20;
const STATUSES = ["pending", "approved", "suspended", "rejected"] as const;
type Status = (typeof STATUSES)[number];
const TAB_LABEL: Record<Status, string> = { pending: "Applicants", approved: "Active", suspended: "Suspended", rejected: "Rejected" };
const VEHICLE: Record<string, string> = { bicycle: "Bicycle", scooter: "Scooter", motorcycle: "Motorcycle", ev_scooter: "EV scooter" };
const BASE = "/admin/riders";

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-2 rounded-full", online ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
      {online ? "Online" : "Offline"}
    </span>
  );
}

export default async function AdminRidersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const page = parsePage(sp.page);
  const params: ListParams = { q, status, page: sp.page };
  const supabase = await getSupabaseServerClient();

  let list = supabase
    .from("riders")
    .select("id, name, phone, vehicle_type, vehicle_number, status, is_online, is_simulated, rating, rating_count, created_at, current_order_id", { count: "exact" })
    .order("status", { ascending: true })
    .order("is_online", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) list = list.eq("status", status);
  if (q) list = list.or(`name.ilike.${ilikeTerm(q)},phone.ilike.${ilikeTerm(q)},vehicle_number.ilike.${ilikeTerm(q)}`);

  const [counts, online, res] = await Promise.all([
    Promise.all(STATUSES.map((s) => supabase.from("riders").select("id", { count: "exact", head: true }).eq("status", s).then((r) => r.count ?? 0))),
    supabase.from("riders").select("id", { count: "exact", head: true }).eq("status", "approved").eq("is_online", true).then((r) => r.count ?? 0),
    list,
  ]);
  if (res.error) throw new Error(res.error.message);
  const rows = res.data ?? [];

  return (
    <>
      <PageHeader title="Riders" description={`Approve applicants, suspend riders and see live locations · ${online} online now.`} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          base={BASE}
          params={params}
          paramKey="status"
          label="Rider status"
          options={[{ value: "all", label: "All", count: counts.reduce((a, b) => a + b, 0) }, ...STATUSES.map((s, i) => ({ value: s, label: TAB_LABEL[s], count: counts[i] }))]}
        />
        <ListSearch base={BASE} params={params} placeholder="Name, phone or vehicle number" label="Search riders" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Bike} title={q ? "No riders match your search" : "No riders here"} description={q ? "Try a different name or phone number." : "Riders with this status appear here."} />
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Riders">
            {rows.map((r) => {
              const b = statusBadge[r.status]!;
              return (
                <li key={r.id}>
                  <Card className="p-0">
                    <Link href={`${BASE}/${r.id}`} className="flex items-center gap-3 p-4" data-testid="admin-rider-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{r.name}</p>
                          <Badge variant={b.variant}>{r.status === "pending" ? "Applicant" : b.label}</Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {VEHICLE[r.vehicle_type]} {r.vehicle_number ? `· ${r.vehicle_number}` : ""} · {r.phone ?? "No phone"}
                        </p>
                        {r.status === "approved" ? <OnlineDot online={r.is_online} /> : null}
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
                  <th scope="col" className="px-4 py-2 font-medium">Rider</th>
                  <th scope="col" className="px-2 py-2 font-medium">Vehicle</th>
                  <th scope="col" className="px-2 py-2 font-medium">Status</th>
                  <th scope="col" className="px-2 py-2 font-medium">Now</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Rating</th>
                  <th scope="col" className="px-4 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const b = statusBadge[r.status]!;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30" data-testid="admin-rider-row">
                      <td className="px-4 py-2.5">
                        <Link href={`${BASE}/${r.id}`} className="font-semibold hover:underline">
                          {r.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.phone ?? "No phone"}
                          {r.is_simulated ? " · Simulated" : ""}
                        </p>
                      </td>
                      <td className="px-2 py-2.5">
                        {VEHICLE[r.vehicle_type]}
                        <p className="text-xs text-muted-foreground">{r.vehicle_number ?? ""}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge variant={b.variant}>{r.status === "pending" ? "Applicant" : b.label}</Badge>
                      </td>
                      <td className="px-2 py-2.5">
                        {r.status === "approved" ? (r.current_order_id ? <span className="text-xs font-semibold text-primary">On a delivery</span> : <OnlineDot online={r.is_online} />) : "–"}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {r.rating_count ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3.5 fill-current text-success" aria-hidden /> {Number(r.rating).toFixed(1)}
                          </span>
                        ) : (
                          "New"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={res.count ?? 0} />
        </>
      )}
    </>
  );
}
