import { Users } from "lucide-react";
import type { Metadata } from "next";
import { shortDate } from "@/components/admin/coupons/form-helpers";
import { ListToolbar, Pager } from "@/components/admin/coupons/list-toolbar";
import { BenefitsForm } from "@/components/admin/gold/benefits-form";
import { PlansManager } from "@/components/admin/gold/plans-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { assertAdmin } from "@/lib/admin/guard";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Gold" };

const PAGE_SIZE = 20;
const FILTERS = [
  { value: "", label: "All members" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "pending", label: "Payment pending" },
];

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function memberStatus(m: { status: string; ends_at: string }) {
  if (m.status === "active" && new Date(m.ends_at) < new Date()) return "expired";
  return m.status;
}
const STATUS_CLASS: Record<string, string> = {
  active: "border-transparent bg-success text-white",
  pending: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = { active: "Active", pending: "Payment pending", expired: "Expired", cancelled: "Cancelled" };

export default async function AdminGoldPage({ searchParams }: { searchParams: SP }) {
  await assertAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 60);
  const status = one(sp.status);
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();

  // Search matches the member's name, email or phone.
  let userIds: string[] | null = null;
  if (q) {
    const safe = q.replace(/[%,()*]/g, " ");
    const { data } = await db.from("profiles").select("id").or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(500);
    userIds = (data ?? []).map((p) => p.id);
  }

  let query = db
    .from("gold_memberships")
    .select("id, user_id, plan_id, starts_at, ends_at, status, amount_paid_paise, payment_method, created_at, profiles(name, email, phone), gold_plans(name)", { count: "exact" });
  if (userIds) query = query.in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  if (status === "active") query = query.eq("status", "active").gt("ends_at", now);
  if (status === "expired") query = query.or(`status.eq.expired,and(status.eq.active,ends_at.lte.${now})`);
  if (status === "cancelled" || status === "pending") query = query.eq("status", status);

  const [{ data: plans }, { data: allMemberships }, { data: settings }, { data: members, count }] = await Promise.all([
    db.from("gold_plans").select("*").order("sort").order("created_at"),
    db.from("gold_memberships").select("plan_id, status, ends_at"),
    db.from("platform_settings").select("gold_free_delivery_min_paise, gold_extra_discount_pct, gold_dining_discount_pct").single(),
    query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);

  const perPlan: Record<string, { active: number; total: number }> = {};
  let activeTotal = 0;
  for (const m of allMemberships ?? []) {
    const p = (perPlan[m.plan_id] ??= { active: 0, total: 0 });
    p.total += 1;
    if (m.status === "active" && m.ends_at > now) {
      p.active += 1;
      activeTotal += 1;
    }
  }

  return (
    <>
      <PageHeader title="Gold" description={`Membership plans, benefits and ${activeTotal.toLocaleString("en-IN")} active members.`} />
      <div className="space-y-8">
        <PlansManager plans={plans ?? []} members={perPlan} />
        {settings ? (
          <BenefitsForm
            initial={{
              free_delivery_min_rupees: String(settings.gold_free_delivery_min_paise / 100),
              extra_discount_pct: String(Number(settings.gold_extra_discount_pct)),
              dining_discount_pct: String(Number(settings.gold_dining_discount_pct)),
            }}
          />
        ) : null}

        <section aria-labelledby="members-title">
          <h2 id="members-title" className="font-display mb-3 text-lg font-semibold">
            Members
          </h2>
          <ListToolbar placeholder="Search by name, email or phone" searchLabel="Search members" filters={FILTERS} />
          {(members ?? []).length === 0 ? (
            <EmptyState icon={Users} title={q || status ? "No members match" : "No Gold members yet"} description={q || status ? "Try a different search or status." : "Customers who buy a plan will appear here."} />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-2 md:hidden">
                {(members ?? []).map((m) => {
                  const st = memberStatus(m);
                  return (
                    <li key={m.id} className="min-w-0">
                      <Card className="space-y-1 p-3" data-testid="gold-member">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{m.profiles?.name ?? "Customer"}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.profiles?.email ?? m.profiles?.phone}</p>
                          </div>
                          <Badge className={STATUS_CLASS[st]}>{STATUS_LABEL[st] ?? st}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.gold_plans?.name} · {formatPaise(m.amount_paid_paise)} · {shortDate(m.starts_at)} – {shortDate(m.ends_at)}
                        </p>
                      </Card>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 text-right font-medium">Paid</th>
                      <th className="px-4 py-3 font-medium">Started</th>
                      <th className="px-4 py-3 font-medium">Ends</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(members ?? []).map((m) => {
                      const st = memberStatus(m);
                      return (
                        <tr key={m.id} className="border-b last:border-0" data-testid="gold-member">
                          <td className="px-4 py-3">
                            <p className="font-medium">{m.profiles?.name ?? "Customer"}</p>
                            <p className="text-xs text-muted-foreground">{m.profiles?.email ?? m.profiles?.phone}</p>
                          </td>
                          <td className="px-4 py-3">{m.gold_plans?.name}</td>
                          <td className="px-4 py-3 text-right">
                            {formatPaise(m.amount_paid_paise)}
                            <span className="block text-xs text-muted-foreground uppercase">{m.payment_method}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{shortDate(m.starts_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{shortDate(m.ends_at)}</td>
                          <td className="px-4 py-3">
                            <Badge className={STATUS_CLASS[st]}>{STATUS_LABEL[st] ?? st}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <Pager page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q, status }} />
        </section>
      </div>
    </>
  );
}
