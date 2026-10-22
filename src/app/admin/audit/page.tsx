import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { auditEntityHref, auditEntityLabel } from "@/components/admin/audit/entity-link";
import { fmtDateTime, Pagination, parsePage, type ListParams } from "@/components/admin/restaurants/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isIsoDate } from "@/lib/payouts/dates";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 25;
const BASE = "/admin/audit";
const selectCls = "h-10 w-full rounded-xl border bg-background px-3 text-sm";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; admin?: string; from?: string; to?: string; page?: string }> }) {
  const sp = await searchParams;
  const action = sp.action && /^[a-z_]+(\.[a-z_]+)?$/.test(sp.action) ? sp.action : undefined;
  const adminId = sp.admin && /^[0-9a-f-]{36}$/i.test(sp.admin) ? sp.admin : undefined;
  const from = isIsoDate(sp.from) ? sp.from : undefined;
  const to = isIsoDate(sp.to) ? sp.to : undefined;
  const page = parsePage(sp.page);
  const params: ListParams = { action, admin: adminId, from, to, page: sp.page };
  const db = await getSupabaseServerClient();

  let list = db
    .from("admin_audit_log")
    .select("id, action, entity_type, entity_id, details, created_at, profiles(id, name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // "payout" matches payout.*; "payout.adjust" matches exactly.
  if (action) list = action.includes(".") ? list.eq("action", action) : list.like("action", `${action}.%`);
  if (adminId) list = list.eq("admin_id", adminId);
  if (from) list = list.gte("created_at", new Date(`${from}T00:00:00+05:30`).toISOString());
  if (to) list = list.lt("created_at", new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000).toISOString());

  const [{ data, count, error }, { data: admins }, { data: recent }] = await Promise.all([
    list,
    db.from("profiles").select("id, name, email").eq("role", "admin").order("name"),
    db.from("admin_audit_log").select("action").order("created_at", { ascending: false }).limit(2000),
  ]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const prefixes = [...new Set([...(recent ?? []).map((r) => r.action.split(".")[0]!), ...(action ? [action.split(".")[0]!] : [])])].sort();
  const filtered = Boolean(action || adminId || from || to);

  return (
    <>
      <PageHeader title="Audit log" description="Every admin action, newest first. Read-only." />
      <form action={BASE} method="get" className="mb-5 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_10rem_10rem_auto] lg:items-end" aria-label="Filter audit log">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <select id="audit-action" name="action" defaultValue={action ?? ""} className={selectCls}>
            <option value="">All actions</option>
            {prefixes.map((p) => (
              <option key={p} value={p}>
                {p}.*
              </option>
            ))}
            {action?.includes(".") ? <option value={action}>{action}</option> : null}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-admin">Admin</Label>
          <select id="audit-admin" name="admin" defaultValue={adminId ?? ""} className={selectCls}>
            <option value="">Any admin</option>
            {(admins ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email ?? a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" name="from" type="date" defaultValue={from ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" name="to" type="date" defaultValue={to ?? ""} />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href={BASE}>Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={filtered ? "No entries match these filters" : "No admin actions yet"} description="Approvals, refunds, payouts and every other admin change are recorded here." />
      ) : (
        <>
          <ol className="divide-y rounded-2xl border bg-card shadow-sm" aria-label="Audit entries">
            {rows.map((r) => {
              const href = auditEntityHref(r.entity_type, r.entity_id, r.details);
              const hasDetails = r.details && typeof r.details === "object" && Object.keys(r.details).length > 0;
              const entity = `${auditEntityLabel(r.entity_type)}${r.entity_id ? ` ${r.entity_id.length > 12 ? r.entity_id.slice(0, 8) : r.entity_id}` : ""}`;
              return (
                <li key={r.id} className="space-y-1.5 px-4 py-3 text-sm" data-testid="audit-row">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="secondary" className="font-mono" data-testid="audit-action">
                      {r.action}
                    </Badge>
                    {href ? (
                      <Link href={href} className="font-medium text-primary hover:underline" data-testid="audit-entity">
                        {entity}
                      </Link>
                    ) : (
                      <span className="font-medium" data-testid="audit-entity">
                        {entity}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.profiles?.name ?? r.profiles?.email ?? "Deleted admin"} · <time dateTime={r.created_at}>{fmtDateTime(r.created_at)}</time>
                    </span>
                  </div>
                  {hasDetails ? (
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground select-none hover:text-foreground">Details</summary>
                      <pre className="mt-1.5 max-h-80 overflow-auto rounded-xl bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">{JSON.stringify(r.details, null, 2)}</pre>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </>
      )}
    </>
  );
}
