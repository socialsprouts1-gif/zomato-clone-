"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { categoryInput, itemInput, type CategoryInput, type ItemInput } from "./menu-types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type Db = Awaited<ReturnType<typeof getSupabaseServerClient>>;

class ActionError extends Error {}

/** Signed-in caller who is on the outlet's team (or an admin). Writes then go through RLS as that user. */
async function guardRestaurant(restaurantId: string) {
  const id = z.uuid().parse(restaurantId);
  const user = await getSessionUser();
  if (!user) throw new ActionError("Please sign in again");
  const db = await getSupabaseServerClient();
  const { data: member } = await db.rpc("is_restaurant_member", { rid: id });
  if (!member && user.profile.role !== "admin") throw new ActionError("You don't manage this restaurant");
  return db;
}

async function guardCategory(categoryId: string) {
  const db = await getSupabaseServerClient();
  const { data } = await db.from("menu_categories").select("id, restaurant_id, parent_id").eq("id", z.uuid().parse(categoryId)).maybeSingle();
  if (!data) throw new ActionError("Category not found");
  await guardRestaurant(data.restaurant_id);
  return { db, category: data };
}

async function guardItem(itemId: string) {
  const db = await getSupabaseServerClient();
  const { data } = await db.from("menu_items").select("id, restaurant_id, category_id, stock_qty, in_stock").eq("id", z.uuid().parse(itemId)).eq("is_deleted", false).maybeSingle();
  if (!data) throw new ActionError("Item not found");
  await guardRestaurant(data.restaurant_id);
  return { db, item: data };
}

function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new ActionError(res.error.message);
  return res;
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    revalidatePath("/partner/menu");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form" };
    return { ok: false, error: e instanceof ActionError ? e.message : "Something went wrong" };
  }
}

/** Renumber every category of the outlet in tree order (parent, then its subcategories) so the customer menu follows the same order. */
async function renumberCategories(db: Db, restaurantId: string, swap?: { id: string; dir: -1 | 1 }) {
  const { data } = check(await db.from("menu_categories").select("id, parent_id, sort").eq("restaurant_id", restaurantId).order("sort").order("created_at"));
  const rows = data ?? [];
  const childrenOf = (pid: string | null) => rows.filter((r) => r.parent_id === pid);
  const order = (list: typeof rows) => {
    if (!swap) return list;
    const i = list.findIndex((r) => r.id === swap.id);
    const j = i + swap.dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    return copy;
  };
  const flat: string[] = [];
  for (const top of order(childrenOf(null))) {
    flat.push(top.id);
    for (const sub of order(childrenOf(top.id))) flat.push(sub.id);
  }
  await Promise.all(
    flat.map((id, sort) => (rows.find((r) => r.id === id)?.sort === sort ? null : db.from("menu_categories").update({ sort }).eq("id", id).then(check))),
  );
}

// ---------- categories ----------

export async function createCategory(restaurantId: string, nameRaw: string, parentId: string | null) {
  return run(async () => {
    const db = await guardRestaurant(restaurantId);
    const name = z.string().trim().min(1, "Enter a name").max(60).parse(nameRaw);
    if (parentId) {
      const { data: parent } = await db.from("menu_categories").select("restaurant_id, parent_id").eq("id", z.uuid().parse(parentId)).maybeSingle();
      if (!parent || parent.restaurant_id !== restaurantId) throw new ActionError("Parent category not found");
      if (parent.parent_id) throw new ActionError("Subcategories can't have their own subcategories");
    }
    const { data } = check(await db.from("menu_categories").insert({ restaurant_id: restaurantId, parent_id: parentId, name, sort: 10_000 }).select("id").single());
    await renumberCategories(db, restaurantId);
    return data!.id;
  });
}

export async function updateCategory(categoryId: string, input: CategoryInput) {
  return run(async () => {
    const { db } = await guardCategory(categoryId);
    const v = categoryInput.parse(input);
    check(
      await db
        .from("menu_categories")
        .update({ name: v.name, description: v.description || null, available_from: v.available_from, available_to: v.available_to, available_days: [...new Set(v.available_days)].sort(), is_active: v.is_active })
        .eq("id", categoryId),
    );
  });
}

export async function setCategoryActive(categoryId: string, active: boolean) {
  return run(async () => {
    const { db } = await guardCategory(categoryId);
    check(await db.from("menu_categories").update({ is_active: z.boolean().parse(active) }).eq("id", categoryId));
  });
}

export async function moveCategory(categoryId: string, dir: -1 | 1) {
  return run(async () => {
    const { db, category } = await guardCategory(categoryId);
    await renumberCategories(db, category.restaurant_id, { id: categoryId, dir: z.union([z.literal(-1), z.literal(1)]).parse(dir) });
  });
}

export async function deleteCategory(categoryId: string) {
  return run(async () => {
    const { db, category } = await guardCategory(categoryId);
    const { data: subs } = check(await db.from("menu_categories").select("id").eq("parent_id", categoryId));
    const ids = [categoryId, ...(subs ?? []).map((s) => s.id)];
    const { count } = check(await db.from("menu_items").select("id", { count: "exact", head: true }).in("category_id", ids).eq("is_deleted", false));
    if (count) throw new ActionError(`Move or delete its ${count} item${count === 1 ? "" : "s"} first`);
    // Past orders keep their own copy of item names, so deleted items can go with the category.
    check(await db.from("menu_categories").delete().eq("id", categoryId));
    await renumberCategories(db, category.restaurant_id);
  });
}

// ---------- items ----------

export async function saveItem(input: ItemInput) {
  return run(async () => {
    const v = itemInput.parse(input);
    const db = await guardRestaurant(v.restaurantId);
    const { data: cat } = await db.from("menu_categories").select("restaurant_id").eq("id", v.categoryId).maybeSingle();
    if (!cat || cat.restaurant_id !== v.restaurantId) throw new ActionError("Pick a category from this outlet");

    let existing: { id: string; stock_qty: number | null } | null = null;
    if (v.id) {
      const { data } = await db.from("menu_items").select("id, restaurant_id, stock_qty").eq("id", v.id).eq("is_deleted", false).maybeSingle();
      if (!data || data.restaurant_id !== v.restaurantId) throw new ActionError("Item not found");
      existing = data;
    }

    const variants = v.variants.map((x, i) => ({ ...x, sort: i }));
    if (variants.length && !variants.some((x) => x.isDefault)) variants[0]!.isDefault = true;
    let defaultSeen = false;
    for (const x of variants) {
      if (x.isDefault && defaultSeen) x.isDefault = false;
      if (x.isDefault) defaultSeen = true;
    }
    const basePrice = variants.find((x) => x.isDefault)?.pricePaise ?? v.pricePaise;
    const stockQty = v.trackStock ? v.stockQty : null;

    const row = {
      restaurant_id: v.restaurantId,
      category_id: v.categoryId,
      name: v.name,
      description: v.description || null,
      price_paise: basePrice,
      is_veg: v.isVeg,
      contains_egg: v.containsEgg,
      bestseller: v.bestseller,
      tags: [...new Set(v.tags)],
      image_url: v.imageUrl,
      calories: v.calories,
      protein_g: v.protein_g,
      carbs_g: v.carbs_g,
      fat_g: v.fat_g,
      grams: v.grams,
      healthy_score: v.healthy_score,
      variant_group_name: variants.length ? v.variantGroupName || "Size" : null,
      low_stock_threshold: v.lowStockThreshold,
    };

    let itemId: string;
    if (existing) {
      itemId = existing.id;
      // stock_qty only in the update when it changes, so the stock trigger and low-stock alert see real transitions.
      check(await db.from("menu_items").update({ ...row, ...(existing.stock_qty !== stockQty ? { stock_qty: stockQty } : {}) }).eq("id", itemId));
    } else {
      const { data: last } = await db.from("menu_items").select("sort").eq("category_id", v.categoryId).order("sort", { ascending: false }).limit(1).maybeSingle();
      const { data } = check(await db.from("menu_items").insert({ ...row, stock_qty: stockQty, in_stock: true, sort: (last?.sort ?? -1) + 1 }).select("id").single());
      itemId = data!.id;
    }

    // Variants: keep ids that still exist so open carts stay valid, drop the rest.
    const { data: oldVariants } = check(await db.from("item_variants").select("id").eq("item_id", itemId));
    const oldVariantIds = new Set((oldVariants ?? []).map((x) => x.id));
    const keptVariantIds = variants.map((x) => x.id).filter((id): id is string => Boolean(id && oldVariantIds.has(id)));
    const dropVariants = [...oldVariantIds].filter((id) => !keptVariantIds.includes(id));
    if (dropVariants.length) check(await db.from("item_variants").delete().in("id", dropVariants));
    for (const x of variants) {
      const values = { name: x.name, price_paise: x.pricePaise, is_default: x.isDefault, sort: x.sort };
      if (x.id && oldVariantIds.has(x.id)) check(await db.from("item_variants").update(values).eq("id", x.id));
      else check(await db.from("item_variants").insert({ ...values, item_id: itemId }));
    }

    // Add-on groups and their add-ons, same approach.
    const { data: oldGroups } = check(await db.from("addon_groups").select("id, addons(id)").eq("item_id", itemId));
    const oldGroupMap = new Map((oldGroups ?? []).map((g) => [g.id, new Set(g.addons.map((a) => a.id))]));
    const keptGroups = new Set(v.addonGroups.map((g) => g.id).filter((id): id is string => Boolean(id && oldGroupMap.has(id))));
    const dropGroups = [...oldGroupMap.keys()].filter((id) => !keptGroups.has(id));
    if (dropGroups.length) check(await db.from("addon_groups").delete().in("id", dropGroups));
    for (const [gi, g] of v.addonGroups.entries()) {
      const values = { name: g.name, min_select: g.minSelect, max_select: Math.max(g.maxSelect, g.minSelect, 1), sort: gi };
      let groupId: string;
      const oldAddons = g.id ? oldGroupMap.get(g.id) : undefined;
      if (g.id && oldAddons) {
        groupId = g.id;
        check(await db.from("addon_groups").update(values).eq("id", groupId));
      } else {
        const { data } = check(await db.from("addon_groups").insert({ ...values, item_id: itemId }).select("id").single());
        groupId = data!.id;
      }
      const known = oldAddons ?? new Set<string>();
      const kept = new Set(g.addons.map((a) => a.id).filter((id): id is string => Boolean(id && known.has(id))));
      const drop = [...known].filter((id) => !kept.has(id));
      if (drop.length) check(await db.from("addons").delete().in("id", drop));
      for (const [ai, a] of g.addons.entries()) {
        const av = { name: a.name, price_paise: a.pricePaise, is_veg: a.isVeg, sort: ai };
        if (a.id && known.has(a.id)) check(await db.from("addons").update(av).eq("id", a.id));
        else check(await db.from("addons").insert({ ...av, group_id: groupId }));
      }
    }
    revalidatePath("/restaurant/[slug]", "page");
    return itemId;
  });
}

export async function setItemInStock(itemId: string, inStock: boolean) {
  return run(async () => {
    const { db, item } = await guardItem(itemId);
    const on = z.boolean().parse(inStock);
    if (on && item.stock_qty === 0) throw new ActionError("Add stock first — the quantity is 0");
    check(await db.from("menu_items").update({ in_stock: on }).eq("id", itemId));
  });
}

export async function adjustStock(itemId: string, delta: number) {
  return run(async () => {
    const { db } = await guardItem(itemId);
    const { data, error } = await db.rpc("adjust_menu_stock", { p_item: itemId, p_delta: z.number().int().min(-10_000).max(10_000).parse(delta) });
    if (error) throw new ActionError(error.message);
    if (data === null) throw new ActionError("Stock isn't tracked for this item");
    return data;
  });
}

export async function setStock(itemId: string, qty: number | null, threshold: number) {
  return run(async () => {
    const { db, item } = await guardItem(itemId);
    const q = z.number().int().min(0).max(100_000).nullable().parse(qty);
    const t = z.number().int().min(0).max(10_000).parse(threshold);
    check(await db.from("menu_items").update({ low_stock_threshold: t, ...(item.stock_qty !== q ? { stock_qty: q } : {}) }).eq("id", itemId));
  });
}

export async function moveItem(itemId: string, dir: -1 | 1) {
  return run(async () => {
    const { db, item } = await guardItem(itemId);
    const d = z.union([z.literal(-1), z.literal(1)]).parse(dir);
    const { data } = check(await db.from("menu_items").select("id, sort").eq("category_id", item.category_id).eq("is_deleted", false).order("sort").order("created_at"));
    const list = [...(data ?? [])];
    const i = list.findIndex((r) => r.id === itemId);
    const j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    await Promise.all(list.map((r, sort) => (r.sort === sort ? null : db.from("menu_items").update({ sort }).eq("id", r.id).then(check))));
  });
}

export async function deleteItem(itemId: string) {
  return run(async () => {
    const { db } = await guardItem(itemId);
    // Soft delete: past orders and reviews still point at it.
    check(await db.from("menu_items").update({ is_deleted: true, in_stock: false }).eq("id", itemId));
  });
}
