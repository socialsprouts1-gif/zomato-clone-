"use server";

import { z } from "zod";
import { adminAction, AdminError } from "@/lib/admin/guard";
import { notifyRestaurantTeam } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const id = z.string().uuid();
const reasonSchema = z.string().trim().min(3, "Give a reason").max(300);

const paths = (rid: string) => ["/admin/restaurants", `/admin/restaurants/${rid}`, "/", "/search", "/partner"];

async function load(rid: string) {
  const { data, error } = await getSupabaseAdminClient().from("restaurants").select("id, name, slug, status, commission_pct").eq("id", id.parse(rid)).maybeSingle();
  if (error) throw new AdminError(error.message);
  if (!data) throw new AdminError("Restaurant not found");
  return data;
}

async function setStatus(rid: string, status: "approved" | "rejected" | "suspended") {
  const { error } = await getSupabaseAdminClient().from("restaurants").update({ status, ...(status === "approved" ? {} : { is_online: false }) }).eq("id", rid);
  if (error) throw new AdminError(error.message);
}

/** Approves a pending onboarding application: the outlet goes live on the customer app. */
export async function approveRestaurant(restaurantId: string) {
  return adminAction(async () => {
    const r = await load(restaurantId);
    if (r.status !== "pending" && r.status !== "rejected") throw new AdminError("Only pending applications can be approved");
    const { error } = await getSupabaseAdminClient().from("restaurants").update({ status: "approved", is_online: true }).eq("id", r.id);
    if (error) throw new AdminError(error.message);
    await notifyRestaurantTeam(r.id, {
      title: `${r.name} is approved`,
      body: "Your restaurant is live on Thaali. Add your menu and switch the outlet online to start taking orders.",
      link: "/partner",
      type: "partner",
    });
    return { audit: { action: "restaurant.approve", entityType: "restaurant", entityId: r.id, details: { name: r.name, from: r.status } } };
  }, paths(restaurantId));
}

export async function rejectRestaurant(restaurantId: string, reason: string) {
  return adminAction(async () => {
    const r = await load(restaurantId);
    const why = reasonSchema.parse(reason);
    if (r.status !== "pending") throw new AdminError("Only pending applications can be rejected");
    await setStatus(r.id, "rejected");
    await notifyRestaurantTeam(r.id, { title: `${r.name} wasn't approved`, body: `Reason: ${why}`, link: "/partner", type: "partner" });
    return { audit: { action: "restaurant.reject", entityType: "restaurant", entityId: r.id, details: { name: r.name, reason: why } } };
  }, paths(restaurantId));
}

export async function suspendRestaurant(restaurantId: string, reason: string) {
  return adminAction(async () => {
    const r = await load(restaurantId);
    const why = reasonSchema.parse(reason);
    if (r.status !== "approved") throw new AdminError("Only live restaurants can be suspended");
    await setStatus(r.id, "suspended");
    await notifyRestaurantTeam(r.id, { title: `${r.name} is suspended`, body: `Your outlet is hidden from customers. Reason: ${why}`, link: "/partner", type: "partner" });
    return { audit: { action: "restaurant.suspend", entityType: "restaurant", entityId: r.id, details: { name: r.name, reason: why } } };
  }, paths(restaurantId));
}

export async function unsuspendRestaurant(restaurantId: string) {
  return adminAction(async () => {
    const r = await load(restaurantId);
    if (r.status !== "suspended") throw new AdminError("This restaurant isn't suspended");
    const { error } = await getSupabaseAdminClient().from("restaurants").update({ status: "approved" }).eq("id", r.id);
    if (error) throw new AdminError(error.message);
    await notifyRestaurantTeam(r.id, { title: `${r.name} is live again`, body: "Your suspension was lifted. Switch the outlet online to take orders.", link: "/partner", type: "partner" });
    return { audit: { action: "restaurant.unsuspend", entityType: "restaurant", entityId: r.id, details: { name: r.name } } };
  }, paths(restaurantId));
}

export async function setRestaurantCommission(restaurantId: string, pct: number) {
  return adminAction(async () => {
    const r = await load(restaurantId);
    const value = z.number().min(0).max(50).multipleOf(0.01).parse(pct);
    const { error } = await getSupabaseAdminClient().from("restaurants").update({ commission_pct: value }).eq("id", r.id);
    if (error) throw new AdminError(error.message);
    await notifyRestaurantTeam(r.id, { title: "Commission updated", body: `Thaali commission for ${r.name} is now ${value}% on new orders.`, link: "/partner/payouts", type: "partner" });
    return { audit: { action: "restaurant.commission", entityType: "restaurant", entityId: r.id, details: { name: r.name, from: Number(r.commission_pct), to: value } } };
  }, paths(restaurantId));
}

const coreSchema = z.object({
  name: z.string().trim().min(2).max(80),
  cuisines: z.array(z.string().trim().min(2).max(30)).min(1, "Add at least one cuisine").max(8),
  locality: z.string().trim().min(2).max(60),
  cost_for_two_paise: z.number().int().min(5000).max(1000000),
  is_pure_veg: z.boolean(),
  is_featured: z.boolean(),
  gold_partner: z.boolean(),
  dining_enabled: z.boolean(),
});
export type RestaurantCoreInput = z.input<typeof coreSchema>;

export async function updateRestaurantCore(restaurantId: string, input: RestaurantCoreInput) {
  return adminAction(async () => {
    const r = await load(restaurantId);
    const v = coreSchema.parse(input);
    const db = getSupabaseAdminClient();
    const { data: before } = await db.from("restaurants").select("name, cuisines, locality, cost_for_two_paise, is_pure_veg, is_featured, gold_partner, dining_enabled").eq("id", r.id).single();
    const { error } = await db.from("restaurants").update(v).eq("id", r.id);
    if (error) throw new AdminError(error.message);
    const changed = Object.fromEntries(
      Object.entries(v).filter(([k, val]) => JSON.stringify(before?.[k as keyof typeof before]) !== JSON.stringify(val)).map(([k, val]) => [k, { from: before?.[k as keyof typeof before], to: val }]),
    );
    return { audit: { action: "restaurant.update", entityType: "restaurant", entityId: r.id, details: { name: v.name, changed } } };
  }, paths(restaurantId));
}

/** Adds or removes the restaurant from a curated collection (the collections themselves are managed in Content). */
export async function setCollectionMembership(restaurantId: string, collectionId: string, member: boolean) {
  return adminAction(async () => {
    const r = await load(restaurantId);
    const db = getSupabaseAdminClient();
    const { data: c } = await db.from("collections").select("id, title, is_curated").eq("id", id.parse(collectionId)).maybeSingle();
    if (!c || !c.is_curated) throw new AdminError("Collection not found");
    if (member) {
      const { data: last } = await db.from("collection_items").select("sort").eq("collection_id", c.id).order("sort", { ascending: false }).limit(1).maybeSingle();
      const { error } = await db.from("collection_items").upsert({ collection_id: c.id, restaurant_id: r.id, sort: (last?.sort ?? 0) + 1 }, { onConflict: "collection_id,restaurant_id", ignoreDuplicates: true });
      if (error) throw new AdminError(error.message);
    } else {
      const { error } = await db.from("collection_items").delete().eq("collection_id", c.id).eq("restaurant_id", r.id);
      if (error) throw new AdminError(error.message);
    }
    return {
      audit: { action: member ? "collection.add_restaurant" : "collection.remove_restaurant", entityType: "collection", entityId: c.id, details: { collection: c.title, restaurant: r.name, restaurantId: r.id } },
    };
  }, [...paths(restaurantId), "/collections", "/admin/content"]);
}
