import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuCategory, MenuItem } from "./menu-shared";

export type { MenuAddon, MenuAddonGroup, MenuCategory, MenuItem, MenuVariant } from "./menu-shared";

export const ITEM_COLUMNS =
  "id, category_id, name, description, price_paise, is_veg, contains_egg, image_url, in_stock, stock_qty, bestseller, tags, rating, rating_count, calories, protein_g, carbs_g, fat_g, grams, healthy_score, variant_group_name, sort, is_temperature_sensitive, item_variants(id, name, price_paise, is_default, in_stock, sort), addon_groups(id, name, min_select, max_select, sort, addons(id, name, price_paise, is_veg, in_stock, sort))";

export async function getMenu(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  const supabase = await getSupabaseServerClient();
  const [cats, items] = await Promise.all([
    supabase.from("menu_categories").select("id, parent_id, name, description, sort, available_from, available_to, available_days, is_active").eq("restaurant_id", restaurantId).eq("is_active", true).order("sort"),
    supabase.from("menu_items").select(ITEM_COLUMNS).eq("restaurant_id", restaurantId).eq("is_deleted", false).order("sort"),
  ]);
  if (cats.error) throw new Error(cats.error.message);
  if (items.error) throw new Error(items.error.message);
  const sorted = (items.data as MenuItem[]).map((i) => ({
    ...i,
    item_variants: [...i.item_variants].sort((a, b) => a.sort - b.sort),
    addon_groups: [...i.addon_groups].sort((a, b) => a.sort - b.sort).map((g) => ({ ...g, addons: [...g.addons].sort((a, b) => a.sort - b.sort) })),
  }));
  return { categories: cats.data, items: sorted };
}

