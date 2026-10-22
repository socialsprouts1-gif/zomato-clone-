import { z } from "zod";
import type { Tables } from "@/lib/supabase/database.types";
import { amount, rupees } from "../coupons/form-helpers";

export type Zone = Tables<"delivery_zones">;
export type Slab = { min_km: number; max_km: number; fee_paise: number };

const num = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((s) => /^-?\d+(\.\d+)?$/.test(s) && Number(s) >= min && Number(s) <= max, `${label} must be between ${min} and ${max}`)
    .transform(Number);

export const zoneSchema = z.object({
  name: z.string().trim().min(2, "Name the zone").max(40, "Keep the name under 40 characters"),
  center_lat: num("Latitude", -90, 90),
  center_lng: num("Longitude", -180, 180),
  radius_km: num("Radius", 0.5, 50),
  is_active: z.boolean(),
});
export type ZoneInput = z.input<typeof zoneSchema>;
export type ZoneValues = z.output<typeof zoneSchema>;

export const slabsSchema = z
  .array(z.object({ min_km: num("From km", 0, 100), max_km: num("To km", 0.1, 100), fee_rupees: rupees("Fee", 0, 500) }))
  .min(1, "Add at least one slab")
  .max(20, "Use at most 20 slabs")
  .superRefine((rows, ctx) => {
    if (rows[0] && rows[0].min_km !== 0) ctx.addIssue({ code: "custom", message: "The first slab must start at 0 km" });
    rows.forEach((r, i) => {
      if (r.max_km <= r.min_km) ctx.addIssue({ code: "custom", message: `Slab ${i + 1}: “to” must be more than “from”` });
      const prev = rows[i - 1];
      if (prev && r.min_km !== prev.max_km) ctx.addIssue({ code: "custom", message: `Slab ${i + 1} must start where slab ${i} ends (${prev.max_km} km)` });
    });
  });
export type SlabsInput = z.input<typeof slabsSchema>;

export const feesSchema = z.object({
  platform_fee_rupees: rupees("Platform fee", 0, 100),
  gst_pct: amount("GST").refine((n) => n !== null && n >= 0 && n <= 28, "GST must be 0–28%"),
  max_delivery_km: amount("the delivery radius").refine((n) => n !== null && n >= 1 && n <= 50, "Delivery radius must be 1–50 km"),
});
export type FeesInput = z.input<typeof feesSchema>;
export type FeesValues = z.output<typeof feesSchema>;

export const surgeSchema = z.object({
  surge_rain: z.boolean(),
  surge_late_night: z.boolean(),
  surge_fee_rupees: rupees("Surge fee", 0, 200),
});
export type SurgeInput = z.input<typeof surgeSchema>;
export type SurgeValues = z.output<typeof surgeSchema>;

/** Matches the late-night window in src/lib/checkout/pricing.ts. */
export const LATE_NIGHT_WINDOW = "11 pm – 6 am IST";
