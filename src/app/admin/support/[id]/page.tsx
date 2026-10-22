import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDateTime } from "@/components/admin/restaurants/list-controls";
import { shortTicketId, ticketCategoryLabel, ticketStatusBadge, type TicketStatus } from "@/components/admin/support/ticket-meta";
import { TicketStatusButton } from "@/components/admin/support/ticket-status-button";
import { PageHeader } from "@/components/shared/page-header";
import { TicketChat } from "@/components/support/ticket-chat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { replyToTicket, resolveTicketAsAgent } from "@/lib/admin/support-actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Support ticket" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await getSupabaseServerClient();
  const { data: t } = await supabase
    .from("support_tickets")
    .select("*, orders(id, order_number, status, payable_paise, created_at, restaurants(name)), profiles(id, name, email, phone), support_messages(id, sender_role, body, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const messages = [...t.support_messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const b = ticketStatusBadge[t.status as TicketStatus];
  const { count: otherTickets } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", t.user_id).neq("id", t.id);

  return (
    <>
      <Link href="/admin/support" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All tickets
      </Link>
      <PageHeader title={t.subject} description={`${shortTicketId(t.id)} · ${ticketCategoryLabel[t.category] ?? t.category} · opened ${fmtDateTime(t.created_at)}`} actions={t.status === "resolved" ? <TicketStatusButton ticketId={t.id} status={t.status} /> : undefined} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <TicketChat ticketId={t.id} messages={messages} as="agent" status={t.status} sendAction={replyToTicket} resolveAction={resolveTicketAsAgent} />
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Status</h2>
                <Badge variant={b.variant} data-testid="ticket-status">
                  {b.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Last activity {fmtDateTime(t.updated_at)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4 text-sm">
              <h2 className="mb-1 font-semibold">Customer</h2>
              <p>{t.profiles?.name ?? "Unnamed customer"}</p>
              {t.profiles?.email ? <p className="text-muted-foreground">{t.profiles.email}</p> : null}
              {t.profiles?.phone ? <p className="text-muted-foreground">{t.profiles.phone}</p> : null}
              <p className="text-xs text-muted-foreground">{otherTickets ? `${otherTickets} other ticket${otherTickets === 1 ? "" : "s"}` : "First ticket"}</p>
              {t.profiles ? (
                <Link href={`/admin/users/${t.profiles.id}`} className="inline-block pt-1 font-semibold text-primary hover:underline">
                  View customer
                </Link>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4 text-sm">
              <h2 className="mb-1 font-semibold">Linked order</h2>
              {t.orders ? (
                <>
                  <Link href={`/admin/orders/${t.orders.id}`} className="font-semibold text-primary hover:underline" data-testid="ticket-order-link">
                    Order #{t.orders.order_number}
                  </Link>
                  <p className="text-muted-foreground">
                    {t.orders.restaurants?.name} · {formatPaise(t.orders.payable_paise)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.orders.status.replaceAll("_", " ").toLowerCase()} · {fmtDateTime(t.orders.created_at)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">General question, no order attached.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
