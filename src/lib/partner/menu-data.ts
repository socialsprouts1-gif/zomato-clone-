import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PartnerCategory, PartnerItem } from "./menu-types";

const CATEGORY_COLUMNS = "id, parent_id, name, description, sort, available_from, available_to, available_days, is_active";
const ITEM_COLUMNS =
  "id, category_id, name, description, price_paise, is_veg, contains_egg, image_url, in_stock, stock_qty, low_stock_threshold, bestseller, tags, calories, protein_g, carbs_g, fat_g, grams, healthy_score, variant_group_name, sort, item_variants(id, name, price_paise, is_default, in_stock, sort), addon_groups(id, name, min_select, max_select, sort, addons(id, name, price_paise, is_veg, in_stock, sort))";

/** The whole menu of one outlet as the partner sees it (inactive categories included, deleted items excluded). */
export async function loadPartnerMenu(restaurantId: string): Promise<{ categories: PartnerCategory[]; items: PartnerItem[] }> {
  const supabase = await getSupabaseServerClient();
  const [cats, items] = await Promise.all([
    supabase.from("menu_categories").select(CATEGORY_COLUMNS).eq("restaurant_id", restaurantId).order("sort").order("created_at"),
    supabase.from("menu_items").select(ITEM_COLUMNS).eq("restaurant_id", restaurantId).eq("is_deleted", false).order("sort").order("created_at"),
  ]);
  if (cats.error) throw new Error(cats.error.message);
  if (items.error) throw new Error(items.error.message);
  const sorted = (items.data as PartnerItem[]).map((i) => ({
    ...i,
    item_variants: [...i.item_variants].sort((a, b) => a.sort - b.sort),
    addon_groups: [...i.addon_groups].sort((a, b) => a.sort - b.sort).map((g) => ({ ...g, addons: [...g.addons].sort((a, b) => a.sort - b.sort) })),
  }));
  return { categories: cats.data, items: sorted };
}
