import "server-only";

import { isDemoMode } from "@/lib/env";
import { bearing, haversineKm } from "@/lib/geo";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { assignSimulatedRider, HUMAN_GRACE_SECONDS, offerToNearestHuman } from "./dispatch";
import { transition } from "./state-machine";

type Order = Tables<"orders">;

/** Demo speeds: a rider reaches the restaurant in ~20 s and the customer in ~30 s, moving every 2 s. */
const TO_RESTAURANT_S = 20;
const TO_CUSTOMER_S = 30;
const PICKUP_DWELL_S = 3;
const DOOR_DWELL_S = 3;

const lerp = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number) => ({
  lat: a.lat + (b.lat - a.lat) * Math.min(1, Math.max(0, t)),
  lng: a.lng + (b.lng - a.lng) * Math.min(1, Math.max(0, t)),
});
const secondsSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 1000 : 0);

const ACTIVE = ["ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"] as const;

/**
 * Advances dispatch and simulated riders for one order (or all active ones).
 * Pure function of timestamps, so it's safe to call from many tabs at once.
 */
export async function tickOrders(orderId?: string) {
  const db = getSupabaseAdminClient();
  let q = db.from("orders").select("*").in("status", [...ACTIVE]);
  if (orderId) q = q.eq("id", orderId);
  const { data: orders } = await q.limit(40);
  for (const o of orders ?? []) {
    try {
      await tickOne(o);
    } catch {
      // another tick moved it first; next tick will continue
    }
  }
  // Expire stale offers.
  await db.from("rider_offers").update({ status: "expired" }).eq("status", "pending").lt("expires_at", new Date().toISOString());
}

async function tickOne(o: Order) {
  const db = getSupabaseAdminClient();
  if (!o.rider_id) {
    const { data: offers } = await db.from("rider_offers").select("rider_id, status, created_at, expires_at").eq("order_id", o.id).order("created_at", { ascending: false });
    const pending = offers?.find((x) => x.status === "pending" && new Date(x.expires_at) > new Date());
    const waited = secondsSince(o.accepted_at);
    if (isDemoMode && waited >= HUMAN_GRACE_SECONDS) {
      await db.from("rider_offers").update({ status: "expired" }).eq("order_id", o.id).eq("status", "pending");
      await assignSimulatedRider(o);
    } else if (!pending) {
      await offerToNearestHuman(o, (offers ?? []).map((x) => x.rider_id));
    }
    return;
  }

  const { data: rider } = await db.from("riders").select("id, is_simulated, current_lat, current_lng").eq("id", o.rider_id).single();
  if (!rider?.is_simulated) return; // humans move themselves

  const { data: r } = await db.from("restaurants").select("lat, lng").eq("id", o.restaurant_id).single();
  if (!r) return;
  const home = o.delivery_address as { lat: number; lng: number };
  const { data: first } = await db.from("rider_locations").select("lat, lng").eq("order_id", o.id).order("id", { ascending: true }).limit(1).maybeSingle();
  const start = first ?? { lat: rider.current_lat ?? r.lat, lng: rider.current_lng ?? r.lng };

  let pos = { lat: rider.current_lat ?? start.lat, lng: rider.current_lng ?? start.lng };
  if (!o.rider_at_restaurant_at) {
    const t = secondsSince(o.rider_assigned_at) / TO_RESTAURANT_S;
    pos = lerp(start, r, t);
    if (t >= 1) await db.from("orders").update({ rider_at_restaurant_at: new Date().toISOString() }).eq("id", o.id);
  } else if (o.status === "RIDER_ASSIGNED") {
    pos = { lat: r.lat, lng: r.lng };
    if (secondsSince(o.rider_at_restaurant_at) >= PICKUP_DWELL_S) {
      await transition(o.id, "PICKED_UP", { role: "rider", id: rider.id }, { note: "Order ID confirmed" });
      await transition(o.id, "OUT_FOR_DELIVERY", { role: "rider", id: rider.id });
    }
  } else if (o.status === "OUT_FOR_DELIVERY") {
    const t = secondsSince(o.out_for_delivery_at) / TO_CUSTOMER_S;
    pos = lerp(r, home, t);
    if (secondsSince(o.out_for_delivery_at) >= TO_CUSTOMER_S + DOOR_DWELL_S) {
      await transition(o.id, "DELIVERED", { role: "rider", id: rider.id }, { note: "Delivery OTP verified", patch: o.payment_method === "cod" ? { payment_status: "cod_collected" } : {} });
    }
  } else if (o.status === "PICKED_UP") {
    await transition(o.id, "OUT_FOR_DELIVERY", { role: "rider", id: rider.id });
  } else {
    pos = { lat: r.lat, lng: r.lng }; // waiting at the restaurant for the food
  }

  const moved = haversineKm(pos.lat, pos.lng, rider.current_lat ?? 0, rider.current_lng ?? 0) > 0.005;
  if (moved) {
    const heading = bearing({ lat: rider.current_lat ?? pos.lat, lng: rider.current_lng ?? pos.lng }, pos);
    await db.from("riders").update({ current_lat: pos.lat, current_lng: pos.lng, last_seen_at: new Date().toISOString() }).eq("id", rider.id);
    await db.from("rider_locations").insert({ rider_id: rider.id, order_id: o.id, lat: pos.lat, lng: pos.lng, heading });
  }
}
