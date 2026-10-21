import { z } from "zod";
import type { Tables } from "@/lib/supabase/database.types";

export type PartnerCategory = Pick<
  Tables<"menu_categories">,
  "id" | "parent_id" | "name" | "description" | "sort" | "available_from" | "available_to" | "available_days" | "is_active"
>;
export type PartnerVariant = Pick<Tables<"item_variants">, "id" | "name" | "price_paise" | "is_default" | "in_stock" | "sort">;
export type PartnerAddon = Pick<Tables<"addons">, "id" | "name" | "price_paise" | "is_veg" | "in_stock" | "sort">;
export type PartnerAddonGroup = Pick<Tables<"addon_groups">, "id" | "name" | "min_select" | "max_select" | "sort"> & { addons: PartnerAddon[] };
export type PartnerItem = Pick<
  Tables<"menu_items">,
  | "id" | "category_id" | "name" | "description" | "price_paise" | "is_veg" | "contains_egg" | "image_url" | "in_stock" | "stock_qty"
  | "low_stock_threshold" | "bestseller" | "tags" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "grams" | "healthy_score"
  | "variant_group_name" | "sort"
> & { item_variants: PartnerVariant[]; addon_groups: PartnerAddonGroup[] };

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const HEALTHY_SCORES = ["low", "medium", "high", "super"] as const;

/** Tracked items at or below their alert level are "low". */
export function isLowStock(i: Pick<PartnerItem, "stock_qty" | "low_stock_threshold">) {
  return i.stock_qty !== null && i.stock_qty <= i.low_stock_threshold;
}

const uuid = z.uuid();
const name = (max: number) => z.string().trim().min(1, "Required").max(max);
const paise = z.number().int().min(0).max(10_000_000);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Use HH:MM");

export const categoryInput = z
  .object({
    name: name(60),
    description: z.string().trim().max(200).nullable(),
    available_from: time.nullable(),
    available_to: time.nullable(),
    available_days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day").max(7),
    is_active: z.boolean(),
  })
  .refine((c) => (c.available_from === null) === (c.available_to === null), { message: "Set both start and end time, or neither", path: ["available_to"] })
  .refine((c) => !c.available_from || !c.available_to || c.available_from.slice(0, 5) < c.available_to.slice(0, 5), { message: "End time must be after start time", path: ["available_to"] });
export type CategoryInput = z.infer<typeof categoryInput>;

const nullableNum = (max: number, int = false) => (int ? z.number().int() : z.number()).min(0).max(max).nullable();

export const itemInput = z
  .object({
    id: uuid.optional(),
    restaurantId: uuid,
    categoryId: uuid,
    name: name(80),
    description: z.string().trim().max(400).nullable(),
    pricePaise: paise,
    isVeg: z.boolean(),
    containsEgg: z.boolean(),
    bestseller: z.boolean(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(24)).max(10),
    imageUrl: z.url().nullable(),
    calories: nullableNum(5000, true),
    protein_g: nullableNum(999),
    carbs_g: nullableNum(999),
    fat_g: nullableNum(999),
    grams: nullableNum(10000, true),
    healthy_score: z.enum(HEALTHY_SCORES).nullable(),
    variantGroupName: z.string().trim().max(40).nullable(),
    variants: z.array(z.object({ id: uuid.optional(), name: name(40), pricePaise: paise, isDefault: z.boolean() })).max(12),
    addonGroups: z
      .array(
        z
          .object({
            id: uuid.optional(),
            name: name(50),
            minSelect: z.number().int().min(0).max(20),
            maxSelect: z.number().int().min(1).max(20),
            addons: z.array(z.object({ id: uuid.optional(), name: name(50), pricePaise: paise, isVeg: z.boolean() })).min(1, "Add at least one add-on").max(30),
          })
          .refine((g) => g.maxSelect >= g.minSelect, { message: "Max must be at least min", path: ["maxSelect"] })
          .refine((g) => g.minSelect <= g.addons.length, { message: "Min is more than the add-ons available", path: ["minSelect"] }),
      )
      .max(10),
    trackStock: z.boolean(),
    stockQty: z.number().int().min(0).max(100_000).nullable(),
    lowStockThreshold: z.number().int().min(0).max(10_000),
  })
  .refine((i) => !i.trackStock || i.stockQty !== null, { message: "Enter the quantity in stock", path: ["stockQty"] })
  .refine((i) => !(i.isVeg && i.containsEgg), { message: "An egg dish can't be marked veg", path: ["containsEgg"] });
export type ItemInput = z.infer<typeof itemInput>;
