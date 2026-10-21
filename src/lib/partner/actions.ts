"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { acceptOrder } from "@/lib/orders/actions-core";
import { transition, TransitionError } from "@/lib/orders/state-machine";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { OUTLET_COOKIE } from "./context";
import { loadLiveOrders } from "./orders";

type Result = { ok: true } | { ok: false; error: string };

/** Confirms the caller works at the restaurant that owns this order. */
async function guardOrder(orderId: string) {
  const user = await getSessionUser();
  if (!user) throw new TransitionError("Please sign in again");
  const supabase = await getSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("id, restaurant_id").eq("id", orderId).maybeSingle();
  if (!order) throw new TransitionError("Order not found");
  const { data: member } = await supabase.rpc("is_restaurant_member", { rid: order.restaurant_id });
  if (!member && user.profile.role !== "admin") throw new TransitionError("You don't manage this restaurant");
  return { user, order };
}

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
    revalidatePath("/partner");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function partnerAccept(orderId: string, prepMinutes: number) {
  return run(async () => {
    const { user } = await guardOrder(orderId);
    const prep = z.number().int().min(5).max(90).parse(prepMinutes);
    await acceptOrder(orderId, prep, { role: "restaurant", id: user.id });
  });
}

export async function partnerReject(orderId: string, reason: string) {
  return run(async () => {
    const { user } = await guardOrder(orderId);
    const why = z.string().trim().min(2).max(120).parse(reason);
    await transition(orderId, "REJECTED", { role: "restaurant", id: user.id }, { patch: { reject_reason: why }, note: why });
  });
}

export async function partnerMarkReady(orderId: string) {
  return run(async () => {
    const { user } = await guardOrder(orderId);
    await transition(orderId, "READY", { role: "restaurant", id: user.id });
  });
}

export async function partnerHandOver(orderId: string) {
  return run(async () => {
    const { user } = await guardOrder(orderId);
    await transition(orderId, "PICKED_UP", { role: "restaurant", id: user.id }, { note: "Handed over to rider" });
  });
}

export async function fetchLiveOrders(restaurantId: string) {
  return loadLiveOrders(restaurantId);
}

async function guardRestaurant(restaurantId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again");
  const supabase = await getSupabaseServerClient();
  const { data: member } = await supabase.rpc("is_restaurant_member", { rid: restaurantId });
  if (!member && user.profile.role !== "admin") throw new Error("You don't manage this restaurant");
  return user;
}

export async function setOutletOnline(restaurantId: string, online: boolean) {
  return run(async () => {
    await guardRestaurant(restaurantId);
    const db = getSupabaseAdminClient();
    await db.from("restaurants").update({ is_online: online, ...(online ? { busy_until: null } : {}) }).eq("id", restaurantId);
  });
}

export async function setOutletBusy(restaurantId: string, minutes: number | null) {
  return run(async () => {
    await guardRestaurant(restaurantId);
    const db = getSupabaseAdminClient();
    await db.from("restaurants").update({ busy_until: minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null }).eq("id", restaurantId);
  });
}

export async function setAutoAccept(restaurantId: string, on: boolean) {
  return run(async () => {
    await guardRestaurant(restaurantId);
    const db = getSupabaseAdminClient();
    await db.from("restaurants").update({ auto_accept: on }).eq("id", restaurantId);
  });
}

export async function selectOutlet(restaurantId: string) {
  return run(async () => {
    await guardRestaurant(restaurantId);
    const jar = await cookies();
    jar.set(OUTLET_COOKIE, restaurantId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    revalidatePath("/partner", "layout");
  });
}
