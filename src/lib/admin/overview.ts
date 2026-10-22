"use server";

import { assertAdmin } from "@/lib/admin/guard";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type OverviewKpis = {
  gmv_paise: number;
  orders: number;
  cancelled: number;
  aov_paise: number;
  cancellation_rate: number;
  active_riders: number;
  active_restaurants: number;
};
export type OverviewDay = { day: string; orders: number; gmv_paise: number; cancelled: number };
export type StatusCount = { status: OrderStatus; orders: number };

export type LiveOrderPin = {
  id: string;
  order_number: number;
  status: OrderStatus;
  total_paise: number;
  restaurant: { id: string; name: string; lat: number; lng: number } | null;
  dest: { lat: number; lng: number } | null;
  rider: { id: string; name: string; lat: number | null; lng: number | null } | null;
  created_at: string;
};
export type MapRider = { id: string; name: string; lat: number; lng: number; busy: boolean };
export type MapRestaurant = { id: string; name: string; lat: number; lng: number };

export type Overview = {
  today: string;
  days: number;
  kpis: OverviewKpis;
  daily: OverviewDay[];
  statusMixToday: StatusCount[];
  statusMixRange: StatusCount[];
  live: LiveOrderPin[];
  riders: MapRider[];
  restaurants: MapRestaurant[];
  updatedAt: string;
};

/** Everything the admin overview shows: KPIs (today, IST), per-day series and the live map. */
export async function fetchOverview(days: 14 | 30 = 14): Promise<Overview> {
  await assertAdmin();
  const db = getSupabaseAdminClient();
  const span = days === 30 ? 30 : 14;
  const [{ data: stats, error }, { data: live }, { data: riders }, { data: restaurants }] = await Promise.all([
    db.rpc("admin_overview", { p_days: span }),
    db
      .from("orders")
      .select("id, order_number, status, total_paise, created_at, delivery_address, restaurants(id, name, lat, lng), riders!orders_rider_id_fkey(id, name, current_lat, current_lng)")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("riders").select("id, name, current_lat, current_lng, current_order_id").eq("status", "approved").eq("is_online", true).not("current_lat", "is", null),
    db.from("restaurants").select("id, name, lat, lng").eq("status", "approved").eq("is_online", true),
  ]);
  if (error || !stats) throw new Error(error?.message ?? "Couldn't load the overview");
  const s = stats as unknown as { today: string; kpis: OverviewKpis; daily: OverviewDay[]; status_mix_today: StatusCount[]; status_mix_range: StatusCount[] };
  return {
    today: s.today,
    days: span,
    kpis: { ...s.kpis, cancellation_rate: Number(s.kpis.cancellation_rate), gmv_paise: Number(s.kpis.gmv_paise), aov_paise: Number(s.kpis.aov_paise) },
    daily: s.daily.map((d) => ({ ...d, gmv_paise: Number(d.gmv_paise) })),
    statusMixToday: s.status_mix_today,
    statusMixRange: s.status_mix_range,
    live: (live ?? []).map((o) => {
      const dest = o.delivery_address as { lat?: number; lng?: number } | null;
      return {
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total_paise: o.total_paise,
        created_at: o.created_at,
        restaurant: o.restaurants ? { id: o.restaurants.id, name: o.restaurants.name, lat: o.restaurants.lat, lng: o.restaurants.lng } : null,
        dest: dest && typeof dest.lat === "number" && typeof dest.lng === "number" ? { lat: dest.lat, lng: dest.lng } : null,
        rider: o.riders ? { id: o.riders.id, name: o.riders.name, lat: o.riders.current_lat, lng: o.riders.current_lng } : null,
      };
    }),
    riders: (riders ?? []).map((r) => ({ id: r.id, name: r.name, lat: r.current_lat!, lng: r.current_lng!, busy: Boolean(r.current_order_id) })),
    restaurants: (restaurants ?? []).map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng })),
    updatedAt: new Date().toISOString(),
  };
}
