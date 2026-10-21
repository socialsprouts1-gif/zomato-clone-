"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { cancellationPolicy, isCancellableByCustomer, transition } from "./state-machine";

export async function cancelMyOrder(orderId: string, reason: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("id, customer_id, status").eq("id", orderId).single();
  if (!o || o.customer_id !== user.id) return { ok: false as const, error: "Order not found" };
  if (!isCancellableByCustomer(o.status)) return { ok: false as const, error: "This order can't be cancelled now. It's already on its way." };
  const policy = cancellationPolicy(o.status);
  try {
    await transition(orderId, "CANCELLED_BY_CUSTOMER", { role: "customer", id: user.id }, { patch: { cancel_reason: reason.slice(0, 200) }, note: reason.slice(0, 200) });
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Couldn't cancel" };
  }
  revalidatePath(`/orders/${orderId}`);
  return { ok: true as const, refund: policy.refund, message: policy.message };
}

export async function getCancellationPolicy(status: Parameters<typeof cancellationPolicy>[0]) {
  return cancellationPolicy(status);
}

export async function hideOrderFromHistory(orderId: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("customer_id, status").eq("id", orderId).single();
  if (!o || o.customer_id !== user.id) return { ok: false as const, error: "Order not found" };
  if (!["DELIVERED", "REJECTED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "FAILED_PAYMENT"].includes(o.status)) return { ok: false as const, error: "You can hide an order once it's finished" };
  await db.from("orders").update({ hidden_by_customer: true }).eq("id", orderId);
  revalidatePath("/orders");
  return { ok: true as const };
}
