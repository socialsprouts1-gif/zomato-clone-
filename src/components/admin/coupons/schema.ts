import { z } from "zod";
import type { Tables } from "@/lib/supabase/database.types";
import { formatPaise } from "@/lib/utils";
import { amount, dateField, optionalInt, rupees } from "./form-helpers";

export type Coupon = Tables<"coupons">;

/** Platform coupons support the discount types the checkout engine can price without a menu item. */
export const COUPON_TYPES = { percent: "Percentage off", flat: "Flat amount off", free_delivery: "Free delivery" } as const;
export const PAYMENT_METHODS = { upi: "UPI", card: "Card", netbanking: "Netbanking", wallet: "Wallet", cod: "Cash on delivery" } as const;

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, "Code must be 3–20 letters or digits, no spaces")),
    title: z.string().trim().min(3, "Give the coupon a short title").max(60, "Keep the title under 60 characters"),
    description: z.string().trim().max(160, "Keep the description under 160 characters"),
    discount_type: z.enum(["percent", "flat", "free_delivery"]),
    percent: amount("the percentage"),
    flat_rupees: amount("the amount"),
    max_discount_rupees: amount("the cap").refine((n) => n === null || (n >= 1 && n <= 5000), "Cap must be ₹1–₹5,000"),
    min_order_rupees: rupees("Minimum order", 0, 20000),
    total_limit: optionalInt("Total uses", 1, 10_000_000),
    per_user_limit: optionalInt("Uses per customer", 1, 100).refine((n) => n !== null, "Uses per customer must be a whole number from 1 to 100"),
    first_order_only: z.boolean(),
    gold_only: z.boolean(),
    payment_method: z.enum(["", "upi", "card", "netbanking", "wallet", "cod"]),
    restaurant_id: z.union([z.literal(""), z.string().uuid()]),
    valid_from: dateField,
    valid_until: z.union([z.literal(""), dateField]),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.discount_type === "percent" && (v.percent === null || !Number.isInteger(v.percent) || v.percent < 1 || v.percent > 100))
      ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter a whole percentage from 1 to 100" });
    if (v.discount_type === "flat" && (!v.flat_rupees || v.flat_rupees < 1 || v.flat_rupees > 5000))
      ctx.addIssue({ code: "custom", path: ["flat_rupees"], message: "Enter an amount from ₹1 to ₹5,000" });
    if (v.discount_type === "flat" && v.flat_rupees && v.min_order_rupees !== null && v.min_order_rupees > 0 && v.flat_rupees > v.min_order_rupees)
      ctx.addIssue({ code: "custom", path: ["flat_rupees"], message: "Discount can't be more than the minimum order" });
    if (v.valid_until && v.valid_until < v.valid_from) ctx.addIssue({ code: "custom", path: ["valid_until"], message: "End date must be on or after the start date" });
  });
export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponFormValues = z.output<typeof couponFormSchema>;

export type CouponStatus = "active" | "scheduled" | "inactive" | "expired" | "exhausted";

export function couponStatus(c: Pick<Coupon, "is_active" | "valid_from" | "valid_until" | "total_limit" | "used_count">, now = new Date()): CouponStatus {
  if (c.valid_until && new Date(c.valid_until) < now) return "expired";
  if (!c.is_active) return "inactive";
  if (c.total_limit !== null && c.used_count >= c.total_limit) return "exhausted";
  if (new Date(c.valid_from) > now) return "scheduled";
  return "active";
}

export const STATUS_LABEL: Record<CouponStatus, string> = { active: "Active", scheduled: "Scheduled", inactive: "Inactive", expired: "Expired", exhausted: "Fully used" };

/** "25% off up to ₹60 · min ₹199". */
export function couponSummary(c: Pick<Coupon, "discount_type" | "discount_value" | "max_discount_paise" | "min_order_paise">) {
  const what =
    c.discount_type === "percent"
      ? `${c.discount_value}% off${c.max_discount_paise ? ` up to ${formatPaise(c.max_discount_paise)}` : ""}`
      : c.discount_type === "flat"
        ? `${formatPaise(c.discount_value)} off`
        : c.discount_type === "free_delivery"
          ? "Free delivery"
          : c.discount_type === "bogo"
            ? "Buy one get one"
            : "Free item";
  return `${what}${c.min_order_paise ? ` · min ${formatPaise(c.min_order_paise)}` : ""}`;
}

/** Human list of the coupon's eligibility rules. */
export function couponRules(c: Pick<Coupon, "first_order_only" | "gold_only" | "payment_method" | "per_user_limit" | "total_limit">, restaurantName?: string | null) {
  const rules: string[] = [];
  if (c.first_order_only) rules.push("New users (first order)");
  if (c.gold_only) rules.push("Gold members");
  if (c.payment_method) rules.push(`Pay by ${PAYMENT_METHODS[c.payment_method as keyof typeof PAYMENT_METHODS] ?? c.payment_method}`);
  if (restaurantName) rules.push(`Only at ${restaurantName}`);
  rules.push(`${c.per_user_limit}× per customer`);
  if (c.total_limit !== null) rules.push(`${c.total_limit.toLocaleString("en-IN")} uses in total`);
  return rules;
}
