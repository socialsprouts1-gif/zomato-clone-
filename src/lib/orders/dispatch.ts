import "server-only";

import { isDemoMode } from "@/lib/env";
import { haversineKm } from "@/lib/geo";
import { notify } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

type Order = Tables<"orders">;
type Db = ReturnType<typeof getSupabaseAdminClient>;

export const OFFER_SECONDS = 30;
/** In demo mode, a simulated rider takes the order if no human accepts within this time. */
export const HUMAN_GRACE_SECONDS = 15;

async function settings(db: Db) {
  const { data } = await db.from("platform_settings").select("*").single();
  return data!;
}

export function riderEarningFor(s: { rider_base_pay_paise: number; rider_per_km_paise: number }, pickupKm: number, dropKm: number, tip: number) {
  const distancePay = Math.round((pickupKm + dropKm) * s.rider_per_km_paise);
  return { base: s.rider_base_pay_paise, distancePay, tip, total: s.rider_base_pay_paise + distancePay + tip };
}

/** Offer the order to the nearest free human rider within range (30 s to accept). */
export async function offerToNearestHuman(o: Order, exclude: string[] = []) {
  const db = getSupabaseAdminClient();
  const [{ data: r }, s] = await Promise.all([db.from("restaurants").select("name, locality, lat, lng").eq("id", o.restaurant_id).single(), settings(db)]);
  if (!r) return null;
  const { data: simIds } = await db.from("riders").select("id").eq("is_simulated", true);
  const { data: riderId } = await db.rpc("find_nearest_rider", {
    p_lat: r.lat,
    p_lng: r.lng,
    max_km: Number(s.rider_search_km),
    exclude: [...exclude, ...(simIds ?? []).map((x) => x.id)],
  });
  if (!riderId) return null;
  const { data: rider } = await db.from("riders").select("current_lat, current_lng").eq("id", riderId).single();
  const dest = o.delivery_address as { lat: number; lng: number };
  const pickupKm = rider?.current_lat ? haversineKm(rider.current_lat, rider.current_lng!, r.lat, r.lng) : 1;
  const dropKm = Number(o.distance_km ?? haversineKm(r.lat, r.lng, dest.lat, dest.lng));
  const earning = riderEarningFor(s, pickupKm, dropKm, o.tip_paise);
  const { data: offer } = await db
    .from("rider_offers")
    .insert({
      order_id: o.id,
      rider_id: riderId,
      restaurant_name: r.name,
      restaurant_locality: r.locality,
      pickup_km: Number(pickupKm.toFixed(2)),
      drop_km: Number(dropKm.toFixed(2)),
      estimated_earning_paise: earning.total,
      expires_at: new Date(Date.now() + OFFER_SECONDS * 1000).toISOString(),
    })
    .select("*")
    .single();
  await notify(riderId, { title: "New delivery request", body: `${r.name} · ₹${Math.round(earning.total / 100)} · ${(pickupKm + dropKm).toFixed(1)} km`, link: "/rider", type: "rider" });
  return offer;
}

/** Give the order to a rider (human after accepting an offer, or simulated). */
export async function assignRider(orderId: string, riderId: string, note: string) {
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!o || o.rider_id) return null;
  if (!["ACCEPTED", "PREPARING", "READY"].includes(o.status)) return null;
  const { data: claimed } = await db
    .from("orders")
    .update({ rider_id: riderId, rider_assigned_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("rider_id", null)
    .select("*")
    .maybeSingle();
  if (!claimed) return null;
  const { data: rider } = await db.from("riders").update({ current_order_id: orderId }).eq("id", riderId).select("name, current_lat, current_lng").single();
  if (rider?.current_lat) await db.from("rider_locations").insert({ rider_id: riderId, order_id: orderId, lat: rider.current_lat, lng: rider.current_lng! });
  await db.from("rider_offers").update({ status: "expired" }).eq("order_id", orderId).eq("status", "pending").neq("rider_id", riderId);
  await db.from("order_events").insert({ order_id: orderId, from_status: o.status, to_status: o.status, actor_id: riderId, actor_role: "system", note: `${note}: ${rider?.name ?? "rider"}` });
  await notify(o.customer_id, { title: "Delivery partner assigned", body: `${rider?.name ?? "Your rider"} is heading to the restaurant.`, link: `/orders/${o.id}`, type: "order" });
  if (o.status === "READY") {
    const { transition } = await import("./state-machine");
    await transition(orderId, "RIDER_ASSIGNED", { role: "system", id: null }, { note });
  }
  return claimed;
}

/** Nearest free simulated rider (demo mode). */
export async function assignSimulatedRider(o: Order) {
  const db = getSupabaseAdminClient();
  const { data: r } = await db.from("restaurants").select("lat, lng").eq("id", o.restaurant_id).single();
  const { data: sims } = await db.from("riders").select("id, current_lat, current_lng").eq("is_simulated", true).eq("status", "approved").is("current_order_id", null);
  if (!r || !sims?.length) return null;
  const best = [...sims].sort(
    (a, b) => haversineKm(r.lat, r.lng, a.current_lat ?? r.lat, a.current_lng ?? r.lng) - haversineKm(r.lat, r.lng, b.current_lat ?? r.lat, b.current_lng ?? r.lng),
  )[0]!;
  return assignRider(o.id, best.id, "Simulated rider accepted");
}

export async function onOrderAccepted(o: Order) {
  const offer = await offerToNearestHuman(o);
  if (!offer && isDemoMode) await assignSimulatedRider(o);
}

/** Rider pay, freeing the rider, referral reward and Gold savings on delivery. */
export async function onDelivered(o: Order) {
  const db = getSupabaseAdminClient();
  const s = await settings(db);
  if (o.rider_id) {
    const { data: existing } = await db.from("rider_earnings").select("id").eq("order_id", o.id).maybeSingle();
    if (!existing) {
      const { data: offer } = await db.from("rider_offers").select("pickup_km, drop_km").eq("order_id", o.id).eq("rider_id", o.rider_id).maybeSingle();
      const e = riderEarningFor(s, Number(offer?.pickup_km ?? 1), Number(offer?.drop_km ?? o.distance_km ?? 3), o.tip_paise);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await db.from("rider_earnings").select("id", { count: "exact", head: true }).eq("rider_id", o.rider_id).eq("kind", "delivery").gte("created_at", start.toISOString());
      const hitsTarget = (count ?? 0) + 1 === s.rider_daily_target_orders;
      await db.from("rider_earnings").insert({
        rider_id: o.rider_id, order_id: o.id, kind: "delivery", base_pay_paise: e.base, distance_pay_paise: e.distancePay, tip_paise: e.tip,
        incentive_paise: hitsTarget ? s.rider_daily_target_bonus_paise : 0, total_paise: e.total + (hitsTarget ? s.rider_daily_target_bonus_paise : 0),
        note: hitsTarget ? `Daily target of ${s.rider_daily_target_orders} orders reached` : null,
      });
    }
    await db.from("riders").update({ current_order_id: null }).eq("id", o.rider_id).eq("current_order_id", o.id);
  }
  // Referral: both get credits on the referee's first delivered order.
  const { data: ref } = await db.from("referrals").select("*").eq("referee_id", o.customer_id).eq("status", "pending").maybeSingle();
  if (ref) {
    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", o.customer_id).eq("status", "DELIVERED");
    if ((count ?? 0) <= 1) {
      await db.from("referrals").update({ status: "rewarded", rewarded_at: new Date().toISOString() }).eq("id", ref.id);
      for (const uid of [ref.referrer_id, ref.referee_id]) {
        await db.rpc("wallet_apply", { p_user: uid, p_amount: ref.reward_paise, p_type: "referral_bonus", p_description: "Referral reward", p_reference: ref.id });
        await notify(uid, { title: "Referral reward credited", body: `₹${Math.round(ref.reward_paise / 100)} added to your wallet.`, link: "/account/wallet", type: "offer" });
      }
    }
  }
}
