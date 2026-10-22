import { ChevronRight, Headset } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterTabs, fmtDateTime, ilikeTerm, ListSearch, Pagination, parsePage, type ListParams } from "@/components/admin/restaurants/list-controls";
import { shortTicketId, TICKET_STATUSES, ticketCategoryLabel, ticketStatusBadge, type TicketStatus } from "@/components/admin/support/ticket-meta";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support" };

const PAGE_SIZE = 20;
const BASE = "/admin/support";

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const status = TICKET_STATUSES.includes(sp.status as TicketStatus) ? (sp.status as TicketStatus) : undefined;
  const page = parsePage(sp.page);
  const params: ListParams = { q, status, page: sp.page };
  const supabase = await getSupabaseServerClient();

  // Search: subject, customer name / email / phone, or order number.
  const ors: string[] = [];
  if (q) {
    ors.push(`subject.ilike.${ilikeTerm(q)}`);
    const { data: people } = await supabase.from("profiles").select("id").or(`name.ilike.${ilikeTerm(q)},email.ilike.${ilikeTerm(q)},phone.ilike.${ilikeTerm(q)}`).limit(50);
    if (people?.length) ors.push(`user_id.in.(${people.map((p) => p.id).join(",")})`);
    const num = q.replace(/^#/, "");
    if (/^\d{1,9}$/.test(num)) {
      const { data: orders } = await supabase.from("orders").select("id").eq("order_number", Number(num)).limit(5);
      if (orders?.length) ors.push(`order_id.in.(${orders.map((o) => o.id).join(",")})`);
    }
  }

  let list = supabase
    .from("support_tickets")
    .select("id, subject, category, status, created_at, updated_at, orders(id, order_number), profiles(name, email), support_messages(body, sender_role, created_at)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("created_at", { referencedTable: "support_messages", ascending: false })
    .limit(1, { referencedTable: "support_messages" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) list = list.eq("status", status);
  if (ors.length) list = list.or(ors.join(","));

  const counts = await Promise.all(TICKET_STATUSES.map((s) => supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", s).then((r) => r.count ?? 0)));
  const { data, count, error } = await list;
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  return (
    <>
      <PageHeader title="Support" description="Customer tickets. Replies reach the customer's help chat instantly." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          base={BASE}
          params={params}
          paramKey="status"
          label="Ticket status"
          options={[{ value: "all", label: "All", count: counts.reduce((a, b) => a + b, 0) }, ...TICKET_STATUSES.map((s, i) => ({ value: s, label: ticketStatusBadge[s].label, count: counts[i] }))]}
        />
        <ListSearch base={BASE} params={params} placeholder="Subject, customer or order #" label="Search tickets" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Headset} title={q ? "No tickets match your search" : "Inbox zero"} description={q ? "Try a customer name, email or order number." : "Tickets with this status show up here."} />
      ) : (
        <>
          <ul className="space-y-3" aria-label="Tickets">
            {rows.map((t) => {
              const b = ticketStatusBadge[t.status as TicketStatus];
              const last = t.support_messages[0];
              return (
                <li key={t.id}>
                  <Card className="p-0 transition hover:shadow-md">
                    <Link href={`${BASE}/${t.id}`} className="flex items-center gap-3 p-4" data-testid="admin-ticket-row" aria-label={`Ticket ${t.subject}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{t.subject}</p>
                          <Badge variant={b.variant}>{b.label}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {t.profiles?.name ?? t.profiles?.email ?? "Customer"} · {ticketCategoryLabel[t.category] ?? t.category}
                          {t.orders ? ` · Order #${t.orders.order_number}` : ""}
                        </p>
                        {last ? (
                          <p className="mt-1 line-clamp-1 text-sm">
                            <span className="text-muted-foreground">{last.sender_role === "agent" ? "You: " : last.sender_role === "bot" ? "Assistant: " : ""}</span>
                            {last.body}
                          </p>
                        ) : null}
                      </div>
                      <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                        <p className="font-mono">{shortTicketId(t.id)}</p>
                        <p>{fmtDateTime(t.updated_at)}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
          <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </>
      )}
    </>
  );
}
