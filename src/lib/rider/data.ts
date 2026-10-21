import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export const ACTIVE_ORDER_COLUMNS =
  "id, order_number, status, customer_name, customer_phone, delivery_address, delivery_instructions, payment_method, payable_paise, total_paise, tip_paise, rider_assigned_at, rider_at_restaurant_at, picked_up_at, out_for_delivery_at, ready_at, prep_minutes, accepted_at, distance_km, restaurants(name, locality, address, lat, lng, phone), order_items(name, quantity)";

export async function loadRiderHome(riderId: string) {
  const supabase = await getSupabaseServerClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [{ data: rider }, { data: active }, { data: offers }, { data: today }, { data: settings }] = await Promise.all([
    supabase.from("riders").select("*").eq("id", riderId).maybeSingle(),
    supabase.from("orders").select(ACTIVE_ORDER_COLUMNS).eq("rider_id", riderId).in("status", ["ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"]).order("created_at").limit(1).maybeSingle(),
    supabase.from("rider_offers").select("*").eq("rider_id", riderId).eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("rider_earnings").select("total_paise, kind").eq("rider_id", riderId).gte("created_at", startOfDay.toISOString()),
    supabase.from("platform_settings").select("rider_daily_target_orders, rider_daily_target_bonus_paise").single(),
  ]);
  return {
    rider,
    active,
    offers: offers ?? [],
    todayEarnings: (today ?? []).reduce((s, e) => s + e.total_paise, 0),
    todayTrips: (today ?? []).filter((e) => e.kind === "delivery").length,
    target: settings ?? { rider_daily_target_orders: 10, rider_daily_target_bonus_paise: 15000 },
  };
}

export type RiderHome = Awaited<ReturnType<typeof loadRiderHome>>;
export type ActiveDelivery = NonNullable<RiderHome["active"]>;
