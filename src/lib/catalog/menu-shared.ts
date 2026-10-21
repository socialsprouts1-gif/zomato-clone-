import type { Tables } from "@/lib/supabase/database.types";

export type MenuVariant = Pick<Tables<"item_variants">, "id" | "name" | "price_paise" | "is_default" | "in_stock" | "sort">;
export type MenuAddon = Pick<Tables<"addons">, "id" | "name" | "price_paise" | "is_veg" | "in_stock" | "sort">;
export type MenuAddonGroup = Pick<Tables<"addon_groups">, "id" | "name" | "min_select" | "max_select" | "sort"> & { addons: MenuAddon[] };
export type MenuItem = Pick<
  Tables<"menu_items">,
  | "id" | "category_id" | "name" | "description" | "price_paise" | "is_veg" | "contains_egg" | "image_url" | "in_stock" | "stock_qty" | "bestseller"
  | "tags" | "rating" | "rating_count" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "grams" | "healthy_score" | "variant_group_name" | "sort"
  | "is_temperature_sensitive"
> & { item_variants: MenuVariant[]; addon_groups: MenuAddonGroup[] };
export type MenuCategory = Pick<Tables<"menu_categories">, "id" | "parent_id" | "name" | "description" | "sort" | "available_from" | "available_to" | "available_days" | "is_active">;

/** Price of one unit with the chosen variant and add-ons (paise). */
export function unitPriceOf(item: Pick<MenuItem, "price_paise" | "item_variants">, variantId: string | null, addons: { price_paise: number }[]) {
  const variant = item.item_variants.find((v) => v.id === variantId);
  return (variant?.price_paise ?? item.price_paise) + addons.reduce((s, a) => s + a.price_paise, 0);
}
