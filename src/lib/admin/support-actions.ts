"use server";

import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import { notify } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const id = z.string().uuid();
const paths = (ticketId: string) => ["/admin/support", `/admin/support/${ticketId}`, `/help/tickets/${ticketId}`, "/help"];

async function loadTicket(ticketId: string) {
  const { data: t } = await getSupabaseAdminClient().from("support_tickets").select("id, user_id, subject, status").eq("id", ticketId).maybeSingle();
  if (!t) throw new Error("Ticket not found");
  return t;
}

/** Agent reply: posts the message, moves the ticket to "pending" (waiting on the customer) and notifies them. */
export async function replyToTicket(ticketId: string, body: string) {
  return adminAction(async (admin) => {
    const tid = id.parse(ticketId);
    const text = z.string().trim().min(1, "Write a reply").max(2000).parse(body);
    const t = await loadTicket(tid);
    const db = getSupabaseAdminClient();
    const { error } = await db.from("support_messages").insert({ ticket_id: tid, sender_id: admin.id, sender_role: "agent", body: text });
    if (error) throw new Error("Couldn't send the reply");
    await db.from("support_tickets").update({ status: "pending" }).eq("id", tid);
    await notify(t.user_id, { title: "Support replied", body: text.slice(0, 100), link: `/help/tickets/${tid}`, type: "support" });
    return { audit: { action: "support.reply", entityType: "support_ticket", entityId: tid, details: { subject: t.subject, from_status: t.status, preview: text.slice(0, 120) } } };
  }, paths(ticketId));
}

/** Resolve or reopen a ticket. A system note is added to the conversation either way. */
export async function setTicketStatus(ticketId: string, status: "resolved" | "open") {
  return adminAction(async () => {
    const tid = id.parse(ticketId);
    const next = z.enum(["resolved", "open"]).parse(status);
    const t = await loadTicket(tid);
    if (t.status === next) return;
    const db = getSupabaseAdminClient();
    await db.from("support_tickets").update({ status: next }).eq("id", tid);
    await db.from("support_messages").insert({
      ticket_id: tid,
      sender_id: null,
      sender_role: "bot",
      body: next === "resolved" ? "This conversation was marked as resolved. Reply any time to reopen it." : "Support reopened this conversation.",
    });
    if (next === "resolved") await notify(t.user_id, { title: "Ticket resolved", body: t.subject, link: `/help/tickets/${tid}`, type: "support" });
    return { audit: { action: next === "resolved" ? "support.resolve" : "support.reopen", entityType: "support_ticket", entityId: tid, details: { subject: t.subject, from_status: t.status } } };
  }, paths(ticketId));
}

/** Single-argument resolve, for the shared chat component's resolve button. */
export async function resolveTicketAsAgent(ticketId: string) {
  return setTicketStatus(ticketId, "resolved");
}
