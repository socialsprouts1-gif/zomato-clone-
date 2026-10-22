"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CloudRain, Loader2, Moon, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, type FieldError } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveFees, saveFeeSlabs, saveSurge } from "@/lib/admin/settings-actions";
import { cn, formatPaise } from "@/lib/utils";
import { firstIssue } from "../coupons/form-helpers";
import { feesSchema, LATE_NIGHT_WINDOW, slabsSchema, surgeSchema, type FeesInput, type FeesValues, type Slab, type SurgeInput, type SurgeValues } from "./schema";

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

type SlabRow = { key: number; min_km: string; max_km: string; fee_rupees: string };

export function FeeSlabsEditor({ slabs }: { slabs: Slab[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toRows = (s: Slab[]) => s.map((x, i) => ({ key: i, min_km: String(Number(x.min_km)), max_km: String(Number(x.max_km)), fee_rupees: String(x.fee_paise / 100) }));
  const [rows, setRows] = useState<SlabRow[]>(() => toRows(slabs));
  const [error, setError] = useState<string | null>(null);
  const update = (key: number, patch: Partial<SlabRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  function add() {
    setRows((r) => {
      const last = r.at(-1);
      const from = last ? last.max_km : "0";
      return [...r, { key: Date.now(), min_km: from, max_km: String(Number(from) + 2), fee_rupees: last?.fee_rupees ?? "20" }];
    });
  }
  function save() {
    const input = rows.map(({ min_km, max_km, fee_rupees }) => ({ min_km, max_km, fee_rupees }));
    const check = slabsSchema.safeParse(input);
    if (!check.success) return setError(firstIssue(check.error));
    setError(null);
    start(async () => {
      const res = await saveFeeSlabs(input);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Delivery fees saved");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h3 className="font-semibold">Delivery fee by distance</h3>
        <p className="text-sm text-muted-foreground">Restaurant-to-customer distance. Orders beyond the last slab pay the last slab&apos;s fee.</p>
      </div>
      <div className="space-y-2" role="table" aria-label="Delivery fee slabs">
        <div role="row" className="grid grid-cols-[1fr_1fr_1fr_2.5rem] gap-2 text-xs font-medium text-muted-foreground">
          <span role="columnheader">From (km)</span>
          <span role="columnheader">To (km)</span>
          <span role="columnheader">Fee (₹)</span>
          <span role="columnheader" className="sr-only">
            Remove
          </span>
        </div>
        {rows.map((r, i) => (
          <div role="row" key={r.key} className="grid grid-cols-[1fr_1fr_1fr_2.5rem] gap-2" data-testid="fee-slab">
            <Input aria-label={`Slab ${i + 1} from km`} inputMode="decimal" value={r.min_km} onChange={(e) => update(r.key, { min_km: e.target.value })} />
            <Input aria-label={`Slab ${i + 1} to km`} inputMode="decimal" value={r.max_km} onChange={(e) => update(r.key, { max_km: e.target.value })} />
            <Input aria-label={`Slab ${i + 1} fee`} inputMode="decimal" value={r.fee_rupees} onChange={(e) => update(r.key, { fee_rupees: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove slab ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={add}>
          <Plus /> Add slab
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save delivery fees
        </Button>
      </div>
    </Card>
  );
}

export function FeesForm({ initial }: { initial: FeesInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<FeesInput, unknown, FeesValues>({ resolver: zodResolver(feesSchema), defaultValues: initial });
  const { register, formState } = form;
  const errors = formState.errors;
  return (
    <Card className="space-y-3 p-4">
      <div>
        <h3 className="font-semibold">Platform fee, GST & radius</h3>
        <p className="text-sm text-muted-foreground">Packaging charges are set by each restaurant in its outlet settings.</p>
      </div>
      <form
        className="grid gap-4 sm:grid-cols-3"
        noValidate
        onSubmit={form.handleSubmit(() =>
          start(async () => {
            const res = await saveFees(form.getValues());
            if (!res.ok) return void toast.error(res.error);
            toast.success("Fees saved");
            form.reset(form.getValues());
            router.refresh();
          }),
        )}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="fee-platform">Platform fee (₹ per order)</Label>
          <Input id="fee-platform" inputMode="decimal" aria-invalid={Boolean(errors.platform_fee_rupees)} {...register("platform_fee_rupees")} />
          <Err e={errors.platform_fee_rupees} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fee-gst">GST on food (%)</Label>
          <Input id="fee-gst" inputMode="decimal" aria-invalid={Boolean(errors.gst_pct)} {...register("gst_pct")} />
          <Err e={errors.gst_pct} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fee-radius">Max delivery distance (km)</Label>
          <Input id="fee-radius" inputMode="decimal" aria-invalid={Boolean(errors.max_delivery_km)} {...register("max_delivery_km")} />
          <Err e={errors.max_delivery_km} />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={pending || !formState.isDirty}>
            {pending ? <Loader2 className="animate-spin" /> : null} Save fees
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SurgeForm({ initial, lateNightNow }: { initial: SurgeInput; lateNightNow: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<SurgeInput, unknown, SurgeValues>({ resolver: zodResolver(surgeSchema), defaultValues: initial });
  const { register, formState, control, watch } = form;
  const errors = formState.errors;
  const [rain, late, fee] = watch(["surge_rain", "surge_late_night", "surge_fee_rupees"]);
  const live = rain || (late && lateNightNow);
  const feePaise = Math.round(Number(fee) * 100) || 0;

  return (
    <Card className={cn("space-y-3 p-4", live && "border-amber-400")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">Surge pricing</h3>
          <p className="text-sm text-muted-foreground">Adds a flat fee to the delivery charge while a reason is on.</p>
        </div>
        <span
          data-testid="surge-state"
          className={cn("rounded-full px-3 py-1 text-xs font-semibold", live ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-muted text-muted-foreground")}
        >
          {live ? `Surge live · +${formatPaise(feePaise)}` : "No surge right now"}
        </span>
      </div>
      <form
        className="space-y-3"
        noValidate
        onSubmit={form.handleSubmit(() =>
          start(async () => {
            const res = await saveSurge(form.getValues());
            if (!res.ok) return void toast.error(res.error);
            toast.success("Surge settings saved");
            form.reset(form.getValues());
            router.refresh();
          }),
        )}
      >
        <Controller
          control={control}
          name="surge_rain"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
              <span className="flex items-center gap-2">
                <CloudRain className="size-5 text-sky-600" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">Rain surge</span>
                  <span className="block text-xs text-muted-foreground">Applies to every order until you turn it off</span>
                </span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Rain surge" />
            </label>
          )}
        />
        <Controller
          control={control}
          name="surge_late_night"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
              <span className="flex items-center gap-2">
                <Moon className="size-5 text-indigo-600" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">Late-night surge</span>
                  <span className="block text-xs text-muted-foreground">Only for orders placed {LATE_NIGHT_WINDOW}</span>
                </span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Late-night surge" />
            </label>
          )}
        />
        <div className="grid gap-1.5 sm:max-w-56">
          <Label htmlFor="surge-fee">Surge fee (₹)</Label>
          <Input id="surge-fee" inputMode="decimal" aria-invalid={Boolean(errors.surge_fee_rupees)} {...register("surge_fee_rupees")} />
          <Err e={errors.surge_fee_rupees} />
        </div>
        <Button type="submit" disabled={pending || !formState.isDirty}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save surge
        </Button>
      </form>
    </Card>
  );
}
