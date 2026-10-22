"use server";

import { z } from "zod";
import { parseOrThrow, toPaise } from "@/components/admin/coupons/form-helpers";
import { feesSchema, slabsSchema, surgeSchema, zoneSchema, type FeesInput, type SlabsInput, type SurgeInput, type ZoneInput } from "@/components/admin/settings/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminAction } from "./guard";

const uuid = z.string().uuid("Unknown zone");
const PATHS = ["/admin/settings"];

export async function saveZone(id: string | null, input: ZoneInput) {
  return adminAction<{ id: string }>(async () => {
    const zoneId = id ? parseOrThrow(uuid, id) : null;
    const v = parseOrThrow(zoneSchema, input);
    const db = getSupabaseAdminClient();
    const { data, error } = zoneId
      ? await db.from("delivery_zones").update(v).eq("id", zoneId).select("id").single()
      : await db.from("delivery_zones").insert(v).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Couldn't save the zone");
    return { data: { id: data.id }, audit: { action: zoneId ? "zone.update" : "zone.create", entityType: "delivery_zone", entityId: data.id, details: v } };
  }, PATHS);
}

export async function setZoneActive(id: string, active: boolean) {
  return adminAction(async () => {
    const zoneId = parseOrThrow(uuid, id);
    const { data, error } = await getSupabaseAdminClient().from("delivery_zones").update({ is_active: active }).eq("id", zoneId).select("name").single();
    if (error || !data) throw new Error(error?.message ?? "Zone not found");
    return { audit: { action: active ? "zone.activate" : "zone.deactivate", entityType: "delivery_zone", entityId: zoneId, details: { name: data.name } } };
  }, PATHS);
}

export async function deleteZone(id: string) {
  return adminAction(async () => {
    const zoneId = parseOrThrow(uuid, id);
    const db = getSupabaseAdminClient();
    const { count } = await db.from("delivery_zones").select("id", { count: "exact", head: true }).eq("is_active", true).neq("id", zoneId);
    if (!count) throw new Error("Keep at least one active zone");
    const { data, error } = await db.from("delivery_zones").delete().eq("id", zoneId).select("name").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Zone not found");
    return { audit: { action: "zone.delete", entityType: "delivery_zone", entityId: zoneId, details: { name: data.name } } };
  }, PATHS);
}

/** Replaces all delivery fee slabs (validated to be contiguous from 0 km). */
export async function saveFeeSlabs(input: SlabsInput) {
  return adminAction(async () => {
    const rows = parseOrThrow(slabsSchema, input).map((r) => ({ min_km: r.min_km, max_km: r.max_km, fee_paise: toPaise(r.fee_rupees) ?? 0 }));
    const db = getSupabaseAdminClient();
    const { data: before } = await db.from("fee_slabs").select("min_km, max_km, fee_paise").order("min_km");
    const { error: delErr } = await db.from("fee_slabs").delete().gte("min_km", 0);
    if (delErr) throw new Error(delErr.message);
    const { error } = await db.from("fee_slabs").insert(rows);
    if (error) {
      // Put the previous slabs back so checkout always has a fee table.
      if (before?.length) await db.from("fee_slabs").insert(before);
      throw new Error(error.message);
    }
    return { audit: { action: "settings.fee_slabs", entityType: "platform_settings", entityId: null, details: { slabs: rows, previous: before ?? [] } } };
  }, PATHS);
}

export async function saveFees(input: FeesInput) {
  return adminAction(async () => {
    const v = parseOrThrow(feesSchema, input);
    const row = { platform_fee_paise: toPaise(v.platform_fee_rupees) ?? 0, gst_pct: v.gst_pct ?? 0, max_delivery_km: v.max_delivery_km ?? 10, updated_at: new Date().toISOString() };
    const { error } = await getSupabaseAdminClient().from("platform_settings").update(row).eq("id", true);
    if (error) throw new Error(error.message);
    return { audit: { action: "settings.fees", entityType: "platform_settings", entityId: null, details: row } };
  }, PATHS);
}

export async function saveSurge(input: SurgeInput) {
  return adminAction(async () => {
    const v = parseOrThrow(surgeSchema, input);
    const row = { surge_rain: v.surge_rain, surge_late_night: v.surge_late_night, surge_fee_paise: toPaise(v.surge_fee_rupees) ?? 0, updated_at: new Date().toISOString() };
    const { error } = await getSupabaseAdminClient().from("platform_settings").update(row).eq("id", true);
    if (error) throw new Error(error.message);
    const on = v.surge_rain || v.surge_late_night;
    return { audit: { action: on ? "settings.surge_on" : "settings.surge_off", entityType: "platform_settings", entityId: null, details: row } };
  }, PATHS);
}
