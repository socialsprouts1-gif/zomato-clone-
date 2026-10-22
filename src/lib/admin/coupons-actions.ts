"use server";

import { z } from "zod";
import { istDayEnd, istDayStart, parseOrThrow, toPaise } from "@/components/admin/coupons/form-helpers";
import { couponFormSchema, type CouponFormInput } from "@/components/admin/coupons/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminAction } from "./guard";

const uuid = z.string().uuid("Unknown coupon");
const PATHS = ["/admin/coupons"];

export async function saveCoupon(id: string | null, input: CouponFormInput) {
  return adminAction<{ id: string }>(async () => {
    const couponId = id ? parseOrThrow(uuid, id) : null;
    const v = parseOrThrow(couponFormSchema, input);
    const db = getSupabaseAdminClient();

    const [{ data: dupe }, { data: offerClash }] = await Promise.all([
      db.from("coupons").select("id").eq("code", v.code).maybeSingle(),
      db.from("restaurant_offers").select("id").ilike("code", v.code).limit(1),
    ]);
    if (dupe && dupe.id !== couponId) throw new Error(`${v.code} already exists. Choose another code.`);
    if (offerClash?.length) throw new Error(`${v.code} is already used by a restaurant offer. Choose another code.`);
    if (v.restaurant_id) {
      const { data: r } = await db.from("restaurants").select("id").eq("id", v.restaurant_id).maybeSingle();
      if (!r) throw new Error("That restaurant no longer exists");
    }

    const row = {
      code: v.code,
      title: v.title,
      description: v.description || null,
      discount_type: v.discount_type,
      discount_value: v.discount_type === "percent" ? (v.percent ?? 0) : v.discount_type === "flat" ? (toPaise(v.flat_rupees) ?? 0) : 0,
      max_discount_paise: v.discount_type === "percent" ? toPaise(v.max_discount_rupees) : null,
      min_order_paise: toPaise(v.min_order_rupees) ?? 0,
      total_limit: v.total_limit,
      per_user_limit: v.per_user_limit ?? 1,
      first_order_only: v.first_order_only,
      gold_only: v.gold_only,
      payment_method: v.payment_method || null,
      restaurant_id: v.restaurant_id || null,
      valid_from: istDayStart(v.valid_from),
      valid_until: v.valid_until ? istDayEnd(v.valid_until) : null,
      is_active: v.is_active,
    };
    const { data, error } = couponId
      ? await db.from("coupons").update(row).eq("id", couponId).select("id").single()
      : await db.from("coupons").insert(row).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Couldn't save the coupon");
    return {
      data: { id: data.id },
      audit: { action: couponId ? "coupon.update" : "coupon.create", entityType: "coupon", entityId: data.id, details: row },
    };
  }, PATHS);
}

export async function setCouponActive(id: string, active: boolean) {
  return adminAction(async () => {
    const couponId = parseOrThrow(uuid, id);
    const { data, error } = await getSupabaseAdminClient().from("coupons").update({ is_active: active }).eq("id", couponId).select("code").single();
    if (error || !data) throw new Error(error?.message ?? "Coupon not found");
    return { audit: { action: active ? "coupon.activate" : "coupon.deactivate", entityType: "coupon", entityId: couponId, details: { code: data.code } } };
  }, PATHS);
}

/** Deletes an unused coupon. A coupon that has been redeemed is deactivated instead so order history stays intact. */
export async function deleteCoupon(id: string) {
  return adminAction<{ deactivated: boolean }>(async () => {
    const couponId = parseOrThrow(uuid, id);
    const db = getSupabaseAdminClient();
    const [{ data: c }, { count }] = await Promise.all([
      db.from("coupons").select("code, used_count").eq("id", couponId).maybeSingle(),
      db.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", couponId),
    ]);
    if (!c) throw new Error("Coupon not found");
    if ((count ?? 0) > 0 || c.used_count > 0) {
      const { error } = await db.from("coupons").update({ is_active: false }).eq("id", couponId);
      if (error) throw new Error(error.message);
      return {
        data: { deactivated: true },
        audit: { action: "coupon.deactivate", entityType: "coupon", entityId: couponId, details: { code: c.code, reason: "delete requested for a used coupon", redemptions: count ?? 0 } },
      };
    }
    const { error } = await db.from("coupons").delete().eq("id", couponId);
    if (error) throw new Error(error.message);
    return { data: { deactivated: false }, audit: { action: "coupon.delete", entityType: "coupon", entityId: couponId, details: { code: c.code } } };
  }, PATHS);
}
