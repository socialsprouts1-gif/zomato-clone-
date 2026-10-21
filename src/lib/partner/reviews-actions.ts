"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notifications";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const replySchema = z.object({
  reviewId: z.string().uuid(),
  body: z.string().trim().min(2, "Write a short reply").max(600, "Keep replies under 600 characters"),
});

/** Creates or edits the restaurant's public reply to a review and lets the customer know. */
export async function replyToReview(reviewId: string, body: string): Promise<Result> {
  try {
    const v = replySchema.parse({ reviewId, body });
    const user = await getSessionUser();
    if (!user) throw new Error("Please sign in again");
    const supabase = await getSupabaseServerClient();
    const { data: review } = await supabase
      .from("reviews")
      .select("id, customer_id, restaurant_id, restaurants(name, slug), review_replies(id)")
      .eq("id", v.reviewId)
      .maybeSingle();
    if (!review) throw new Error("Review not found");
    const { data: member } = await supabase.rpc("is_restaurant_member", { rid: review.restaurant_id });
    if (!member && user.profile.role !== "admin") throw new Error("You don't manage this restaurant");

    const existed = Boolean(review.review_replies);
    // RLS: team members only, and the author must be the signed-in user.
    const { error } = await supabase.from("review_replies").upsert({ review_id: review.id, author_id: user.id, body: v.body }, { onConflict: "review_id" });
    if (error) throw new Error("Couldn't save your reply");

    const r = review.restaurants;
    await notify(review.customer_id, {
      title: existed ? `${r?.name ?? "The restaurant"} updated their reply to your review` : `${r?.name ?? "The restaurant"} replied to your review`,
      body: v.body.slice(0, 120),
      link: r ? `/restaurant/${r.slug}` : undefined,
      type: "info",
    });
    revalidatePath("/partner/reviews");
    if (r) revalidatePath(`/restaurant/${r.slug}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check your reply" };
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
