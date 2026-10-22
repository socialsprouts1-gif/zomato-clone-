import { ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABEL } from "@/components/admin/users/roles";
import { FilterTabs, fmtDate, ilikeTerm, ListSearch, Pagination, parsePage, type ListParams } from "@/components/admin/restaurants/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;
const BASE = "/admin/users";
const FILTERS = ["all", "customer", "restaurant_owner", "restaurant_staff", "rider", "admin", "blocked"] as const;
type Filter = (typeof FILTERS)[number];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const role: Filter = FILTERS.includes(sp.role as Filter) ? (sp.role as Filter) : "all";
  const page = parsePage(sp.page);
  const params: ListParams = { q, role: role === "all" ? undefined : role, page: sp.page };
  const supabase = await getSupabaseServerClient();

  let list = supabase
    .from("profiles")
    .select("id, name, email, phone, role, is_blocked, created_at, deleted_at, wallets(balance_paise)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (role === "blocked") list = list.eq("is_blocked", true);
  else if (role !== "all") list = list.eq("role", role);
  if (q) list = list.or(`name.ilike.${ilikeTerm(q)},email.ilike.${ilikeTerm(q)},phone.ilike.${ilikeTerm(q)}`);
  const { data, count, error } = await list;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((u) => ({ ...u, balance: (Array.isArray(u.wallets) ? u.wallets[0] : u.wallets)?.balance_paise ?? 0 }));

  const options = FILTERS.map((f) => ({ value: f, label: f === "all" ? "All" : f === "blocked" ? "Blocked" : ROLE_LABEL[f] }));

  return (
    <>
      <PageHeader title="Users" description="Find any account, see orders and wallet, block or add credits." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs base={BASE} params={params} paramKey="role" label="Filter by role" options={options} />
        <ListSearch base={BASE} params={params} placeholder="Name, email or phone" label="Search users" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={q ? "No users match your search" : "No users here"} description={q ? "Try a name, email or the last digits of a phone number." : "Accounts with this role appear here."} />
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Users">
            {rows.map((u) => (
              <li key={u.id}>
                <Card className="p-0">
                  <Link href={`${BASE}/${u.id}`} className="flex items-center gap-3 p-4" data-testid="admin-user-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{u.name || "Unnamed"}</p>
                        {u.is_blocked ? <Badge variant="destructive">Blocked</Badge> : null}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{u.email ?? u.phone ?? "No contact"}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">User</th>
                  <th scope="col" className="px-2 py-2 font-medium">Phone</th>
                  <th scope="col" className="px-2 py-2 font-medium">Role</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Wallet</th>
                  <th scope="col" className="px-4 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30" data-testid="admin-user-row">
                    <td className="px-4 py-2.5">
                      <Link href={`${BASE}/${u.id}`} className="font-semibold hover:underline">
                        {u.name || "Unnamed"}
                      </Link>
                      {u.is_blocked ? (
                        <Badge variant="destructive" className="ml-2">
                          Blocked
                        </Badge>
                      ) : null}
                      {u.deleted_at ? (
                        <Badge variant="outline" className="ml-2">
                          Deleted
                        </Badge>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{u.email ?? ""}</p>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{u.phone ?? "–"}</td>
                    <td className="px-2 py-2.5">{ROLE_LABEL[u.role]}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatPaise(Number(u.balance))}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </>
      )}
    </>
  );
}

