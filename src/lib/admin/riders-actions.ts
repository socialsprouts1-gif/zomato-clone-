"use server";

import { z } from "zod";
import { adminAction, AdminError, assertAdmin } from "@/lib/admin/guard";
import { notify } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const id = z.string().uuid();
const reasonSchema = z.string().trim().min(3, "Give a reason").max(300);
const paths = (rid: string) => ["/admin/riders", `/admin/riders/${rid}`, "/rider"];

async function load(riderId: string) {
  const { data, error } = await getSupabaseAdminClient().from("riders").select("id, name, status, current_order_id").eq("id", id.parse(riderId)).maybeSingle();
  if (error) throw new AdminError(error.message);
  if (!data) throw new AdminError("Rider not found");
  return data;
}

async function update(riderId: string, patch: { status: "approved" | "rejected" | "suspended"; is_online?: boolean }) {
  const { error } = await getSupabaseAdminClient().from("riders").update(patch).eq("id", riderId);
  if (error) throw new AdminError(error.message);
}

export async function approveRider(riderId: string) {
  return adminAction(async () => {
    const r = await load(riderId);
    if (r.status !== "pending" && r.status !== "rejected") throw new AdminError("Only pending applications can be approved");
    await update(r.id, { status: "approved" });
    await notify(r.id, { title: "You're approved to deliver", body: "Welcome to Thaali! Go online from the rider app to start receiving orders.", link: "/rider", type: "rider" });
    return { audit: { action: "rider.approve", entityType: "rider", entityId: r.id, details: { name: r.name, from: r.status } } };
  }, paths(riderId));
}

export async function rejectRider(riderId: string, reason: string) {
  return adminAction(async () => {
    const r = await load(riderId);
    const why = reasonSchema.parse(reason);
    if (r.status !== "pending") throw new AdminError("Only pending applications can be rejected");
    await update(r.id, { status: "rejected", is_online: false });
    await notify(r.id, { title: "Your rider application wasn't approved", body: `Reason: ${why}`, link: "/rider", type: "rider" });
    return { audit: { action: "rider.reject", entityType: "rider", entityId: r.id, details: { name: r.name, reason: why } } };
  }, paths(riderId));
}

export async function suspendRider(riderId: string, reason: string) {
  return adminAction(async () => {
    const r = await load(riderId);
    const why = reasonSchema.parse(reason);
    if (r.status !== "approved") throw new AdminError("Only active riders can be suspended");
    if (r.current_order_id) throw new AdminError("This rider is on a delivery right now. Reassign the order first.");
    await update(r.id, { status: "suspended", is_online: false });
    await notify(r.id, { title: "Your rider account is suspended", body: `Reason: ${why}`, link: "/rider", type: "rider" });
    return { audit: { action: "rider.suspend", entityType: "rider", entityId: r.id, details: { name: r.name, reason: why } } };
  }, paths(riderId));
}

export async function unsuspendRider(riderId: string) {
  return adminAction(async () => {
    const r = await load(riderId);
    if (r.status !== "suspended") throw new AdminError("This rider isn't suspended");
    await update(r.id, { status: "approved" });
    await notify(r.id, { title: "Your rider account is active again", body: "You can go online and receive orders.", link: "/rider", type: "rider" });
    return { audit: { action: "rider.unsuspend", entityType: "rider", entityId: r.id, details: { name: r.name } } };
  }, paths(riderId));
}

export type RiderLivePosition = { lat: number; lng: number; at: string | null; isOnline: boolean; currentOrderId: string | null } | null;

/** Latest known position of a rider (read-only; polled by the live map). */
export async function fetchRiderPosition(riderId: string): Promise<RiderLivePosition> {
  await assertAdmin();
  const db = getSupabaseAdminClient();
  const [{ data: r }, { data: loc }] = await Promise.all([
    db.from("riders").select("current_lat, current_lng, last_seen_at, is_online, current_order_id").eq("id", id.parse(riderId)).maybeSingle(),
    db.from("rider_locations").select("lat, lng, created_at").eq("rider_id", riderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!r) return null;
  const fromTrail = loc && (!r.last_seen_at || new Date(loc.created_at) > new Date(r.last_seen_at));
  const lat = fromTrail ? loc.lat : r.current_lat;
  const lng = fromTrail ? loc.lng : r.current_lng;
  if (lat == null || lng == null) return null;
  return { lat, lng, at: fromTrail ? loc.created_at : r.last_seen_at, isOnline: r.is_online, currentOrderId: r.current_order_id };
}
