"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { syncCampaigns, istStart, istToday, tickCampaign } from "@/app/partner/(console)/offers/data";
import { campaignFormSchema, offerFormSchema, type CampaignFormInput, type OfferFormInput } from "@/components/partner/offers/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function guardRestaurant(restaurantId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Please sign in again");
  const supabase = await getSupabaseServerClient();
  const { data: member } = await supabase.rpc("is_restaurant_member", { rid: restaurantId });
  if (!member && user.profile.role !== "admin") throw new Error("You don't manage this restaurant");
  return { user, supabase };
}

function firstIssue(e: z.ZodError) {
  return e.issues[0]?.message ?? "Check the form";
}

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
    revalidatePath("/partner/offers");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: firstIssue(e) };
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

const uuid = z.string().uuid();

export async function saveOffer(restaurantId: string, offerId: string | null, input: OfferFormInput): Promise<Result> {
  return run(async () => {
    const { supabase } = await guardRestaurant(uuid.parse(restaurantId));
    const v = offerFormSchema.parse(input);

    // Dishes must belong to this outlet.
    const dishId = v.discount_type === "bogo" ? v.bogo_item_id : v.discount_type === "free_item" ? v.free_item_id : null;
    if (dishId) {
      const { data: dish } = await supabase.from("menu_items").select("id").eq("id", uuid.parse(dishId)).eq("restaurant_id", restaurantId).eq("is_deleted", false).maybeSingle();
      if (!dish) throw new Error("Pick a dish from this outlet's menu");
    }
    // A platform coupon with the same code would shadow the offer at checkout.
    const { data: clash } = await supabase.from("coupons").select("id").eq("code", v.code).maybeSingle();
    if (clash) throw new Error(`${v.code} is already a Thaali coupon code. Choose another code.`);

    const row = {
      restaurant_id: restaurantId,
      title: v.title,
      description: v.description || null,
      code: v.code,
      discount_type: v.discount_type,
      discount_value: v.discount_type === "percent" ? (v.percent ?? 0) : v.discount_type === "flat" ? Math.round((v.flat_rupees ?? 0) * 100) : 0,
      max_discount_paise: v.discount_type === "percent" && v.max_discount_rupees ? Math.round(v.max_discount_rupees * 100) : null,
      min_order_paise: Math.round((v.min_order_rupees ?? 0) * 100),
      bogo_item_id: v.discount_type === "bogo" ? v.bogo_item_id : null,
      free_item_id: v.discount_type === "free_item" ? v.free_item_id : null,
      target: v.target,
      applies_to: v.applies_to,
      // Starting today means "now"; a later date starts at IST midnight. Offers run to the end of their last day.
      valid_from: v.valid_from <= istToday() ? new Date().toISOString() : istStart(v.valid_from).toISOString(),
      valid_until: v.valid_until ? new Date(istStart(v.valid_until).getTime() + 86_400_000 - 1000).toISOString() : null,
    };
    const { error } = offerId
      ? await supabase.from("restaurant_offers").update(row).eq("id", uuid.parse(offerId)).eq("restaurant_id", restaurantId)
      : await supabase.from("restaurant_offers").insert({ ...row, is_active: true });
    if (error?.code === "23505") throw new Error(`You already have an offer with code ${v.code}`);
    if (error) throw new Error("Couldn't save the offer");
    await revalidateRestaurant(restaurantId);
  });
}

async function revalidateRestaurant(restaurantId: string) {
  const { data } = await getSupabaseAdminClient().from("restaurants").select("slug").eq("id", restaurantId).single();
  if (data) revalidatePath(`/restaurant/${data.slug}`);
}

export async function setOfferActive(restaurantId: string, offerId: string, active: boolean): Promise<Result> {
  return run(async () => {
    const { supabase } = await guardRestaurant(uuid.parse(restaurantId));
    const { error } = await supabase.from("restaurant_offers").update({ is_active: active }).eq("id", uuid.parse(offerId)).eq("restaurant_id", restaurantId);
    if (error) throw new Error("Couldn't update the offer");
    await revalidateRestaurant(restaurantId);
  });
}

export async function deleteOffer(restaurantId: string, offerId: string): Promise<Result> {
  return run(async () => {
    const { supabase } = await guardRestaurant(uuid.parse(restaurantId));
    const { error } = await supabase.from("restaurant_offers").delete().eq("id", uuid.parse(offerId)).eq("restaurant_id", restaurantId);
    if (error) throw new Error("Couldn't delete the offer");
    await revalidateRestaurant(restaurantId);
  });
}

export async function createCampaign(restaurantId: string, input: CampaignFormInput): Promise<Result> {
  return run(async () => {
    const { supabase } = await guardRestaurant(uuid.parse(restaurantId));
    const v = campaignFormSchema.parse(input);
    if (v.starts_on < istToday()) throw new Error("Start date can't be in the past");
    const { error } = await supabase.from("ad_campaigns").insert({
      restaurant_id: restaurantId,
      name: v.name,
      daily_budget_paise: Math.round((v.daily_budget_rupees ?? 0) * 100),
      starts_on: v.starts_on,
      ends_on: v.ends_on,
      status: "active",
      last_ticked_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't create the campaign");
    await syncCampaigns(restaurantId);
    revalidatePath("/");
  });
}

export async function setCampaignStatus(restaurantId: string, campaignId: string, status: "active" | "paused" | "ended"): Promise<Result> {
  return run(async () => {
    const { supabase } = await guardRestaurant(uuid.parse(restaurantId));
    const want = z.enum(["active", "paused", "ended"]).parse(status);
    const { data: c } = await supabase.from("ad_campaigns").select("*").eq("id", uuid.parse(campaignId)).eq("restaurant_id", restaurantId).maybeSingle();
    if (!c) throw new Error("Campaign not found");
    if (c.status === "ended") throw new Error("This campaign has ended");
    // Bank the metrics earned so far before changing state.
    const ticked = tickCampaign(c);
    if (ticked.status === "ended" && want === "active") throw new Error("This campaign's end date has passed");
    const { error } = await supabase
      .from("ad_campaigns")
      .update({
        spend_paise: ticked.spend_paise,
        impressions: ticked.impressions,
        clicks: ticked.clicks,
        orders: ticked.orders,
        status: ticked.status === "ended" ? "ended" : want,
        // Resuming restarts the clock so paused time never accrues spend.
        last_ticked_at: want === "active" ? new Date().toISOString() : ticked.last_ticked_at,
      })
      .eq("id", c.id);
    if (error) throw new Error("Couldn't update the campaign");
    await syncCampaigns(restaurantId);
    revalidatePath("/");
  });
}
