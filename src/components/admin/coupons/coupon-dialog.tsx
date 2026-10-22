"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useForm, type FieldError, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCoupon } from "@/lib/admin/coupons-actions";
import { istDate, paiseToRupees, selectClass } from "./form-helpers";
import { COUPON_TYPES, couponFormSchema, PAYMENT_METHODS, type Coupon, type CouponFormInput, type CouponFormValues } from "./schema";

export type RestaurantOption = { id: string; name: string };

function defaults(c: Coupon | null): CouponFormInput {
  const today = istDate(new Date());
  if (!c) {
    return {
      code: "", title: "", description: "", discount_type: "percent", percent: "20", flat_rupees: "", max_discount_rupees: "", min_order_rupees: "0",
      total_limit: "", per_user_limit: "1", first_order_only: false, gold_only: false, payment_method: "", restaurant_id: "", valid_from: today, valid_until: "", is_active: true,
    };
  }
  const type = (c.discount_type in COUPON_TYPES ? c.discount_type : "flat") as CouponFormInput["discount_type"];
  return {
    code: c.code,
    title: c.title,
    description: c.description ?? "",
    discount_type: type,
    percent: c.discount_type === "percent" ? String(c.discount_value) : "",
    flat_rupees: c.discount_type === "flat" ? paiseToRupees(c.discount_value) : "",
    max_discount_rupees: paiseToRupees(c.max_discount_paise),
    min_order_rupees: paiseToRupees(c.min_order_paise),
    total_limit: c.total_limit === null ? "" : String(c.total_limit),
    per_user_limit: String(c.per_user_limit),
    first_order_only: c.first_order_only,
    gold_only: c.gold_only,
    payment_method: (c.payment_method ?? "") as CouponFormInput["payment_method"],
    restaurant_id: c.restaurant_id ?? "",
    valid_from: istDate(c.valid_from),
    valid_until: c.valid_until ? istDate(c.valid_until) : "",
    is_active: c.is_active,
  };
}

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

function Check({ id, label, hint, reg }: { id: string; label: string; hint: string; reg: UseFormRegisterReturn }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3">
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" {...reg} />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function CouponDialog({
  open,
  onOpenChange,
  coupon,
  restaurants,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coupon: Coupon | null;
  restaurants: RestaurantOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<CouponFormInput, unknown, CouponFormValues>({ resolver: zodResolver(couponFormSchema), defaultValues: defaults(coupon) });
  const { register, formState, watch, reset } = form;
  const errors = formState.errors;
  const type = watch("discount_type");

  useEffect(() => {
    if (open) reset(defaults(coupon));
  }, [open, coupon, reset]);

  function submit(v: CouponFormValues) {
    start(async () => {
      const res = await saveCoupon(coupon?.id ?? null, form.getValues());
      if (!res.ok) return void toast.error(res.error);
      toast.success(coupon ? `${v.code} updated` : `${v.code} created`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{coupon ? `Edit ${coupon.code}` : "New coupon"}</DialogTitle>
          <DialogDescription>Platform coupons work at every restaurant unless you limit them to one.</DialogDescription>
        </DialogHeader>
        <form id="coupon-form" onSubmit={form.handleSubmit(submit)} className="-mx-6 grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-1" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                id="coupon-code"
                className="font-mono uppercase"
                placeholder="WELCOME50"
                autoCapitalize="characters"
                aria-invalid={Boolean(errors.code)}
                {...register("code", { setValueAs: (v: string) => v.toUpperCase().replace(/\s+/g, "") })}
              />
              <Err e={errors.code} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-title">Title</Label>
              <Input id="coupon-title" placeholder="50% off your first order" aria-invalid={Boolean(errors.title)} {...register("title")} />
              <Err e={errors.title} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="coupon-desc">Description (optional)</Label>
            <Input id="coupon-desc" placeholder="Shown under the code at checkout" aria-invalid={Boolean(errors.description)} {...register("description")} />
            <Err e={errors.description} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-type">Discount type</Label>
              <select id="coupon-type" className={selectClass} {...register("discount_type")}>
                {Object.entries(COUPON_TYPES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {type === "percent" ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="coupon-percent">Discount (%)</Label>
                  <Input id="coupon-percent" inputMode="numeric" aria-invalid={Boolean(errors.percent)} {...register("percent")} />
                  <Err e={errors.percent} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="coupon-cap">Maximum discount (₹)</Label>
                  <Input id="coupon-cap" inputMode="decimal" placeholder="No cap" aria-invalid={Boolean(errors.max_discount_rupees)} {...register("max_discount_rupees")} />
                  <Err e={errors.max_discount_rupees} />
                </div>
              </>
            ) : null}
            {type === "flat" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="coupon-flat">Discount amount (₹)</Label>
                <Input id="coupon-flat" inputMode="decimal" placeholder="100" aria-invalid={Boolean(errors.flat_rupees)} {...register("flat_rupees")} />
                <Err e={errors.flat_rupees} />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-min">Minimum order (₹)</Label>
              <Input id="coupon-min" inputMode="decimal" aria-invalid={Boolean(errors.min_order_rupees)} {...register("min_order_rupees")} />
              <Err e={errors.min_order_rupees} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-total">Total uses (optional)</Label>
              <Input id="coupon-total" inputMode="numeric" placeholder="Unlimited" aria-invalid={Boolean(errors.total_limit)} {...register("total_limit")} />
              <Err e={errors.total_limit} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-per-user">Uses per customer</Label>
              <Input id="coupon-per-user" inputMode="numeric" aria-invalid={Boolean(errors.per_user_limit)} {...register("per_user_limit")} />
              <Err e={errors.per_user_limit} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-pay">Payment method</Label>
              <select id="coupon-pay" className={selectClass} {...register("payment_method")}>
                <option value="">Any payment method</option>
                {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l} only
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-restaurant">Restaurant</Label>
              <select id="coupon-restaurant" className={selectClass} {...register("restaurant_id")}>
                <option value="">All restaurants</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Check id="coupon-first" label="New users only" hint="Valid on a customer's first delivered order" reg={register("first_order_only")} />
            <Check id="coupon-gold" label="Gold members only" hint="Needs an active Gold membership" reg={register("gold_only")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-from">Valid from</Label>
              <Input id="coupon-from" type="date" aria-invalid={Boolean(errors.valid_from)} {...register("valid_from")} />
              <Err e={errors.valid_from} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-until">Valid until (optional)</Label>
              <Input id="coupon-until" type="date" aria-invalid={Boolean(errors.valid_until)} {...register("valid_until")} />
              <Err e={errors.valid_until} />
            </div>
          </div>
          <Check id="coupon-active" label="Active" hint="Inactive coupons are hidden and rejected at checkout" reg={register("is_active")} />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="coupon-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {coupon ? "Save changes" : "Create coupon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
