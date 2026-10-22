"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBanner } from "@/lib/admin/content-actions";
import { istDate, selectClass } from "../coupons/form-helpers";
import { ImageField } from "./image-field";
import { BANNER_THEMES, bannerFormSchema, LINK_TYPES, parseBannerLink, type Banner, type BannerFormInput, type BannerFormValues } from "./schema";

export type LinkOptions = {
  restaurants: { slug: string; name: string }[];
  collections: { slug: string; title: string }[];
  coupons: { code: string; title: string }[];
};

function defaults(b: Banner | null): BannerFormInput {
  if (!b) {
    return {
      title: "", subtitle: "", cta_label: "Order now", image_url: "", theme: "saffron", link_type: "restaurant", link_restaurant: "", link_collection: "", link_coupon: "", link_url: "",
      sort: "", is_active: true, starts_at: "", ends_at: "",
    };
  }
  return {
    title: b.title,
    subtitle: b.subtitle ?? "",
    cta_label: b.cta_label ?? "",
    image_url: b.image_url ?? "",
    theme: (b.theme in BANNER_THEMES ? b.theme : "saffron") as BannerFormInput["theme"],
    ...parseBannerLink(b.link_url),
    sort: String(b.sort),
    is_active: b.is_active,
    starts_at: b.starts_at ? istDate(b.starts_at) : "",
    ends_at: b.ends_at ? istDate(b.ends_at) : "",
  };
}

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

export function BannerDialog({ open, onOpenChange, banner, options }: { open: boolean; onOpenChange: (v: boolean) => void; banner: Banner | null; options: LinkOptions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<BannerFormInput, unknown, BannerFormValues>({ resolver: zodResolver(bannerFormSchema), defaultValues: defaults(banner) });
  const { register, formState, watch, reset, setValue } = form;
  const errors = formState.errors;
  const [linkType, imageUrl, title] = watch(["link_type", "image_url", "title"]);

  useEffect(() => {
    if (open) reset(defaults(banner));
  }, [open, banner, reset]);

  function submit(v: BannerFormValues) {
    start(async () => {
      const res = await saveBanner(banner?.id ?? null, form.getValues());
      if (!res.ok) return void toast.error(res.error);
      toast.success(banner ? "Banner updated" : `“${v.title}” added to the carousel`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{banner ? "Edit banner" : "New banner"}</DialogTitle>
          <DialogDescription>Banners rotate in the carousel at the top of the customer home page.</DialogDescription>
        </DialogHeader>
        <form id="banner-form" onSubmit={form.handleSubmit(submit)} className="-mx-6 grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-1" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="banner-title">Title</Label>
            <Input id="banner-title" placeholder="50% off with WELCOME50" aria-invalid={Boolean(errors.title)} {...register("title")} />
            <Err e={errors.title} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="banner-subtitle">Subtitle (optional)</Label>
              <Input id="banner-subtitle" placeholder="On your first three orders" aria-invalid={Boolean(errors.subtitle)} {...register("subtitle")} />
              <Err e={errors.subtitle} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="banner-cta">Button label (optional)</Label>
              <Input id="banner-cta" placeholder="Order now" aria-invalid={Boolean(errors.cta_label)} {...register("cta_label")} />
              <Err e={errors.cta_label} />
            </div>
          </div>
          <ImageField
            id="banner-image"
            label="Banner image"
            folder="banners"
            value={imageUrl}
            onChange={(url) => setValue("image_url", url, { shouldDirty: true, shouldValidate: true })}
            error={errors.image_url?.message}
            previewName={title}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="banner-link-type">Opens</Label>
              <select id="banner-link-type" className={selectClass} {...register("link_type")}>
                {Object.entries(LINK_TYPES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {linkType === "restaurant" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="banner-restaurant">Restaurant</Label>
                <select id="banner-restaurant" className={selectClass} aria-invalid={Boolean(errors.link_restaurant)} {...register("link_restaurant")}>
                  <option value="">Choose a restaurant</option>
                  {options.restaurants.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <Err e={errors.link_restaurant} />
              </div>
            ) : linkType === "collection" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="banner-collection">Collection</Label>
                <select id="banner-collection" className={selectClass} aria-invalid={Boolean(errors.link_collection)} {...register("link_collection")}>
                  <option value="">Choose a collection</option>
                  {options.collections.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <Err e={errors.link_collection} />
              </div>
            ) : linkType === "coupon" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="banner-coupon">Coupon</Label>
                <select id="banner-coupon" className={selectClass} aria-invalid={Boolean(errors.link_coupon)} {...register("link_coupon")}>
                  <option value="">Choose a coupon</option>
                  {options.coupons.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.title}
                    </option>
                  ))}
                </select>
                <Err e={errors.link_coupon} />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="banner-url">Link</Label>
                <Input id="banner-url" placeholder="/dining or https://…" aria-invalid={Boolean(errors.link_url)} {...register("link_url")} />
                <Err e={errors.link_url} />
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="banner-theme">Colour theme</Label>
              <select id="banner-theme" className={selectClass} {...register("theme")}>
                {Object.entries(BANNER_THEMES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="banner-sort">Position (optional)</Label>
              <Input id="banner-sort" inputMode="numeric" placeholder="Last" aria-invalid={Boolean(errors.sort)} {...register("sort")} />
              <Err e={errors.sort} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="banner-starts">Show from (optional)</Label>
              <Input id="banner-starts" type="date" aria-invalid={Boolean(errors.starts_at)} {...register("starts_at")} />
              <Err e={errors.starts_at} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="banner-ends">Show until (optional)</Label>
              <Input id="banner-ends" type="date" aria-invalid={Boolean(errors.ends_at)} {...register("ends_at")} />
              <Err e={errors.ends_at} />
            </div>
          </div>
          <label htmlFor="banner-active" className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3">
            <input id="banner-active" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" {...register("is_active")} />
            <span>
              <span className="block text-sm font-semibold">Active</span>
              <span className="block text-xs text-muted-foreground">Hidden banners stay here but don&apos;t show on the home page</span>
            </span>
          </label>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="banner-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {banner ? "Save changes" : "Add banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
