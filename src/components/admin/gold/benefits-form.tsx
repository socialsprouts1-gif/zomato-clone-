"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGoldBenefits } from "@/lib/admin/gold-actions";
import { formatPaise } from "@/lib/utils";
import { GOLD_DISCOUNT_CAP_PAISE, goldBenefitsSchema, type GoldBenefitsInput, type GoldBenefitsValues } from "./schema";

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

export function BenefitsForm({ initial }: { initial: GoldBenefitsInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<GoldBenefitsInput, unknown, GoldBenefitsValues>({ resolver: zodResolver(goldBenefitsSchema), defaultValues: initial });
  const { register, formState } = form;
  const errors = formState.errors;

  function submit() {
    start(async () => {
      const res = await saveGoldBenefits(form.getValues());
      if (!res.ok) return void toast.error(res.error);
      toast.success("Gold benefits updated");
      form.reset(form.getValues());
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="benefits-title">
      <Card className="space-y-4 p-4">
        <div>
          <h2 id="benefits-title" className="font-display text-lg font-semibold">
            Member benefits
          </h2>
          <p className="text-sm text-muted-foreground">Applied at checkout at Gold partner restaurants. The extra discount is capped at {formatPaise(GOLD_DISCOUNT_CAP_PAISE)} per order.</p>
        </div>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="gold-free-min">Free delivery above (₹)</Label>
            <Input id="gold-free-min" inputMode="decimal" aria-invalid={Boolean(errors.free_delivery_min_rupees)} {...register("free_delivery_min_rupees")} />
            <Err e={errors.free_delivery_min_rupees} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gold-extra">Extra delivery discount (%)</Label>
            <Input id="gold-extra" inputMode="decimal" aria-invalid={Boolean(errors.extra_discount_pct)} {...register("extra_discount_pct")} />
            <Err e={errors.extra_discount_pct} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gold-dining">Dining discount (%)</Label>
            <Input id="gold-dining" inputMode="decimal" aria-invalid={Boolean(errors.dining_discount_pct)} {...register("dining_discount_pct")} />
            <Err e={errors.dining_discount_pct} />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending || !formState.isDirty}>
              {pending ? <Loader2 className="animate-spin" /> : null} Save benefits
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
