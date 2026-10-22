import { z } from "zod";
import type { Tables } from "@/lib/supabase/database.types";
import { amount, optionalInt, rupees } from "../coupons/form-helpers";

export type GoldPlan = Tables<"gold_plans">;

export const goldPlanSchema = z
  .object({
    name: z.string().trim().min(3, "Name the plan").max(40, "Keep the name under 40 characters"),
    duration_months: optionalInt("Duration", 1, 36).refine((n) => n !== null, "Duration must be 1–36 months"),
    price_rupees: rupees("Price", 1, 10000),
    original_price_rupees: amount("the original price"),
    sort: optionalInt("Position", 0, 99),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.original_price_rupees !== null && v.price_rupees !== null && v.original_price_rupees <= v.price_rupees)
      ctx.addIssue({ code: "custom", path: ["original_price_rupees"], message: "Original price must be higher than the price (or leave it empty)" });
  });
export type GoldPlanInput = z.input<typeof goldPlanSchema>;
export type GoldPlanValues = z.output<typeof goldPlanSchema>;

const pct = (label: string, max: number) =>
  amount(label.toLowerCase()).refine((n) => n !== null && n >= 0 && n <= max, `${label} must be 0–${max}%`);

export const goldBenefitsSchema = z.object({
  free_delivery_min_rupees: rupees("Free delivery minimum", 0, 5000),
  extra_discount_pct: pct("Extra delivery discount", 50),
  dining_discount_pct: pct("Dining discount", 50),
});
export type GoldBenefitsInput = z.input<typeof goldBenefitsSchema>;
export type GoldBenefitsValues = z.output<typeof goldBenefitsSchema>;

/** The checkout caps the Gold extra discount per order (src/lib/checkout/pricing.ts). */
export const GOLD_DISCOUNT_CAP_PAISE = 7500;
