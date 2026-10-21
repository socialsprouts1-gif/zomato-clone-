import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Post-acceptance cancellation: if nothing in the order is temperature-sensitive, list it for
 * customers within 3 km at 50% off for 15 minutes. First claimer gets it.
 */
export async function listForFoodRescue(o: Tables<"orders">) {
  const db = getSupabaseAdminClient();
  const [{ data: items }, { data: r }, { data: s }] = await Promise.all([
    db.from("order_items").select("name, quantity, is_veg, menu_item_id, menu_items(is_temperature_sensitive)").eq("order_id", o.id),
    db.from("restaurants").select("lat, lng").eq("id", o.restaurant_id).single(),
    db.from("platform_settings").select("food_rescue_discount_pct, food_rescue_minutes").single(),
  ]);
  if (!items?.length || !r || !s) return null;
  if (items.some((i) => i.menu_items?.is_temperature_sensitive)) return null;
  const pct = s.food_rescue_discount_pct;
  const { data } = await db
    .from("food_rescue_listings")
    .upsert(
      {
        order_id: o.id,
        restaurant_id: o.restaurant_id,
        lat: r.lat,
        lng: r.lng,
        items_summary: items.map((i) => `${i.quantity} × ${i.name}`).join(", "),
        is_veg: items.every((i) => i.is_veg),
        original_price_paise: o.item_total_paise,
        rescue_price_paise: Math.round((o.item_total_paise * (100 - pct)) / 100),
        status: "available",
        expires_at: new Date(Date.now() + s.food_rescue_minutes * 60000).toISOString(),
      },
      { onConflict: "order_id" },
    )
    .select("*")
    .single();
  return data;
}
