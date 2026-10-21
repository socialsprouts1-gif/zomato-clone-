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
import { saveOffer } from "@/lib/partner/offers-actions";
import { formatPaise } from "@/lib/utils";
import { istDate, type Offer } from "./offer-utils";
import { DISCOUNT_LABEL, offerFormSchema, type OfferFormInput, type OfferFormValues } from "./schemas";

export type MenuOption = { id: string; name: string; pricePaise: number };

const selectClass = "flex h-11 w-full rounded-xl border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 md:text-sm";

function defaults(o: Offer | null): OfferFormInput {
  const today = istDate(new Date());
  if (!o) {
    return {
      title: "", description: "", code: "", discount_type: "percent", percent: "20", flat_rupees: "", max_discount_rupees: "", min_order_rupees: "0",
      bogo_item_id: "", free_item_id: "", target: "all", applies_to: "delivery", valid_from: today, valid_until: "",
    };
  }
  return {
    title: o.title,
    description: o.description ?? "",
    code: o.code,
    discount_type: o.discount_type,
    percent: o.discount_type === "percent" ? String(o.discount_value) : "",
    flat_rupees: o.discount_type === "flat" ? String(o.discount_value / 100) : "",
    max_discount_rupees: o.max_discount_paise ? String(o.max_discount_paise / 100) : "",
    min_order_rupees: String(o.min_order_paise / 100),
    bogo_item_id: o.bogo_item_id ?? "",
    free_item_id: o.free_item_id ?? "",
    target: o.target as OfferFormInput["target"],
    applies_to: o.applies_to as OfferFormInput["applies_to"],
    valid_from: istDate(o.valid_from) < today ? today : istDate(o.valid_from),
    valid_until: o.valid_until ? istDate(o.valid_until) : "",
  };
}

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

export function OfferDialog({
  open,
  onOpenChange,
  restaurantId,
  offer,
  menu,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  restaurantId: string;
  offer: Offer | null;
  menu: MenuOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<OfferFormInput, unknown, OfferFormValues>({ resolver: zodResolver(offerFormSchema), defaultValues: defaults(offer) });
  const { register, formState, watch, reset } = form;
  const errors = formState.errors;
  const type = watch("discount_type");

  useEffect(() => {
    if (open) reset(defaults(offer));
  }, [open, offer, reset]);

  function submit(raw: OfferFormValues) {
    start(async () => {
      // Server re-validates from the raw strings so paise conversion happens in one place.
      const res = await saveOffer(restaurantId, offer?.id ?? null, form.getValues());
      if (!res.ok) return void toast.error(res.error);
      toast.success(offer ? `${raw.code} updated` : `${raw.code} is live`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col">
        <DialogHeader>
          <DialogTitle>{offer ? "Edit offer" : "New offer"}</DialogTitle>
          <DialogDescription>Customers enter the code at checkout, or pick it from the offers list.</DialogDescription>
        </DialogHeader>
        <form id="offer-form" onSubmit={form.handleSubmit(submit)} className="-mx-6 grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-1" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="offer-title">Title</Label>
            <Input id="offer-title" placeholder="Flat ₹100 off" aria-invalid={Boolean(errors.title)} {...register("title")} />
            <Err e={errors.title} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="offer-code">Coupon code</Label>
              <Input
                id="offer-code"
                className="font-mono uppercase"
                placeholder="FEAST100"
                autoCapitalize="characters"
                aria-invalid={Boolean(errors.code)}
                {...register("code", { setValueAs: (v: string) => v.toUpperCase().replace(/\s+/g, "") })}
              />
              <Err e={errors.code} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="offer-type">Discount type</Label>
              <select id="offer-type" className={selectClass} {...register("discount_type")}>
                {Object.entries(DISCOUNT_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {type === "percent" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="offer-percent">Discount (%)</Label>
                <Input id="offer-percent" inputMode="numeric" aria-invalid={Boolean(errors.percent)} {...register("percent")} />
                <Err e={errors.percent} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="offer-cap">Maximum discount (₹, optional)</Label>
                <Input id="offer-cap" inputMode="decimal" placeholder="No cap" aria-invalid={Boolean(errors.max_discount_rupees)} {...register("max_discount_rupees")} />
                <Err e={errors.max_discount_rupees} />
              </div>
            </div>
          ) : null}
          {type === "flat" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="offer-flat">Discount amount (₹)</Label>
              <Input id="offer-flat" inputMode="decimal" placeholder="100" aria-invalid={Boolean(errors.flat_rupees)} {...register("flat_rupees")} />
              <Err e={errors.flat_rupees} />
            </div>
          ) : null}
          {type === "bogo" || type === "free_item" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="offer-dish">{type === "bogo" ? "Buy-one-get-one dish" : "Free dish"}</Label>
              <select key={type} id="offer-dish" className={selectClass} aria-invalid={Boolean(errors.bogo_item_id || errors.free_item_id)} {...register(type === "bogo" ? "bogo_item_id" : "free_item_id")}>
                <option value="">Choose from your menu</option>
                {menu.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {formatPaise(m.pricePaise)}
                  </option>
                ))}
              </select>
              <Err e={errors.bogo_item_id ?? errors.free_item_id} />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="offer-min">Minimum order (₹)</Label>
              <Input id="offer-min" inputMode="decimal" aria-invalid={Boolean(errors.min_order_rupees)} {...register("min_order_rupees")} />
              <Err e={errors.min_order_rupees} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="offer-target">Who can use it</Label>
              <select id="offer-target" className={selectClass} {...register("target")}>
                <option value="all">All customers</option>
                <option value="new_users">New customers (first order here)</option>
                <option value="gold">Gold members</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="offer-applies">Valid on</Label>
              <select id="offer-applies" className={selectClass} {...register("applies_to")}>
                <option value="delivery">Delivery</option>
                <option value="dining">Dining</option>
                <option value="both">Delivery & dining</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="offer-from">Starts</Label>
              <Input id="offer-from" type="date" aria-invalid={Boolean(errors.valid_from)} {...register("valid_from")} />
              <Err e={errors.valid_from} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="offer-until">Ends (optional)</Label>
              <Input id="offer-until" type="date" aria-invalid={Boolean(errors.valid_until)} {...register("valid_until")} />
              <Err e={errors.valid_until} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="offer-desc">Description (optional)</Label>
            <Input id="offer-desc" placeholder="Valid on all mains" aria-invalid={Boolean(errors.description)} {...register("description")} />
            <Err e={errors.description} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="offer-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {offer ? "Save changes" : "Create offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
