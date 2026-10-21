import "server-only";

import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuOption } from "@/components/partner/offers/offer-dialog";
import type { OfferStats } from "@/components/partner/offers/offers-panel";
import type { Tables } from "@/lib/supabase/database.types";

export type Campaign = Tables<"ad_campaigns">;
export type OfferRow = Tables<"restaurant_offers">;

const DAY_MS = 86_400_000;
/** Orders that never went through (or were reversed) don't count towards offer performance. */
const NOT_COUNTED = ["PENDING_PAYMENT", "FAILED_PAYMENT", "REJECTED", "CANCELLED", "CANCELLED_BY_CUSTOMER"] as const;

/** Start of a calendar date in IST. */
export const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
/** Today's date (YYYY-MM-DD) in IST. */
export const istToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

/** Stable per-campaign numbers in [0, 1) so every campaign performs a little differently, but always the same way. */
function seed(id: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Simulated auction rates for a campaign: cost per 1000 impressions (paise), click-through rate, clicks→orders rate. */
export function campaignRates(id: string) {
  return { cpmPaise: 12_000 + Math.round(seed(id, 1) * 6_000), ctr: 0.05 + seed(id, 2) * 0.03, cvr: 0.06 + seed(id, 3) * 0.04 };
}

/**
 * Advances an active campaign's simulated metrics to `now`.
 * Spend accrues at daily_budget per 24 h inside the campaign window (IST dates), starting from last_ticked_at, so paused
 * time never counts. Impressions/clicks/orders are derived from cumulative spend with the campaign's fixed rates
 * (differences of floors), which keeps the numbers deterministic no matter how often the page is loaded.
 */
export function tickCampaign(c: Campaign, now = new Date()): Campaign {
  if (c.status !== "active") return c;
  const windowStart = istStart(c.starts_on).getTime();
  const windowEnd = c.ends_on ? istStart(c.ends_on).getTime() + DAY_MS : Infinity;
  const from = Math.max(new Date(c.last_ticked_at).getTime(), windowStart);
  const to = Math.min(now.getTime(), windowEnd);
  const next = { ...c };
  if (to > from) {
    const spendDelta = Math.floor((c.daily_budget_paise * (to - from)) / DAY_MS);
    if (spendDelta > 0) {
      const { cpmPaise, ctr, cvr } = campaignRates(c.id);
      const oldSpend = Number(c.spend_paise);
      const newSpend = oldSpend + spendDelta;
      const imp = (s: number) => Math.floor((s * 1000) / cpmPaise);
      const impDelta = imp(newSpend) - imp(oldSpend);
      const clickDelta = Math.floor((c.impressions + impDelta) * ctr) - Math.floor(c.impressions * ctr);
      const orderDelta = Math.floor((c.clicks + clickDelta) * cvr) - Math.floor(c.clicks * cvr);
      next.spend_paise = newSpend;
      next.impressions = c.impressions + Math.max(0, impDelta);
      next.clicks = c.clicks + Math.max(0, clickDelta);
      next.orders = c.orders + Math.max(0, orderDelta);
      next.last_ticked_at = new Date(from + Math.round((spendDelta / c.daily_budget_paise) * DAY_MS)).toISOString();
    }
  }
  if (now.getTime() >= windowEnd) next.status = "ended";
  return next;
}

/** Restaurants with a running (started, not ended) campaign are sponsored in discovery until its last day ends. */
export function sponsoredUntil(campaigns: Campaign[], now = new Date()): string | null {
  const today = istToday(now);
  const ends = campaigns
    .filter((c) => c.status === "active" && c.starts_on <= today && c.ends_on)
    .map((c) => istStart(c.ends_on as string).getTime() + DAY_MS)
    .filter((t) => t > now.getTime());
  return ends.length ? new Date(Math.max(...ends)).toISOString() : null;
}

/** Ticks all campaigns of an outlet, persists changes and keeps restaurants.sponsored_until in step. Caller must be authorised. */
export async function syncCampaigns(restaurantId: string): Promise<Campaign[]> {
  const db = getSupabaseAdminClient();
  const [{ data }, { data: r }] = await Promise.all([
    db.from("ad_campaigns").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }),
    db.from("restaurants").select("sponsored_until").eq("id", restaurantId).single(),
  ]);
  const now = new Date();
  const list = (data ?? []).map((c) => {
    const t = tickCampaign(c, now);
    return { before: c, after: t };
  });
  await Promise.all(
    list
      .filter(({ before, after }) => before.spend_paise !== after.spend_paise || before.status !== after.status)
      .map(({ after }) =>
        db
          .from("ad_campaigns")
          .update({ spend_paise: after.spend_paise, impressions: after.impressions, clicks: after.clicks, orders: after.orders, last_ticked_at: after.last_ticked_at, status: after.status })
          .eq("id", after.id),
      ),
  );
  const campaigns = list.map((x) => x.after);
  const until = sponsoredUntil(campaigns, now);
  const current = r?.sponsored_until ?? null;
  if ((current === null) !== (until === null) || (current && until && new Date(current).getTime() !== new Date(until).getTime())) {
    await db.from("restaurants").update({ sponsored_until: until }).eq("id", restaurantId);
  }
  return campaigns;
}

/** Offers for an outlet with per-offer performance from orders that used them. */
export async function loadOffers(restaurantId: string) {
  const supabase = await getSupabaseServerClient();
  const [{ data: offers }, { data: items }] = await Promise.all([
    supabase.from("restaurant_offers").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }),
    supabase.from("menu_items").select("id, name, price_paise").eq("restaurant_id", restaurantId).eq("is_deleted", false).order("name"),
  ]);
  const ids = (offers ?? []).map((o) => o.id);
  const stats: Record<string, OfferStats> = {};
  if (ids.length) {
    const { data: orders } = await supabase
      .from("orders")
      .select("restaurant_offer_id, discount_paise, item_total_paise")
      .eq("restaurant_id", restaurantId)
      .in("restaurant_offer_id", ids)
      .not("status", "in", `(${NOT_COUNTED.join(",")})`);
    for (const o of orders ?? []) {
      if (!o.restaurant_offer_id) continue;
      const s = (stats[o.restaurant_offer_id] ??= { orders: 0, discountPaise: 0, revenuePaise: 0 });
      s.orders += 1;
      s.discountPaise += o.discount_paise;
      s.revenuePaise += o.item_total_paise - o.discount_paise;
    }
  }
  const menu: MenuOption[] = (items ?? []).map((i) => ({ id: i.id, name: i.name, pricePaise: i.price_paise }));
  return { offers: offers ?? [], stats, menu };
}
