import "server-only";

import type { PartnerReview } from "@/components/partner/reviews/reviews-board";
import { summarizeReviews } from "@/lib/ai/review-summary";
import { getSupabaseServerClient } from "@/lib/supabase/server";


/** Latest reviews of an outlet (newest first), plus the rating breakdown and an AI / rule-based summary. */
export async function loadPartnerReviews(restaurantId: string) {
  const supabase = await getSupabaseServerClient();
  const [{ data }, { data: dishes }] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, kind, customer_name, food_rating, delivery_rating, food_tags, delivery_tags, comment, created_at, order_id, orders(order_number), review_photos(id, url), review_replies(body, created_at)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("menu_items").select("name").eq("restaurant_id", restaurantId).eq("is_deleted", false),
  ]);
  const reviews: PartnerReview[] = (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    customerName: r.customer_name,
    foodRating: r.food_rating,
    deliveryRating: r.delivery_rating,
    foodTags: r.food_tags,
    deliveryTags: r.delivery_tags,
    comment: r.comment,
    createdAt: r.created_at,
    photos: r.review_photos,
    reply: r.review_replies ? { body: r.review_replies.body, createdAt: r.review_replies.created_at } : null,
    orderId: r.order_id,
    orderNumber: r.orders?.order_number ?? null,
  }));
  const summary = await summarizeReviews(
    restaurantId,
    reviews.map((r) => ({ food_rating: r.foodRating, food_tags: r.foodTags, delivery_tags: r.deliveryTags, comment: r.comment })),
    (dishes ?? []).map((d) => d.name),
  );
  const average = reviews.length ? reviews.reduce((s, r) => s + r.foodRating, 0) / reviews.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.foodRating === stars).length }));
  return { reviews, summary, average, distribution };
}
