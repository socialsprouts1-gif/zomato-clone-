"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function toggleFavourite(restaurantId: string): Promise<{ ok: true; favourite: boolean } | { ok: false; error: "login" | string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "login" };
  const supabase = await getSupabaseServerClient();
  const { data: existing } = await supabase.from("favourites").select("restaurant_id").eq("restaurant_id", restaurantId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("favourites").delete().eq("restaurant_id", restaurantId).eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/account/favourites");
    return { ok: true, favourite: false };
  }
  const { error } = await supabase.from("favourites").insert({ user_id: user.id, restaurant_id: restaurantId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/account/favourites");
  return { ok: true, favourite: true };
}

/** Remember a restaurant visit (feeds "Recently viewed" and recommendations). */
export async function recordRestaurantView(restaurantId: string) {
  const user = await getSessionUser();
  const supabase = await getSupabaseServerClient();
  await supabase.from("analytics_events").insert({ restaurant_id: restaurantId, user_id: user?.id ?? null, event: "menu_view" });
  if (user) {
    await supabase.from("recently_viewed").upsert({ user_id: user.id, restaurant_id: restaurantId, viewed_at: new Date().toISOString() });
  }
}

export async function logSearch(query: string) {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return;
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await getSupabaseServerClient();
  await supabase.from("search_history").insert({ user_id: user.id, query: q });
}

export async function clearSearchHistory() {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await getSupabaseServerClient();
  await supabase.from("search_history").delete().eq("user_id", user.id);
}

/** Full item (variants + add-ons) for editing a cart line. */
export async function getMenuItemForEdit(itemId: string) {
  const { ITEM_COLUMNS } = await import("./menu");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("menu_items").select(ITEM_COLUMNS).eq("id", itemId).maybeSingle();
  return data as import("./menu-shared").MenuItem | null;
}

/** Funnel event for partner reports: a customer started a cart with this restaurant. */
export async function logCartStart(restaurantId: string) {
  const id = z.string().uuid().safeParse(restaurantId);
  if (!id.success) return;
  const user = await getSessionUser();
  const supabase = await getSupabaseServerClient();
  await supabase.from("analytics_events").insert({ restaurant_id: id.data, user_id: user?.id ?? null, event: "add_to_cart" });
}
