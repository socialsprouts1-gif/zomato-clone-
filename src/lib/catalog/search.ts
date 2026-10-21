import "server-only";

import { haversineKm } from "@/lib/geo";
import type { Preferences } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ITEM_COLUMNS, type MenuItem } from "./menu";
import { getOpenState } from "./open-state";
import { getPlatformSettings } from "./restaurants";

export type SearchRestaurant = { id: string; slug: string; name: string; cuisines: string[]; locality: string; cover_image_url: string | null; rating: number; distanceKm: number; open: boolean; is_pure_veg: boolean };
export type SearchDish = MenuItem & { restaurant: { id: string; slug: string; name: string; locality: string; cover_image_url: string | null; open: boolean } };
export type SearchResults = { restaurants: SearchRestaurant[]; dishes: SearchDish[]; cuisines: string[] };

export async function searchCatalog(q: string, prefs: Pick<Preferences, "location" | "vegMode">): Promise<SearchResults> {
  const query = q.trim().slice(0, 60);
  if (query.length < 2) return { restaurants: [], dishes: [], cuisines: [] };
  const supabase = await getSupabaseServerClient();
  const [rest, dishes, settings] = await Promise.all([
    supabase.rpc("search_restaurants", { q: query, lim: 12 }),
    supabase.rpc("search_dishes", { q: query, lim: 40 }),
    getPlatformSettings(),
  ]);
  const maxKm = Number(settings.max_delivery_km);
  const now = new Date();

  const restaurants = (rest.data ?? [])
    .filter((r) => r.status === "approved" && (!prefs.vegMode || r.is_pure_veg))
    .map((r) => ({
      id: r.id, slug: r.slug, name: r.name, cuisines: r.cuisines, locality: r.locality, cover_image_url: r.cover_image_url,
      rating: Number(r.rating_delivery), distanceKm: haversineKm(prefs.location.lat, prefs.location.lng, r.lat, r.lng),
      open: getOpenState(r, now).open, is_pure_veg: r.is_pure_veg,
    }))
    .filter((r) => r.distanceKm <= maxKm);

  // Dishes: hydrate with variants/add-ons and their restaurant.
  const dishRows = (dishes.data ?? []).filter((d) => !prefs.vegMode || d.is_veg);
  const restIds = [...new Set(dishRows.map((d) => d.restaurant_id))];
  const [{ data: dishRest }, { data: fullItems }] = await Promise.all([
    restIds.length
      ? supabase.from("restaurants").select("id, slug, name, locality, cover_image_url, lat, lng, is_online, busy_until, holidays, opening_hours, is_pure_veg, status").in("id", restIds)
      : Promise.resolve({ data: [] as never[] }),
    dishRows.length ? supabase.from("menu_items").select(ITEM_COLUMNS).in("id", dishRows.map((d) => d.id)) : Promise.resolve({ data: [] as never[] }),
  ]);
  const restMap = new Map(
    (dishRest ?? [])
      .filter((r) => r.status === "approved" && (!prefs.vegMode || r.is_pure_veg) && haversineKm(prefs.location.lat, prefs.location.lng, r.lat, r.lng) <= maxKm)
      .map((r) => [r.id, { id: r.id, slug: r.slug, name: r.name, locality: r.locality, cover_image_url: r.cover_image_url, open: getOpenState(r, now).open }]),
  );
  const itemMap = new Map(((fullItems ?? []) as (MenuItem & { restaurant_id?: string })[]).map((i) => [i.id, i]));
  const dishesOut: SearchDish[] = dishRows
    .filter((d) => restMap.has(d.restaurant_id) && itemMap.has(d.id))
    .map((d) => ({ ...itemMap.get(d.id)!, restaurant: restMap.get(d.restaurant_id)! }))
    .sort((a, b) => Number(b.restaurant.open) - Number(a.restaurant.open))
    .slice(0, 24);

  const needle = query.toLowerCase();
  const cuisines = [...new Set([...restaurants.flatMap((r) => r.cuisines)])].filter((c) => c.toLowerCase().includes(needle)).slice(0, 6);
  return { restaurants, dishes: dishesOut, cuisines };
}
