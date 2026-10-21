"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notifications";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

const ticketSchema = z.object({
  orderId: z.string().uuid().nullable(),
  category: z.enum(["order", "payment", "account", "rider", "restaurant", "other"]),
  subject: z.string().trim().min(3, "Tell us what went wrong").max(120),
  message: z.string().trim().min(5, "Add a few details").max(2000),
});
export type TicketInput = z.input<typeof ticketSchema>;

export async function createTicket(input: TicketInput) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data: t, error } = await supabase.from("support_tickets").insert({ user_id: user.id, order_id: v.orderId, category: v.category, subject: v.subject }).select("id").single();
  if (error || !t) return { ok: false as const, error: error?.message ?? "Couldn't create the ticket" };
  const db = getSupabaseAdminClient();
  await db.from("support_messages").insert([
    { ticket_id: t.id, sender_id: user.id, sender_role: "customer", body: v.message },
    { ticket_id: t.id, sender_id: null, sender_role: "bot", body: `Thanks ${user.profile.name?.split(" ")[0] ?? ""}! We've got your request (#${t.id.slice(0, 6).toUpperCase()}). A support agent will reply here, usually within a few minutes.` },
  ]);
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
  for (const a of admins ?? []) await notify(a.id, { title: "New support ticket", body: v.subject, link: "/admin/support", type: "support" });
  revalidatePath("/help");
  return { ok: true as const, id: t.id };
}

export async function sendSupportMessage(ticketId: string, body: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const text = z.string().trim().min(1).max(2000).parse(body);
  const supabase = await getSupabaseServerClient();
  const role = user.profile.role === "admin" ? "agent" : "customer";
  const { error } = await supabase.from("support_messages").insert({ ticket_id: ticketId, sender_id: user.id, sender_role: role, body: text });
  if (error) return { ok: false as const, error: "Couldn't send" };
  const db = getSupabaseAdminClient();
  const { data: t } = await db.from("support_tickets").select("user_id, subject").eq("id", ticketId).single();
  await db.from("support_tickets").update({ status: role === "agent" ? "pending" : "open" }).eq("id", ticketId);
  if (role === "agent" && t) await notify(t.user_id, { title: "Support replied", body: text.slice(0, 100), link: `/help/tickets/${ticketId}`, type: "support" });
  return { ok: true as const };
}

export async function resolveTicket(ticketId: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const db = getSupabaseAdminClient();
  const { data: t } = await db.from("support_tickets").select("user_id").eq("id", ticketId).single();
  if (!t || (t.user_id !== user.id && user.profile.role !== "admin")) return { ok: false as const, error: "Not allowed" };
  await db.from("support_tickets").update({ status: "resolved" }).eq("id", ticketId);
  await db.from("support_messages").insert({ ticket_id: ticketId, sender_id: null, sender_role: "bot", body: "This conversation was marked as resolved. Reply any time to reopen it." });
  revalidatePath(`/help/tickets/${ticketId}`);
  return { ok: true as const };
}

export async function markNotificationsRead(ids?: string[]) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const };
  const supabase = await getSupabaseServerClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  await q;
  revalidatePath("/notifications");
  return { ok: true as const };
}
