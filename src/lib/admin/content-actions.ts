"use server";

import { z } from "zod";
import { istDayEnd, istDayStart, parseOrThrow } from "@/components/admin/coupons/form-helpers";
import { bannerFormSchema, bannerLink, collectionFormSchema, type BannerFormInput, type CollectionFormInput } from "@/components/admin/content/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminAction } from "./guard";

const uuid = z.string().uuid("Unknown item");
const PATHS = ["/admin/content", "/"];

// ---------- banners ----------

export async function saveBanner(id: string | null, input: BannerFormInput) {
  return adminAction<{ id: string }>(async () => {
    const bannerId = id ? parseOrThrow(uuid, id) : null;
    const v = parseOrThrow(bannerFormSchema, input);
    const db = getSupabaseAdminClient();

    // The target must exist, so the carousel never links to a dead page.
    if (v.link_type === "restaurant") {
      const { data } = await db.from("restaurants").select("id").eq("slug", v.link_restaurant).eq("status", "approved").maybeSingle();
      if (!data) throw new Error("That restaurant isn't live");
    }
    if (v.link_type === "collection") {
      const { data } = await db.from("collections").select("id").eq("slug", v.link_collection).eq("is_curated", true).maybeSingle();
      if (!data) throw new Error("That collection no longer exists");
    }
    if (v.link_type === "coupon") {
      const { data } = await db.from("coupons").select("id").eq("code", v.link_coupon).eq("is_active", true).maybeSingle();
      if (!data) throw new Error("That coupon isn't active");
    }

    let sort = v.sort;
    if (sort === null) {
      const { data: last } = await db.from("banners").select("sort").order("sort", { ascending: false }).limit(1);
      sort = bannerId ? 0 : (last?.[0]?.sort ?? -1) + 1;
    }
    const row = {
      title: v.title,
      subtitle: v.subtitle || null,
      cta_label: v.cta_label || null,
      image_url: v.image_url || null,
      theme: v.theme,
      link_url: bannerLink(v),
      sort,
      is_active: v.is_active,
      starts_at: v.starts_at ? istDayStart(v.starts_at) : null,
      ends_at: v.ends_at ? istDayEnd(v.ends_at) : null,
    };
    const { data, error } = bannerId
      ? await db.from("banners").update(row).eq("id", bannerId).select("id").single()
      : await db.from("banners").insert(row).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Couldn't save the banner");
    return { data: { id: data.id }, audit: { action: bannerId ? "banner.update" : "banner.create", entityType: "banner", entityId: data.id, details: row } };
  }, PATHS);
}

export async function setBannerActive(id: string, active: boolean) {
  return adminAction(async () => {
    const bannerId = parseOrThrow(uuid, id);
    const { data, error } = await getSupabaseAdminClient().from("banners").update({ is_active: active }).eq("id", bannerId).select("title").single();
    if (error || !data) throw new Error(error?.message ?? "Banner not found");
    return { audit: { action: active ? "banner.show" : "banner.hide", entityType: "banner", entityId: bannerId, details: { title: data.title } } };
  }, PATHS);
}

export async function deleteBanner(id: string) {
  return adminAction(async () => {
    const bannerId = parseOrThrow(uuid, id);
    const { data, error } = await getSupabaseAdminClient().from("banners").delete().eq("id", bannerId).select("title").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Banner not found");
    return { audit: { action: "banner.delete", entityType: "banner", entityId: bannerId, details: { title: data.title } } };
  }, PATHS);
}

/** Moves a banner one place up or down in the carousel and renumbers the rest. */
export async function moveBanner(id: string, direction: "up" | "down") {
  return adminAction(async () => {
    const bannerId = parseOrThrow(uuid, id);
    const db = getSupabaseAdminClient();
    const { data: all } = await db.from("banners").select("id, sort, title").order("sort").order("created_at");
    const list = all ?? [];
    const i = list.findIndex((b) => b.id === bannerId);
    if (i < 0) throw new Error("Banner not found");
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    await Promise.all(list.map((b, idx) => (b.sort === idx ? null : db.from("banners").update({ sort: idx }).eq("id", b.id))));
    return { audit: { action: "banner.reorder", entityType: "banner", entityId: bannerId, details: { title: list[j]!.title, direction, position: j + 1 } } };
  }, PATHS);
}

// ---------- curated collections ----------

export async function saveCollection(id: string | null, input: CollectionFormInput) {
  return adminAction<{ id: string; slug: string }>(async () => {
    const collectionId = id ? parseOrThrow(uuid, id) : null;
    const v = parseOrThrow(collectionFormSchema, input);
    const db = getSupabaseAdminClient();
    const { data: clash } = await db.from("collections").select("id").eq("slug", v.slug).maybeSingle();
    if (clash && clash.id !== collectionId) throw new Error(`/collections/${v.slug} is taken. Choose another slug.`);
    let sort = v.sort;
    if (sort === null) {
      const { data: last } = await db.from("collections").select("sort").eq("is_curated", true).order("sort", { ascending: false }).limit(1);
      sort = collectionId ? 0 : (last?.[0]?.sort ?? -1) + 1;
    }
    const row = { title: v.title, slug: v.slug, description: v.description || null, image_url: v.image_url || null, sort, is_curated: true, is_public: true, owner_id: null };
    const { data, error } = collectionId
      ? await db.from("collections").update(row).eq("id", collectionId).eq("is_curated", true).select("id, slug").single()
      : await db.from("collections").insert(row).select("id, slug").single();
    if (error || !data) throw new Error(error?.message ?? "Couldn't save the collection");
    return {
      data: { id: data.id, slug: data.slug ?? v.slug },
      audit: { action: collectionId ? "collection.update" : "collection.create", entityType: "collection", entityId: data.id, details: row },
    };
  }, PATHS);
}

export async function deleteCollection(id: string) {
  return adminAction(async () => {
    const collectionId = parseOrThrow(uuid, id);
    const db = getSupabaseAdminClient();
    const { data: c } = await db.from("collections").select("title, slug").eq("id", collectionId).eq("is_curated", true).maybeSingle();
    if (!c) throw new Error("Collection not found");
    const { count } = await db.from("banners").select("id", { count: "exact", head: true }).eq("link_url", `/collections/${c.slug}`);
    if (count) throw new Error("A home banner links to this collection. Change or delete that banner first.");
    const { error } = await db.from("collections").delete().eq("id", collectionId);
    if (error) throw new Error(error.message);
    return { audit: { action: "collection.delete", entityType: "collection", entityId: collectionId, details: { title: c.title, slug: c.slug } } };
  }, PATHS);
}

/** Replaces a curated collection's restaurants, in the given order. */
export async function setCollectionRestaurants(id: string, restaurantIds: string[]) {
  return adminAction(async () => {
    const collectionId = parseOrThrow(uuid, id);
    const ids = parseOrThrow(z.array(z.string().uuid()).max(100, "A collection can hold up to 100 restaurants"), restaurantIds);
    if (new Set(ids).size !== ids.length) throw new Error("A restaurant is listed twice");
    const db = getSupabaseAdminClient();
    const { data: c } = await db.from("collections").select("title, slug").eq("id", collectionId).eq("is_curated", true).maybeSingle();
    if (!c) throw new Error("Collection not found");
    if (ids.length) {
      const { count } = await db.from("restaurants").select("id", { count: "exact", head: true }).in("id", ids);
      if (count !== ids.length) throw new Error("Some restaurants no longer exist");
    }
    const { error: delErr } = await db.from("collection_items").delete().eq("collection_id", collectionId);
    if (delErr) throw new Error(delErr.message);
    if (ids.length) {
      const { error } = await db.from("collection_items").insert(ids.map((rid, sort) => ({ collection_id: collectionId, restaurant_id: rid, sort })));
      if (error) throw new Error(error.message);
    }
    return { audit: { action: "collection.restaurants", entityType: "collection", entityId: collectionId, details: { title: c.title, restaurants: ids.length } } };
  }, [...PATHS, `/admin/content/collections/${id}`]);
}
