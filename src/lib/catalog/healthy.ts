import type { Enums } from "@/lib/supabase/database.types";

export type HealthyScore = Enums<"healthy_score">;

export const healthyMeta: Record<HealthyScore, { label: string; className: string }> = {
  super: { label: "Super", className: "bg-emerald-600 text-white" },
  high: { label: "High", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  low: { label: "Low", className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" },
};

const LOW = /fried|fries|butter|cheese|cream|malai|pizza|burger|shake|cake|brownie|sundae|ice cream|gulab|jamun|kulfi|waffle|pastry|biryani|naan|pav bhaji|loaded|nutella|kurkure|65|manchurian|chilli potato|tiramisu|mac & cheese|pancake/i;
const HIGH = /salad|grilled|steamed|sprouts|quinoa|bowl|idli|tofu|egg white|millet|smoothie|detox|thukpa|soup|tandoori roti|dal(?! makhani)|curd rice|upma|poha|lemon rice|grilled chicken|tikka(?! masala| biryani| pizza| roll)/i;

/**
 * Healthy Score for a dish: the stored score when nutrition is known,
 * otherwise a deterministic estimate from the dish name and tags.
 */
export function healthyScoreFor(item: { healthy_score: HealthyScore | null; name: string; tags: string[]; description?: string | null }): {
  score: HealthyScore;
  estimated: boolean;
} {
  if (item.healthy_score) return { score: item.healthy_score, estimated: false };
  const text = `${item.name} ${item.tags.join(" ")}`;
  if (HIGH.test(text) && !LOW.test(text)) return { score: "high", estimated: true };
  if (LOW.test(text)) return { score: "low", estimated: true };
  return { score: "medium", estimated: true };
}
