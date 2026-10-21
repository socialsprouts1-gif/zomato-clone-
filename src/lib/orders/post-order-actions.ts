"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { notifyRestaurantTeam } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  orderId: z.string().uuid(),
  foodRating: z.number().int().min(1).max(5),
  deliveryRating: z.number().int().min(1).max(5).nullable(),
  foodTags: z.array(z.string().max(30)).max(8),
  deliveryTags: z.array(z.string().max(30)).max(8),
  comment: z.string().trim().max(1000).optional(),
  photoUrls: z.array(z.string().url()).max(4),
});
export type ReviewInput = z.input<typeof reviewSchema>;

/** Rate a delivered order (food and delivery separately). One review per order. */
export async function submitReview(input: ReviewInput) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check your rating" };
  const v = parsed.data;
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("id, customer_id, status, restaurant_id, rider_id, order_number").eq("id", v.orderId).single();
  if (!o || o.customer_id !== user.id) return { ok: false as const, error: "Order not found" };
  if (o.status !== "DELIVERED") return { ok: false as const, error: "You can rate an order after it's delivered" };
  const { data: existing } = await db.from("reviews").select("id").eq("order_id", o.id).maybeSingle();
  if (existing) return { ok: false as const, error: "You've already rated this order" };
  const { data: review, error } = await db
    .from("reviews")
    .insert({
      kind: "delivery",
      order_id: o.id,
      customer_id: user.id,
      customer_name: user.profile.name ?? "Thaali user",
      restaurant_id: o.restaurant_id,
      rider_id: o.rider_id,
      food_rating: v.foodRating,
      delivery_rating: o.rider_id ? v.deliveryRating : null,
      food_tags: v.foodTags,
      delivery_tags: v.deliveryTags,
      comment: v.comment || null,
    })
    .select("id")
    .single();
  if (error || !review) return { ok: false as const, error: error?.message ?? "Couldn't save your review" };
  if (v.photoUrls.length) await db.from("review_photos").insert(v.photoUrls.map((url) => ({ review_id: review.id, url })));
  await notifyRestaurantTeam(o.restaurant_id, { title: `New ${v.foodRating}★ review`, body: v.comment?.slice(0, 80) ?? `Order #${o.order_number}`, link: "/partner/reviews" });
  revalidatePath(`/orders/${o.id}`);
  return { ok: true as const };
}

export type ReorderLine = {
  itemId: string;
  name: string;
  isVeg: boolean;
  imageUrl: string | null;
  variantId: string | null;
  variantName: string | null;
  addons: { id: string; name: string; price: number }[];
  unitPrice: number;
  qty: number;
};

/** Rebuild a past order's cart from today's menu (prices and availability may have changed). */
export async function buildReorder(orderId: string) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("customer_id, restaurant_id, restaurants(id, slug, name, locality, cover_image_url, status), order_items(*)").eq("id", orderId).single();
  if (!o || o.customer_id !== user.id) return { ok: false as const, error: "Order not found" };
  if (!o.restaurants || o.restaurants.status !== "approved") return { ok: false as const, error: "This restaurant isn't available any more" };
  const ids = o.order_items.map((i) => i.menu_item_id).filter((x): x is string => Boolean(x));
  const { data: items } = await db
    .from("menu_items")
    .select("id, name, is_veg, image_url, price_paise, in_stock, is_deleted, item_variants(id, name, price_paise, in_stock), addon_groups(addons(id, name, price_paise, in_stock))")
    .in("id", ids);
  const lines: ReorderLine[] = [];
  const skipped: string[] = [];
  for (const oi of o.order_items) {
    if (oi.name.endsWith("(free)")) continue;
    const it = items?.find((x) => x.id === oi.menu_item_id);
    if (!it || it.is_deleted || !it.in_stock) {
      skipped.push(oi.name);
      continue;
    }
    const variant = it.item_variants.find((v) => v.id === oi.variant_id) ?? it.item_variants.find((v) => v.name === oi.variant_name) ?? (it.item_variants.length ? null : undefined);
    if (variant === null || (variant && !variant.in_stock)) {
      skipped.push(oi.name);
      continue;
    }
    const wanted = ((oi.addons as { id?: string; name: string }[] | null) ?? []);
    const all = it.addon_groups.flatMap((g) => g.addons);
    const addons = wanted.map((w) => all.find((a) => (w.id ? a.id === w.id : a.name === w.name))).filter((a): a is NonNullable<typeof a> => Boolean(a && a.in_stock));
    lines.push({
      itemId: it.id,
      name: it.name,
      isVeg: it.is_veg,
      imageUrl: it.image_url,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price_paise })),
      unitPrice: (variant?.price_paise ?? it.price_paise) + addons.reduce((s, a) => s + a.price_paise, 0),
      qty: oi.quantity,
    });
  }
  if (!lines.length) return { ok: false as const, error: "None of these items are available right now" };
  const r = o.restaurants;
  return { ok: true as const, restaurant: { id: r.id, slug: r.slug, name: r.name, locality: r.locality, image: r.cover_image_url }, lines, skipped };
}
