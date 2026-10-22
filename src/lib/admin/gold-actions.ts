"use server";

import { z } from "zod";
import { parseOrThrow, toPaise } from "@/components/admin/coupons/form-helpers";
import { goldBenefitsSchema, goldPlanSchema, type GoldBenefitsInput, type GoldPlanInput } from "@/components/admin/gold/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminAction } from "./guard";

const uuid = z.string().uuid("Unknown plan");
const PATHS = ["/admin/gold"];

export async function saveGoldPlan(id: string | null, input: GoldPlanInput) {
  return adminAction<{ id: string }>(async () => {
    const planId = id ? parseOrThrow(uuid, id) : null;
    const v = parseOrThrow(goldPlanSchema, input);
    const db = getSupabaseAdminClient();
    let sort = v.sort;
    if (sort === null) {
      const { data: last } = await db.from("gold_plans").select("sort").order("sort", { ascending: false }).limit(1);
      sort = planId ? 0 : (last?.[0]?.sort ?? -1) + 1;
    }
    const row = {
      name: v.name,
      duration_months: v.duration_months ?? 1,
      price_paise: toPaise(v.price_rupees) ?? 0,
      original_price_paise: toPaise(v.original_price_rupees),
      sort,
      is_active: v.is_active,
    };
    const before = planId ? (await db.from("gold_plans").select("price_paise").eq("id", planId).maybeSingle()).data : null;
    if (planId && !before) throw new Error("Plan not found");
    const { data, error } = planId
      ? await db.from("gold_plans").update(row).eq("id", planId).select("id").single()
      : await db.from("gold_plans").insert(row).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Couldn't save the plan");
    return {
      data: { id: data.id },
      audit: {
        action: planId ? (before && before.price_paise !== row.price_paise ? "gold_plan.reprice" : "gold_plan.update") : "gold_plan.create",
        entityType: "gold_plan",
        entityId: data.id,
        details: { ...row, previous_price_paise: before?.price_paise ?? null },
      },
    };
  }, PATHS);
}

export async function setGoldPlanActive(id: string, active: boolean) {
  return adminAction(async () => {
    const planId = parseOrThrow(uuid, id);
    const { data, error } = await getSupabaseAdminClient().from("gold_plans").update({ is_active: active }).eq("id", planId).select("name").single();
    if (error || !data) throw new Error(error?.message ?? "Plan not found");
    return { audit: { action: active ? "gold_plan.activate" : "gold_plan.deactivate", entityType: "gold_plan", entityId: planId, details: { name: data.name } } };
  }, PATHS);
}

/** Deletes a plan nobody has bought; plans with members can only be deactivated. */
export async function deleteGoldPlan(id: string) {
  return adminAction(async () => {
    const planId = parseOrThrow(uuid, id);
    const db = getSupabaseAdminClient();
    const [{ data: plan }, { count }] = await Promise.all([
      db.from("gold_plans").select("name").eq("id", planId).maybeSingle(),
      db.from("gold_memberships").select("id", { count: "exact", head: true }).eq("plan_id", planId),
    ]);
    if (!plan) throw new Error("Plan not found");
    if (count) throw new Error("Members have bought this plan, so it can't be deleted. Deactivate it instead.");
    const { error } = await db.from("gold_plans").delete().eq("id", planId);
    if (error) throw new Error(error.message);
    return { audit: { action: "gold_plan.delete", entityType: "gold_plan", entityId: planId, details: { name: plan.name } } };
  }, PATHS);
}

export async function saveGoldBenefits(input: GoldBenefitsInput) {
  return adminAction(async () => {
    const v = parseOrThrow(goldBenefitsSchema, input);
    const row = {
      gold_free_delivery_min_paise: toPaise(v.free_delivery_min_rupees) ?? 0,
      gold_extra_discount_pct: v.extra_discount_pct ?? 0,
      gold_dining_discount_pct: v.dining_discount_pct ?? 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = await getSupabaseAdminClient().from("platform_settings").update(row).eq("id", true);
    if (error) throw new Error(error.message);
    return { audit: { action: "settings.gold_benefits", entityType: "platform_settings", entityId: null, details: row } };
  }, PATHS);
}
