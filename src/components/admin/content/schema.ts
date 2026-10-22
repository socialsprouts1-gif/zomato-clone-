import { z } from "zod";
import type { Tables } from "@/lib/supabase/database.types";
import { dateField, optionalInt } from "../coupons/form-helpers";

export type Banner = Tables<"banners">;
export type Collection = Pick<Tables<"collections">, "id" | "title" | "slug" | "description" | "image_url" | "sort" | "created_at">;

/** Colour themes the home carousel knows (src/components/catalog/banner-carousel.tsx). */
export const BANNER_THEMES = { saffron: "Saffron", gold: "Gold", green: "Green", plum: "Plum", night: "Night" } as const;
export const LINK_TYPES = { restaurant: "A restaurant", collection: "A collection", coupon: "A coupon (opens the cart with it applied)", url: "A page or web address" } as const;
export type LinkType = keyof typeof LINK_TYPES;

const imageUrl = z
  .string()
  .trim()
  .refine((s) => s === "" || /^https?:\/\/\S+$/.test(s), "Use an uploaded image or a full https:// link");

export const bannerFormSchema = z
  .object({
    title: z.string().trim().min(3, "Give the banner a title").max(60, "Keep the title under 60 characters"),
    subtitle: z.string().trim().max(120, "Keep the subtitle under 120 characters"),
    cta_label: z.string().trim().max(24, "Keep the button label under 24 characters"),
    image_url: imageUrl,
    theme: z.enum(["saffron", "gold", "green", "plum", "night"]),
    link_type: z.enum(["restaurant", "collection", "coupon", "url"]),
    link_restaurant: z.string(),
    link_collection: z.string(),
    link_coupon: z.string(),
    link_url: z.string().trim(),
    sort: optionalInt("Position", 0, 999),
    is_active: z.boolean(),
    starts_at: z.union([z.literal(""), dateField]),
    ends_at: z.union([z.literal(""), dateField]),
  })
  .superRefine((v, ctx) => {
    if (v.link_type === "restaurant" && !v.link_restaurant) ctx.addIssue({ code: "custom", path: ["link_restaurant"], message: "Pick a restaurant" });
    if (v.link_type === "collection" && !v.link_collection) ctx.addIssue({ code: "custom", path: ["link_collection"], message: "Pick a collection" });
    if (v.link_type === "coupon" && !v.link_coupon) ctx.addIssue({ code: "custom", path: ["link_coupon"], message: "Pick a coupon" });
    if (v.link_type === "url" && !/^(\/[^\s]*|https:\/\/\S+)$/.test(v.link_url))
      ctx.addIssue({ code: "custom", path: ["link_url"], message: "Use a path like /dining or a full https:// address" });
    if (v.starts_at && v.ends_at && v.ends_at < v.starts_at) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "End date must be on or after the start date" });
  });
export type BannerFormInput = z.input<typeof bannerFormSchema>;
export type BannerFormValues = z.output<typeof bannerFormSchema>;

/** Builds the stored link_url for a banner target. */
export function bannerLink(v: Pick<BannerFormValues, "link_type" | "link_restaurant" | "link_collection" | "link_coupon" | "link_url">) {
  switch (v.link_type) {
    case "restaurant":
      return `/restaurant/${v.link_restaurant}`;
    case "collection":
      return `/collections/${v.link_collection}`;
    case "coupon":
      return `/cart?coupon=${encodeURIComponent(v.link_coupon)}`;
    default:
      return v.link_url;
  }
}

/** Reads a stored link_url back into the form's target fields. */
export function parseBannerLink(url: string): Pick<BannerFormInput, "link_type" | "link_restaurant" | "link_collection" | "link_coupon" | "link_url"> {
  const base = { link_restaurant: "", link_collection: "", link_coupon: "", link_url: "" };
  let m = /^\/restaurant\/([a-z0-9-]+)$/i.exec(url);
  if (m) return { ...base, link_type: "restaurant", link_restaurant: m[1]! };
  m = /^\/collections\/([a-z0-9-]+)$/i.exec(url);
  if (m) return { ...base, link_type: "collection", link_collection: m[1]! };
  m = /^\/cart\?coupon=([A-Z0-9]+)$/i.exec(url);
  if (m) return { ...base, link_type: "coupon", link_coupon: m[1]!.toUpperCase() };
  return { ...base, link_type: "url", link_url: url };
}

export function describeLink(url: string, names: { restaurants: Map<string, string>; collections: Map<string, string> }) {
  const p = parseBannerLink(url);
  if (p.link_type === "restaurant") return `Restaurant · ${names.restaurants.get(p.link_restaurant) ?? p.link_restaurant}`;
  if (p.link_type === "collection") return `Collection · ${names.collections.get(p.link_collection) ?? p.link_collection}`;
  if (p.link_type === "coupon") return `Coupon · ${p.link_coupon}`;
  return url;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

export const collectionFormSchema = z.object({
  title: z.string().trim().min(3, "Give the collection a title").max(60, "Keep the title under 60 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes")
    .min(3, "Slug must be at least 3 characters")
    .max(60, "Keep the slug under 60 characters"),
  description: z.string().trim().max(160, "Keep the description under 160 characters"),
  image_url: imageUrl,
  sort: optionalInt("Position", 0, 999),
});
export type CollectionFormInput = z.input<typeof collectionFormSchema>;
export type CollectionFormValues = z.output<typeof collectionFormSchema>;

export type BannerStatus = "live" | "scheduled" | "ended" | "hidden";
export function bannerStatus(b: Pick<Banner, "is_active" | "starts_at" | "ends_at">, now = new Date()): BannerStatus {
  if (!b.is_active) return "hidden";
  if (b.ends_at && new Date(b.ends_at) < now) return "ended";
  if (b.starts_at && new Date(b.starts_at) > now) return "scheduled";
  return "live";
}
