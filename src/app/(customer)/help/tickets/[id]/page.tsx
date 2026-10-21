import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TicketChat } from "@/components/support/ticket-chat";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support chat" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/help/tickets/${id}`);
  const supabase = await getSupabaseServerClient();
  const { data: t } = await supabase.from("support_tickets").select("*, orders(id, order_number), support_messages(id, sender_role, body, created_at)").eq("id", id).maybeSingle();
  if (!t) notFound();
  const messages = [...t.support_messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t.subject}
        description={t.orders ? undefined : "General question"}
        actions={
          t.orders ? (
            <Link href={`/orders/${t.orders.id}`} className="text-sm font-semibold text-primary">
              Order #{t.orders.order_number}
            </Link>
          ) : null
        }
      />
      <TicketChat ticketId={t.id} messages={messages} as="customer" status={t.status} />
    </div>
  );
}
