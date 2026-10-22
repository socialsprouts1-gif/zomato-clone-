import "server-only";

import { cache } from "react";
import { estimateEtaMinutes, haversineKm } from "@/lib/geo";
import type { Preferences } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { Filters } from "./filters";
import { getOpenState, type OpenState } from "./open-state";

export type RestaurantCardData = {
  id: string;
  slug: string;
  name: string;
  cuisines: string[];
  locality: string;
  cover_image_url: string | null;
  rating: number;
  rating_count: number;
  cost_for_two_paise: number;
  is_pure_veg: boolean;
  gold_partner: boolean;
  dining_enabled: boolean;
  is_healthy_partner: boolean;
  distanceKm: number;
  etaMin: number;
  open: OpenState;
  offer: string | null;
  isNew: boolean;
  sponsored: boolean;
  featured: boolean;
  created_at: string;
};

const CARD_COLUMNS =
  "id, slug, name, cuisines, tags, locality, cover_image_url, rating_delivery, rating_count, cost_for_two_paise, is_pure_veg, gold_partner, dining_enabled, is_healthy_partner, lat, lng, is_online, busy_until, holidays, opening_hours, avg_prep_minutes, is_featured, sponsored_until, created_at, restaurant_offers(title, is_active, applies_to, valid_until, target)";

type Row = Pick<
  Tables<"restaurants">,
  | "id" | "slug" | "name" | "cuisines" | "tags" | "locality" | "cover_image_url" | "rating_delivery" | "rating_count" | "cost_for_two_paise"
  | "is_pure_veg" | "gold_partner" | "dining_enabled" | "is_healthy_partner" | "lat" | "lng" | "is_online" | "busy_until" | "holidays"
  | "opening_hours" | "avg_prep_minutes" | "is_featured" | "sponsored_until" | "created_at"
> & { restaurant_offers: Pick<Tables<"restaurant_offers">, "title" | "is_active" | "applies_to" | "valid_until" | "target">[] };

const NEW_DAYS = 30;

export function toCard(r: Row, from: { lat: number; lng: number }, now = new Date()): RestaurantCardData {
  const distanceKm = haversineKm(from.lat, from.lng, r.lat, r.lng);
  const offer = r.restaurant_offers.find(
    (o) => o.is_active && o.applies_to !== "dining" && o.target !== "new_users" && (!o.valid_until || new Date(o.valid_until) > now),
  );
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    cuisines: r.cuisines,
    locality: r.locality,
    cover_image_url: r.cover_image_url,
    rating: Number(r.rating_delivery),
    rating_count: r.rating_count,
    cost_for_two_paise: r.cost_for_two_paise,
    is_pure_veg: r.is_pure_veg,
    gold_partner: r.gold_partner,
    dining_enabled: r.dining_enabled,
    is_healthy_partner: r.is_healthy_partner,
    distanceKm,
    etaMin: estimateEtaMinutes(distanceKm, r.avg_prep_minutes),
    open: getOpenState(r, now),
    offer: offer?.title ?? null,
    isNew: r.tags.includes("new") || now.getTime() - new Date(r.created_at).getTime() < NEW_DAYS * 86400000,
    sponsored: Boolean(r.sponsored_until && new Date(r.sponsored_until) > now),
    featured: r.is_featured,
    created_at: r.created_at,
  };
}

export const getPlatformSettings = cache(async () => {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("platform_settings").select("*").single();
  return data!;
});

/** Approved restaurants within delivery range of the chosen location, with distance/ETA/open state. */
export const getNearbyRestaurants = cache(async (prefs: Pick<Preferences, "location" | "vegMode">): Promise<RestaurantCardData[]> => {
  const supabase = await getSupabaseServerClient();
  const [{ data, error }, settings] = await Promise.all([
    supabase.from("restaurants").select(CARD_COLUMNS).eq("status", "approved"),
    getPlatformSettings(),
  ]);
  if (error) throw new Error(error.message);
  const maxKm = Number(settings.max_delivery_km);
  const now = new Date();
  return (data as Row[])
    .map((r) => toCard(r, prefs.location, now))
    .filter((r) => r.distanceKm <= maxKm)
    .filter((r) => !prefs.vegMode || r.is_pure_veg);
});

function relevance(r: RestaurantCardData) {
  return (r.open.open ? 10 : 0) + r.rating * 2 - r.distanceKm * 0.25 + (r.sponsored ? 1.5 : 0) + (r.featured ? 0.6 : 0);
}

export function applyFilters(list: RestaurantCardData[], f: Filters): RestaurantCardData[] {
  const cuisines = f.cuisines.map((c) => c.toLowerCase());
  const out = list.filter(
    (r) =>
      (!f.rating4 || r.rating >= 4) &&
      (!f.pureVeg || r.is_pure_veg) &&
      (!f.offers || r.offer) &&
      (!f.fast || r.etaMin < 30) &&
      (!f.budget || r.cost_for_two_paise <= 30000) &&
      (!f.isNew || r.isNew) &&
      (!cuisines.length || r.cuisines.some((c) => cuisines.includes(c.toLowerCase()))),
  );
  const openFirst = (a: RestaurantCardData, b: RestaurantCardData) => Number(b.open.open) - Number(a.open.open);
  const sorters: Record<Filters["sort"], (a: RestaurantCardData, b: RestaurantCardData) => number> = {
    relevance: (a, b) => relevance(b) - relevance(a),
    rating: (a, b) => openFirst(a, b) || b.rating - a.rating,
    delivery_time: (a, b) => openFirst(a, b) || a.etaMin - b.etaMin,
    cost_low: (a, b) => openFirst(a, b) || a.cost_for_two_paise - b.cost_for_two_paise,
    cost_high: (a, b) => openFirst(a, b) || b.cost_for_two_paise - a.cost_for_two_paise,
    distance: (a, b) => openFirst(a, b) || a.distanceKm - b.distanceKm,
  };
  return out.sort(sorters[f.sort]);
}

export async function getHomeSections(list: RestaurantCardData[], userId: string | null) {
  const supabase = await getSupabaseServerClient();
  const open = list.filter((r) => r.open.open);
  const [{ data: counts }, { data: collections }, { data: banners }, favs, pastCuisines] = await Promise.all([
    supabase.rpc("restaurant_order_counts", { days: 7 }),
    supabase.from("collections").select("id, slug, title, description, image_url, collection_items(restaurant_id)").eq("is_curated", true).order("sort"),
    supabase.from("banners").select("*").eq("is_active", true).order("sort"),
    userId ? supabase.from("favourites").select("restaurant_id").then((r) => new Set((r.data ?? []).map((f) => f.restaurant_id))) : Promise.resolve(new Set<string>()),
    userId
      ? supabase
          .from("orders")
          .select("restaurant_id, restaurants(cuisines)")
          .eq("customer_id", userId)
          .eq("status", "DELIVERED")
          .order("created_at", { ascending: false })
          .limit(15)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const orderCount = new Map((counts ?? []).map((c) => [c.restaurant_id, Number(c.orders)]));
  const trending = [...open].filter((r) => (orderCount.get(r.id) ?? 0) > 0).sort((a, b) => (orderCount.get(b.id) ?? 0) - (orderCount.get(a.id) ?? 0)).slice(0, 10);
  const topRated = [...open].filter((r) => r.rating >= 4.3).sort((a, b) => b.rating - a.rating || a.distanceKm - b.distanceKm).slice(0, 10);

  // Recommended: cuisines from recent orders, excluding places ordered from most; else featured and sponsored.
  const cuisineWeight = new Map<string, number>();
  const orderedFrom = new Set<string>();
  for (const o of pastCuisines) {
    orderedFrom.add(o.restaurant_id);
    for (const c of o.restaurants?.cuisines ?? []) cuisineWeight.set(c, (cuisineWeight.get(c) ?? 0) + 1);
  }
  const recommended = (
    cuisineWeight.size
      ? [...open]
          .map((r) => ({ r, w: r.cuisines.reduce((s, c) => s + (cuisineWeight.get(c) ?? 0), 0) + (orderedFrom.has(r.id) ? -1 : 0) }))
          .filter((x) => x.w > 0)
          .sort((a, b) => b.w - a.w || b.r.rating - a.r.rating)
          .map((x) => x.r)
      : [...open].filter((r) => r.featured || r.sponsored).sort((a, b) => b.rating - a.rating)
  ).slice(0, 10);

  const visible = new Set(list.map((r) => r.id));
  const curated = (collections ?? [])
    .map((c) => ({ ...c, count: c.collection_items.filter((i) => visible.has(i.restaurant_id)).length }))
    .filter((c) => c.count > 0);

  // Respect the admin's banner schedule (starts_at / ends_at).
  const now = Date.now();
  const live = (banners ?? []).filter((b) => (!b.starts_at || Date.parse(b.starts_at) <= now) && (!b.ends_at || Date.parse(b.ends_at) > now));

  return { trending, topRated, recommended, collections: curated, banners: live, favourites: favs };
}

export function allCuisines(list: RestaurantCardData[]) {
  const counts = new Map<string, number>();
  for (const r of list) for (const c of r.cuisines) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
