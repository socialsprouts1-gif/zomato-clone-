export type SortKey = "relevance" | "rating" | "delivery_time" | "cost_low" | "cost_high" | "distance";

export type Filters = {
  sort: SortKey;
  rating4: boolean;
  pureVeg: boolean;
  offers: boolean;
  fast: boolean;
  budget: boolean;
  isNew: boolean;
  cuisines: string[];
};

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Relevance",
  rating: "Rating: high to low",
  delivery_time: "Delivery time",
  cost_low: "Cost: low to high",
  cost_high: "Cost: high to low",
  distance: "Distance",
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilters(sp: SP): Filters {
  const sort = one(sp.sort) as SortKey | undefined;
  return {
    sort: sort && sort in SORT_LABELS ? sort : "relevance",
    rating4: one(sp.rating4) === "1",
    pureVeg: one(sp.veg) === "1",
    offers: one(sp.offers) === "1",
    fast: one(sp.fast) === "1",
    budget: one(sp.budget) === "1",
    isNew: one(sp.new) === "1",
    cuisines: (one(sp.cuisines) ?? "").split(",").map((c) => c.trim()).filter(Boolean),
  };
}

export function hasActiveFilters(f: Filters) {
  return f.sort !== "relevance" || f.rating4 || f.pureVeg || f.offers || f.fast || f.budget || f.isNew || f.cuisines.length > 0;
}

/** "What's on your mind?" circles and the cuisine they filter on. */
export const MIND_CUISINES: { label: string; emoji: string; cuisine: string }[] = [
  { label: "Biryani", emoji: "🍛", cuisine: "Biryani" },
  { label: "Pizza", emoji: "🍕", cuisine: "Pizza" },
  { label: "Burger", emoji: "🍔", cuisine: "Burger" },
  { label: "Thali", emoji: "🍱", cuisine: "Thali" },
  { label: "Chinese", emoji: "🥡", cuisine: "Chinese" },
  { label: "Dosa", emoji: "🥞", cuisine: "South Indian" },
  { label: "Rolls", emoji: "🌯", cuisine: "Rolls" },
  { label: "Cake", emoji: "🍰", cuisine: "Cake" },
  { label: "North Indian", emoji: "🍲", cuisine: "North Indian" },
  { label: "Momos", emoji: "🥟", cuisine: "Momos" },
  { label: "Healthy", emoji: "🥗", cuisine: "Healthy" },
  { label: "Desserts", emoji: "🍨", cuisine: "Desserts" },
  { label: "Street Food", emoji: "🥙", cuisine: "Street Food" },
  { label: "Seafood", emoji: "🦐", cuisine: "Seafood" },
];
