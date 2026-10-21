"use client";

import { useEffect, useMemo, useState } from "react";
import { VegDot } from "@/components/catalog/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { unitPriceOf, type MenuItem } from "@/lib/catalog/menu-shared";
import { cn, formatPaise } from "@/lib/utils";
import { QtyStepper } from "./qty-stepper";

export type Customisation = { variantId: string | null; addonIds: string[]; qty: number };

/** Variants (required single select) and add-on groups (min/max), with live price. */
export function CustomiseSheet({
  item,
  open,
  onOpenChange,
  initial,
  vegOnly,
  submitLabel = "Add item",
  onSubmit,
}: {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Customisation;
  vegOnly: boolean;
  submitLabel?: string;
  onSubmit: (c: Customisation) => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!item || !open) return;
    const def = item.item_variants.find((v) => v.is_default && v.in_stock) ?? item.item_variants.find((v) => v.in_stock);
    setVariantId(initial?.variantId ?? def?.id ?? null);
    setAddonIds(initial?.addonIds ?? []);
    setQty(initial?.qty ?? 1);
  }, [item, open, initial]);

  const groups = useMemo(
    () => (item?.addon_groups ?? []).map((g) => ({ ...g, addons: g.addons.filter((a) => !vegOnly || a.is_veg) })).filter((g) => g.addons.length),
    [item, vegOnly],
  );
  if (!item) return null;

  const chosenAddons = groups.flatMap((g) => g.addons).filter((a) => addonIds.includes(a.id));
  const unit = unitPriceOf(item, variantId, chosenAddons);
  const groupErrors = groups.map((g) => {
    const n = g.addons.filter((a) => addonIds.includes(a.id)).length;
    return n < g.min_select ? `Choose at least ${g.min_select}` : null;
  });
  const valid = (item.item_variants.length === 0 || Boolean(variantId)) && groupErrors.every((e) => !e);

  function toggleAddon(groupId: string, addonId: string, on: boolean) {
    const g = groups.find((x) => x.id === groupId)!;
    setAddonIds((ids) => {
      const inGroup = ids.filter((id) => g.addons.some((a) => a.id === id));
      if (on) {
        if (g.max_select === 1) return [...ids.filter((id) => !inGroup.includes(id)), addonId];
        if (inGroup.length >= g.max_select) return ids;
        return [...ids, addonId];
      }
      return ids.filter((id) => id !== addonId);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90dvh] max-w-lg flex-col gap-0 p-0">
        <SheetHeader className="border-b px-5 pt-2 pb-4">
          <div className="flex items-center gap-2">
            <VegDot veg={item.is_veg} />
            <SheetTitle>{item.name}</SheetTitle>
          </div>
          <SheetDescription>{item.description ?? "Customise your order"}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {item.item_variants.length ? (
            <fieldset>
              <legend className="mb-2 flex w-full items-center justify-between">
                <span className="font-semibold">{item.variant_group_name ?? "Choose an option"}</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground uppercase">Required</span>
              </legend>
              <RadioGroup value={variantId ?? undefined} onValueChange={setVariantId}>
                {item.item_variants.map((v) => (
                  <Label key={v.id} className={cn("flex cursor-pointer items-center justify-between rounded-xl border p-3 font-normal", !v.in_stock && "opacity-50")}>
                    <span className="flex items-center gap-3">
                      <RadioGroupItem value={v.id} disabled={!v.in_stock} aria-label={v.name} />
                      {v.name}
                      {!v.in_stock ? <span className="text-xs text-muted-foreground">(sold out)</span> : null}
                    </span>
                    <span className="text-sm tabular-nums">{formatPaise(v.price_paise)}</span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          ) : null}
          {groups.map((g, gi) => {
            const n = g.addons.filter((a) => addonIds.includes(a.id)).length;
            return (
              <fieldset key={g.id}>
                <legend className="mb-2 flex w-full items-center justify-between">
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.min_select ? `Choose ${g.min_select === g.max_select ? g.min_select : `${g.min_select}–${g.max_select}`}` : `Up to ${g.max_select}`}
                  </span>
                </legend>
                <div className="grid gap-2">
                  {g.addons.map((a) => {
                    const checked = addonIds.includes(a.id);
                    const disabled = !a.in_stock || (!checked && g.max_select > 1 && n >= g.max_select);
                    return (
                      <Label key={a.id} className={cn("flex cursor-pointer items-center justify-between rounded-xl border p-3 font-normal", disabled && !checked && "opacity-50")}>
                        <span className="flex items-center gap-3">
                          <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => toggleAddon(g.id, a.id, v === true)} aria-label={a.name} />
                          <VegDot veg={a.is_veg} className="size-3.5" />
                          {a.name}
                        </span>
                        <span className="text-sm tabular-nums">{a.price_paise ? `+ ${formatPaise(a.price_paise)}` : "Free"}</span>
                      </Label>
                    );
                  })}
                </div>
                {groupErrors[gi] ? <p className="mt-1 text-xs text-destructive">{groupErrors[gi]}</p> : null}
              </fieldset>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t bg-card px-5 py-4">
          <QtyStepper qty={qty} onInc={() => setQty((q) => Math.min(20, q + 1))} onDec={() => setQty((q) => Math.max(1, q - 1))} label={item.name} />
          <Button size="lg" className="flex-1" disabled={!valid} onClick={() => onSubmit({ variantId, addonIds, qty })}>
            {submitLabel} · {formatPaise(unit * qty)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
