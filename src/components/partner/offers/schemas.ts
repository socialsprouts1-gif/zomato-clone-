import { z } from "zod";

/** A numeric text input ("" allowed when optional) → number | null. Forms keep raw strings; this parses them. */
const amount = (label: string) =>
  z
    .string()
    .trim()
    .refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), `Enter ${label} as a number`)
    .transform((s) => (s === "" ? null : Number(s)));
const rupees = (label: string, min: number, max: number) =>
  amount(label.toLowerCase()).refine((n) => n !== null && n >= min && n <= max, `${label} must be ₹${min.toLocaleString("en-IN")}–₹${max.toLocaleString("en-IN")}`);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

/** Offer form. Money fields are rupees here; the server converts to paise. */
export const offerFormSchema = z
  .object({
    title: z.string().trim().min(3, "Give the offer a short title").max(60),
    description: z.string().trim().max(140, "Keep it under 140 characters"),
    code: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, "3–20 letters or digits, no spaces")),
    discount_type: z.enum(["percent", "flat", "free_delivery", "bogo", "free_item"]),
    percent: amount("the percentage"),
    flat_rupees: amount("the amount"),
    max_discount_rupees: amount("the cap").refine((n) => n === null || (n >= 1 && n <= 5000), "Cap must be ₹1–₹5,000"),
    min_order_rupees: rupees("Minimum order", 0, 10000),
    bogo_item_id: z.string(),
    free_item_id: z.string(),
    target: z.enum(["all", "new_users", "gold"]),
    applies_to: z.enum(["delivery", "dining", "both"]),
    valid_from: date,
    valid_until: z.union([z.literal(""), date]),
  })
  .superRefine((v, ctx) => {
    if (v.discount_type === "percent" && (v.percent === null || !Number.isInteger(v.percent) || v.percent < 1 || v.percent > 100))
      ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter a whole percentage from 1 to 100" });
    if (v.discount_type === "flat" && (!v.flat_rupees || v.flat_rupees < 1 || v.flat_rupees > 2000))
      ctx.addIssue({ code: "custom", path: ["flat_rupees"], message: "Enter an amount from ₹1 to ₹2,000" });
    if (v.discount_type === "flat" && v.flat_rupees && v.min_order_rupees && v.flat_rupees > v.min_order_rupees)
      ctx.addIssue({ code: "custom", path: ["flat_rupees"], message: "Discount can't be more than the minimum order" });
    if (v.discount_type === "bogo" && !v.bogo_item_id) ctx.addIssue({ code: "custom", path: ["bogo_item_id"], message: "Pick the dish for buy-one-get-one" });
    if (v.discount_type === "free_item" && !v.free_item_id) ctx.addIssue({ code: "custom", path: ["free_item_id"], message: "Pick the free dish" });
    if (v.valid_until && v.valid_until < v.valid_from) ctx.addIssue({ code: "custom", path: ["valid_until"], message: "End date must be after the start date" });
  });
export type OfferFormInput = z.input<typeof offerFormSchema>;
export type OfferFormValues = z.output<typeof offerFormSchema>;

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(3, "Name your campaign").max(60),
    daily_budget_rupees: rupees("Daily budget", 100, 50000),
    starts_on: date,
    ends_on: date,
  })
  .superRefine((v, ctx) => {
    if (v.ends_on < v.starts_on) ctx.addIssue({ code: "custom", path: ["ends_on"], message: "End date must be on or after the start date" });
    const days = (new Date(v.ends_on).getTime() - new Date(v.starts_on).getTime()) / 86_400_000;
    if (days > 90) ctx.addIssue({ code: "custom", path: ["ends_on"], message: "Campaigns can run for up to 90 days" });
  });
export type CampaignFormInput = z.input<typeof campaignFormSchema>;
export type CampaignFormValues = z.output<typeof campaignFormSchema>;

export const DISCOUNT_LABEL: Record<OfferFormValues["discount_type"], string> = {
  percent: "Percentage off",
  flat: "Flat amount off",
  free_delivery: "Free delivery",
  bogo: "Buy one get one",
  free_item: "Free dish",
};
