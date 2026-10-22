import "server-only";

import { assertAdmin } from "@/lib/admin/guard";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export const PAGE_SIZE = 20;
export const STATUS_GROUPS: Record<string, OrderStatus[]> = {
  live: ACTIVE_STATUSES,
  delivered: ["DELIVERED"],
  cancelled: ["CANCELLED", "CANCELLED_BY_CUSTOMER", "REJECTED"],
  scheduled: ["SCHEDULED"],
  unpaid: ["PENDING_PAYMENT", "FAILED_PAYMENT"],
};
export const STATUS_GROUP_LABEL: Record<string, string> = {
  live: "Live (in progress)",
  delivered: "Delivered",
  cancelled: "Cancelled or rejected",
  scheduled: "Scheduled",
  unpaid: "Awaiting or failed payment",
};
export const PAYMENT_METHODS: Record<Enums<"payment_method">, string> = { razorpay: "Online (Razorpay)", cod: "Cash on delivery", wallet: "Thaali wallet" };

export type OrderFilters = { q: string; status: string; method: string; from: string; to: string; page: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(sp: Record<string, string | string[] | undefined>): OrderFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = one("status");
  const method = one("method");
  return {
    q: one("q").trim().slice(0, 80),
    status: status in STATUS_GROUPS ? status : "",
    method: method in PAYMENT_METHODS ? method : "",
    from: DATE.test(one("from")) ? one("from") : "",
    to: DATE.test(one("to")) ? one("to") : "",
    page: Math.max(1, Math.min(500, Number.parseInt(one("page"), 10) || 1)),
  };
}

function nextDay(d: string) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

/** Server-side search: order number, customer name / phone, restaurant name; status, payment method and IST date filters. */
export async function searchOrders(f: OrderFilters) {
  await assertAdmin();
  const db = getSupabaseAdminClient();
  let query = db
    .from("orders")
    .select("id, order_number, status, created_at, total_paise, payment_method, payment_status, customer_name, customer_phone, refunded_at, refund_paise, is_demo, restaurants(name), riders!orders_rider_id_fkey(name)", { count: "exact" });

  // Characters that would break the PostgREST or() syntax are dropped.
  const term = f.q.replace(/[,()*%\\:"']/g, " ").trim();
  if (term) {
    const num = term.replace(/^#/, "");
    if (/^\d+$/.test(num)) {
      query = query.or(`order_number.eq.${num.length > 15 ? 0 : num},customer_phone.ilike.%${num}%`);
    } else {
      const { data: rs } = await db.from("restaurants").select("id").ilike("name", `%${term}%`).limit(50);
      const ids = (rs ?? []).map((r) => r.id);
      query = query.or([`customer_name.ilike.%${term}%`, `customer_phone.ilike.%${term}%`, ids.length ? `restaurant_id.in.(${ids.join(",")})` : null].filter(Boolean).join(","));
    }
  }
  if (f.status) query = query.in("status", STATUS_GROUPS[f.status]!);
  if (f.method) query = query.eq("payment_method", f.method as Enums<"payment_method">);
  if (f.from) query = query.gte("created_at", new Date(`${f.from}T00:00:00+05:30`).toISOString());
  if (f.to) query = query.lt("created_at", new Date(`${nextDay(f.to)}T00:00:00+05:30`).toISOString());

  const start = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(start, start + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}
export type OrderRow = Awaited<ReturnType<typeof searchOrders>>["rows"][number];

/** Everything the order detail page shows. */
export async function loadOrderDetail(id: string) {
  await assertAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = getSupabaseAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("*, restaurants(id, name, slug, address, locality, phone, lat, lng), riders!orders_rider_id_fkey(id, name, phone, vehicle_type, vehicle_number, is_simulated, is_online), order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (!order) return null;
  const [{ data: events }, { data: customer }, { data: txns }, { data: chats }, { data: tickets }] = await Promise.all([
    db.from("order_events").select("*").eq("order_id", id).order("created_at").order("id"),
    db.from("profiles").select("id, name, email, phone").eq("id", order.customer_id).maybeSingle(),
    db.from("wallet_transactions").select("id, amount_paise, type, description, created_at").eq("reference_id", id).order("created_at"),
    db.from("chat_messages").select("id, thread, sender_role, sender_name, body, created_at").eq("order_id", id).order("created_at").limit(200),
    db.from("support_tickets").select("id, subject, status, created_at").eq("order_id", id).order("created_at"),
  ]);
  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter((x): x is string => Boolean(x)))];
  const { data: actors } = actorIds.length ? await db.from("profiles").select("id, name").in("id", actorIds) : { data: [] as { id: string; name: string | null }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.name]));
  return {
    order,
    customer,
    events: (events ?? []).map((e) => ({ ...e, actor_name: e.actor_id ? (actorName.get(e.actor_id) ?? null) : null })),
    walletTxns: txns ?? [],
    chats: chats ?? [],
    tickets: tickets ?? [],
  };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;
