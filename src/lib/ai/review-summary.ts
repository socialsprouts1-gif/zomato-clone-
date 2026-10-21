import "server-only";

import { unstable_cache } from "next/cache";
import { aiComplete } from "./index";

export type ReviewForSummary = { food_rating: number; food_tags: string[]; delivery_tags: string[]; comment: string | null };

/** Rule-based summary used when AI is off (or fails): tag frequencies, dish mentions and rating split. */
export function ruleBasedSummary(reviews: ReviewForSummary[], dishNames: string[]): string {
  if (!reviews.length) return "No reviews yet. Be the first to rate this place.";
  const avg = reviews.reduce((s, r) => s + r.food_rating, 0) / reviews.length;
  const positive = reviews.filter((r) => r.food_rating >= 4).length;
  const tagCount = new Map<string, number>();
  for (const r of reviews) for (const t of [...r.food_tags, ...r.delivery_tags]) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const negativeTags = new Set(["Cold food", "Small portion", "Too oily", "Late delivery"]);
  const praise = [...tagCount.entries()].filter(([t]) => !negativeTags.has(t)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t.toLowerCase());
  const issues = [...tagCount.entries()].filter(([t]) => negativeTags.has(t)).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t.toLowerCase());
  const mentions = new Map<string, number>();
  for (const r of reviews) for (const d of dishNames) if (r.comment?.toLowerCase().includes(d.toLowerCase())) mentions.set(d, (mentions.get(d) ?? 0) + 1);
  const topDish = [...mentions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const parts = [
    `${Math.round((positive / reviews.length) * 100)}% of diners rated it 4★ or more (average ${avg.toFixed(1)}).`,
    praise.length ? `People often mention: ${praise.join(", ")}.` : "",
    topDish ? `Most talked-about dish: ${topDish}.` : "",
    issues.length ? `A few reviews flag ${issues.join(" and ")}.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

/** AI summary of reviews (cached 6h per restaurant + review count), with the rule-based fallback. */
export async function summarizeReviews(restaurantId: string, reviews: ReviewForSummary[], dishNames: string[]): Promise<{ text: string; ai: boolean }> {
  const fallback = ruleBasedSummary(reviews, dishNames);
  if (reviews.length < 3) return { text: fallback, ai: false };
  const cached = unstable_cache(
    async () => {
      const sample = reviews
        .slice(0, 40)
        .map((r) => `${r.food_rating}★ ${r.comment ?? ""} [${[...r.food_tags, ...r.delivery_tags].join(", ")}]`)
        .join("\n");
      return aiComplete(
        "You summarise restaurant reviews for a food delivery app in India. Write 2-3 short, neutral sentences: what people love, the standout dishes, and any common complaint. No preamble, no emojis.",
        sample,
      );
    },
    ["review-summary", restaurantId, String(reviews.length)],
    { revalidate: 21600 },
  );
  const ai = await cached();
  return ai ? { text: ai, ai: true } : { text: fallback, ai: false };
}
