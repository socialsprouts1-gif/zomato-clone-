import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export const LIVE_ORDER_COLUMNS =
  "id, order_number, status, customer_name, created_at, placed_at, accepted_at, ready_at, scheduled_for, prep_minutes, total_paise, item_total_paise, payment_method, payment_status, cooking_instructions, no_cutlery, reject_reason, rider_id, rider_assigned_at, rider_at_restaurant_at, source, order_items(id, name, quantity, variant_name, addons, is_veg, added_by_name), riders!orders_rider_id_fkey(name, phone, vehicle_type, vehicle_number, is_simulated)";

export type LiveOrder = {
  id: string;
  order_number: number;
  status: string;
  customer_name: string | null;
  created_at: string;
  placed_at: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  scheduled_for: string | null;
  prep_minutes: number | null;
  total_paise: number;
  item_total_paise: number;
  payment_method: string;
  payment_status: string;
  cooking_instructions: string | null;
  no_cutlery: boolean;
  reject_reason: string | null;
  rider_id: string | null;
  rider_assigned_at: string | null;
  rider_at_restaurant_at: string | null;
  source: string;
  order_items: { id: string; name: string; quantity: number; variant_name: string | null; addons: unknown; is_veg: boolean; added_by_name: string | null }[];
  riders: { name: string; phone: string | null; vehicle_type: string; vehicle_number: string | null; is_simulated: boolean } | null;
};

/** Active orders plus today's finished ones for one outlet (RLS limits this to the partner's outlets). */
export async function loadLiveOrders(restaurantId: string): Promise<LiveOrder[]> {
  const supabase = await getSupabaseServerClient();
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select(LIVE_ORDER_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .or(`status.in.(PLACED,ACCEPTED,PREPARING,READY,RIDER_ASSIGNED,PICKED_UP,OUT_FOR_DELIVERY,SCHEDULED),created_at.gte.${since}`)
    .neq("status", "PENDING_PAYMENT")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);
  return data as unknown as LiveOrder[];
}
