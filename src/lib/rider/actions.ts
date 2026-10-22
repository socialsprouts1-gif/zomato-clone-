"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { haversineKm } from "@/lib/geo";
import { notify } from "@/lib/notifications";
import { assignRider } from "@/lib/orders/dispatch";
import { transition } from "@/lib/orders/state-machine";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function me() {
  const user = await getSessionUser();
  if (!user || (user.profile.role !== "rider" && user.profile.role !== "admin")) throw new Error("Sign in as a delivery partner");
  return user;
}

async function myActiveOrder(riderId: string, orderId: string) {
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!o || o.rider_id !== riderId) throw new Error("This delivery isn't assigned to you");
  return o;
}

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    revalidatePath("/rider");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function setRiderOnline(online: boolean, pos?: { lat: number; lng: number }) {
  return wrap(async () => {
    const user = await me();
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("riders")
      .update({ is_online: online, last_seen_at: new Date().toISOString(), ...(pos ? { current_lat: pos.lat, current_lng: pos.lng } : {}) })
      .eq("id", user.id);
    if (error) throw new Error(error.message.includes("not approved") ? "Your account is still under review." : error.message);
  });
}

export async function updateRiderLocation(pos: { lat: number; lng: number; heading?: number }, orderId?: string | null) {
  return wrap(async () => {
    const user = await me();
    const p = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), heading: z.number().optional() }).parse(pos);
    const supabase = await getSupabaseServerClient();
    await supabase.from("riders").update({ current_lat: p.lat, current_lng: p.lng, last_seen_at: new Date().toISOString() }).eq("id", user.id);
    await supabase.from("rider_locations").insert({ rider_id: user.id, order_id: orderId ?? null, lat: p.lat, lng: p.lng, heading: p.heading ?? null });
  });
}

export async function respondToOffer(offerId: string, accept: boolean) {
  return wrap(async () => {
    const user = await me();
    const db = getSupabaseAdminClient();
    const { data: offer } = await db.from("rider_offers").select("*").eq("id", offerId).single();
    if (!offer || offer.rider_id !== user.id) throw new Error("Request not found");
    if (offer.status !== "pending" || new Date(offer.expires_at) < new Date()) throw new Error("This request has expired");
    if (!accept) {
      await db.from("rider_offers").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", offerId);
      return { orderId: null as string | null };
    }
    const assigned = await assignRider(offer.order_id, user.id, "Rider accepted");
    if (!assigned) {
      await db.from("rider_offers").update({ status: "expired" }).eq("id", offerId);
      throw new Error("Another rider took this order");
    }
    await db.from("rider_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", offerId);
    return { orderId: offer.order_id as string | null };
  });
}

export async function reachedRestaurant(orderId: string) {
  return wrap(async () => {
    const user = await me();
    await myActiveOrder(user.id, orderId);
    await getSupabaseAdminClient().from("orders").update({ rider_at_restaurant_at: new Date().toISOString() }).eq("id", orderId).is("rider_at_restaurant_at", null);
  });
}

export async function confirmPickup(orderId: string, orderNumberLast4: string) {
  return wrap(async () => {
    const user = await me();
    const o = await myActiveOrder(user.id, orderId);
    if (!String(o.order_number).endsWith(orderNumberLast4.trim()) || orderNumberLast4.trim().length < 3) throw new Error("That order ID doesn't match. Check the bill on the bag.");
    if (o.status === "PREPARING" || o.status === "ACCEPTED") throw new Error("The food isn't ready yet. Ask the restaurant to mark it ready.");
    if (o.status === "READY") await transition(orderId, "RIDER_ASSIGNED", { role: "system", id: null });
    await transition(orderId, "PICKED_UP", { role: "rider", id: user.id }, { note: "Order ID confirmed" });
  });
}

export async function startDelivery(orderId: string) {
  return wrap(async () => {
    const user = await me();
    await myActiveOrder(user.id, orderId);
    await transition(orderId, "OUT_FOR_DELIVERY", { role: "rider", id: user.id });
  });
}

export async function completeDelivery(orderId: string, otp: string, cashCollected: boolean) {
  return wrap(async () => {
    const user = await me();
    const o = await myActiveOrder(user.id, orderId);
    if (otp.trim() !== o.delivery_otp) throw new Error("Wrong OTP. Ask the customer for the 4-digit code in their app.");
    const cod = o.payment_method === "cod" && o.payable_paise > 0;
    if (cod && !cashCollected) throw new Error(`Collect ₹${Math.round(o.payable_paise / 100)} in cash before completing.`);
    await transition(orderId, "DELIVERED", { role: "rider", id: user.id }, { note: "Delivery OTP verified", patch: cod ? { payment_status: "cod_collected" } : {} });
    if (cod) {
      const db = getSupabaseAdminClient();
      const { data: r } = await db.from("riders").select("floating_cash_paise").eq("id", user.id).single();
      await db.from("riders").update({ floating_cash_paise: (r?.floating_cash_paise ?? 0) + o.payable_paise }).eq("id", user.id);
    }
  });
}

export async function depositCash(amountPaise: number) {
  return wrap(async () => {
    const user = await me();
    const db = getSupabaseAdminClient();
    const { data: r } = await db.from("riders").select("floating_cash_paise").eq("id", user.id).single();
    const amount = Math.min(z.number().int().positive().parse(amountPaise), r?.floating_cash_paise ?? 0);
    if (amount <= 0) throw new Error("Nothing to deposit");
    await db.from("rider_cash_deposits").insert({ rider_id: user.id, amount_paise: amount, reference: `DEP${Date.now().toString(36).toUpperCase()}` });
    await db.from("riders").update({ floating_cash_paise: (r?.floating_cash_paise ?? 0) - amount }).eq("id", user.id);
  });
}

/** Demo GPS: move the rider ~150 m (or the rest of the way) toward the current target. */
export async function simulateRiderStep(orderId: string) {
  return wrap(async () => {
    const user = await me();
    const o = await myActiveOrder(user.id, orderId);
    const db = getSupabaseAdminClient();
    const [{ data: rider }, { data: r }] = await Promise.all([
      db.from("riders").select("current_lat, current_lng").eq("id", user.id).single(),
      db.from("restaurants").select("lat, lng").eq("id", o.restaurant_id).single(),
    ]);
    if (!rider || !r) return { arrived: false };
    const target = ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(o.status) ? (o.delivery_address as { lat: number; lng: number }) : r;
    const from = { lat: rider.current_lat ?? r.lat, lng: rider.current_lng ?? r.lng };
    const dist = haversineKm(from.lat, from.lng, target.lat, target.lng);
    const t = dist <= 0.15 ? 1 : 0.15 / dist;
    const pos = { lat: from.lat + (target.lat - from.lat) * t, lng: from.lng + (target.lng - from.lng) * t };
    await db.from("riders").update({ current_lat: pos.lat, current_lng: pos.lng, last_seen_at: new Date().toISOString() }).eq("id", user.id);
    await db.from("rider_locations").insert({ rider_id: user.id, order_id: orderId, lat: pos.lat, lng: pos.lng });
    return { arrived: t === 1 };
  });
}

export async function triggerSos(orderId: string | null) {
  return wrap(async () => {
    const user = await me();
    const db = getSupabaseAdminClient();
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
    for (const a of admins ?? []) await notify(a.id, { title: "Rider SOS", body: `${user.profile.name} pressed SOS${orderId ? " during a delivery" : ""}.`, link: "/admin/riders", type: "rider" });
    await db.from("admin_audit_log").insert({ admin_id: null, action: "rider_sos", entity_type: "rider", entity_id: user.id, details: { orderId } });
  });
}

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().regex(/^\+?\d{10,13}$/, "Enter a valid phone number"),
  vehicle_type: z.enum(["bicycle", "scooter", "motorcycle", "ev_scooter"]),
  vehicle_number: z.string().trim().max(15).optional(),
  bank_account_name: z.string().trim().min(2).max(60),
  bank_account_number: z.string().trim().regex(/^\d{9,18}$/, "9–18 digit account number"),
  bank_ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"),
  // Object paths in the private rider-docs bucket, inside the rider's own folder (checked below).
  driving_license_url: z.string().regex(/^[0-9a-f-]{36}\/[\w.-]+$/).nullable().optional(),
  vehicle_rc_url: z.string().regex(/^[0-9a-f-]{36}\/[\w.-]+$/).nullable().optional(),
});
export type RiderApplication = z.input<typeof applicationSchema>;

/** Rider onboarding: creates a pending rider profile for admin approval. */
export async function submitRiderApplication(input: RiderApplication): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in first" };
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;
  if (v.vehicle_type !== "bicycle" && !v.vehicle_number) return { ok: false, error: "Enter your vehicle number" };
  if ([v.driving_license_url, v.vehicle_rc_url].some((p) => p && !p.startsWith(`${user.id}/`))) return { ok: false, error: "Upload your documents again" };
  const db = getSupabaseAdminClient();
  const { error } = await db.from("riders").upsert({ id: user.id, name: v.name, phone: v.phone, vehicle_type: v.vehicle_type, vehicle_number: v.vehicle_number ?? null, status: "pending" });
  if (error) return { ok: false, error: error.message };
  await db.from("rider_private").upsert({
    rider_id: user.id,
    bank_account_name: v.bank_account_name,
    bank_account_number_masked: `XXXXXX${v.bank_account_number.slice(-4)}`,
    bank_ifsc: v.bank_ifsc,
    driving_license_url: v.driving_license_url ?? null,
    vehicle_rc_url: v.vehicle_rc_url ?? null,
  });
  if (user.profile.role === "customer") await db.from("profiles").update({ role: "rider", name: user.profile.name || v.name, phone: user.profile.phone ?? v.phone }).eq("id", user.id);
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
  for (const a of admins ?? []) await notify(a.id, { title: "New rider application", body: `${v.name} · ${v.vehicle_type}`, link: "/admin/riders", type: "info" });
  revalidatePath("/rider");
  return { ok: true };
}
