"use client";

import { Flame, Star } from "lucide-react";
import { VegDot } from "@/components/catalog/badges";
import { FoodImage } from "@/components/shared/food-image";
import { Button } from "@/components/ui/button";
import { healthyMeta, healthyScoreFor } from "@/lib/catalog/healthy";
import type { MenuItem } from "@/lib/catalog/menu-shared";
import { cn, formatPaise } from "@/lib/utils";
import { QtyStepper } from "./qty-stepper";

export function MenuItemRow({
  item,
  available,
  unavailableReason,
  healthyMode,
  qty,
  onAdd,
  onInc,
  onDec,
}: {
  item: MenuItem;
  available: boolean;
  unavailableReason?: string;
  healthyMode: boolean;
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const customisable = item.item_variants.length > 0 || item.addon_groups.length > 0;
  const fromPrice = item.item_variants.length ? Math.min(...item.item_variants.map((v) => v.price_paise)) : item.price_paise;
  const healthy = healthyScoreFor(item);
  const lowStock = item.stock_qty !== null && item.stock_qty > 0 && item.stock_qty <= 5;

  return (
    <article className={cn("flex gap-4 py-5", !available && "opacity-60")} data-testid="menu-item" data-item-name={item.name} aria-label={item.name}>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <VegDot veg={item.is_veg} />
          {item.bestseller ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <Star className="size-3 fill-current" aria-hidden /> Bestseller
            </span>
          ) : null}
          {item.tags.includes("spicy") ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600">
              <Flame className="size-3" aria-hidden /> Spicy
            </span>
          ) : null}
          {healthyMode ? (
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", healthyMeta[healthy.score].className)} title={healthy.estimated ? "Estimated from the dish" : "Based on nutrition values"}>
              Healthy score: {healthyMeta[healthy.score].label}
              {healthy.estimated ? "*" : ""}
            </span>
          ) : null}
        </div>
        <h3 className="font-semibold leading-snug">{item.name}</h3>
        <p className="text-sm font-semibold">
          {item.item_variants.length > 1 ? "from " : ""}
          {formatPaise(fromPrice)}
        </p>
        {item.rating ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> {item.rating} ({item.rating_count})
          </p>
        ) : null}
        {healthyMode && item.calories ? (
          <p className="text-xs text-muted-foreground" data-testid="nutrition">
            {item.calories} kcal · {item.protein_g}g protein · {item.carbs_g}g carbs · {item.fat_g}g fat{item.grams ? ` · ${item.grams}g` : ""}
          </p>
        ) : null}
        {item.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p> : null}
        {lowStock && available ? <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Only {item.stock_qty} left</p> : null}
      </div>
      <div className="relative flex w-32 shrink-0 flex-col items-center">
        <FoodImage src={item.image_url} alt={item.name} name={item.name} sizes="128px" className={cn("size-32 rounded-2xl", !available && "grayscale")} emojiClassName="text-5xl" />
        <div className="-mt-5">
          {!available ? (
            <span className="block rounded-xl border bg-card px-3 py-2 text-xs font-bold text-muted-foreground shadow-sm">{unavailableReason ?? "Sold out"}</span>
          ) : qty > 0 ? (
            <QtyStepper qty={qty} onInc={onInc} onDec={onDec} label={item.name} />
          ) : (
            <Button variant="outline" onClick={onAdd} className="h-10 w-24 border-primary/40 bg-card font-extrabold text-primary uppercase shadow-sm hover:bg-secondary" aria-label={`Add ${item.name}`}>
              Add
            </Button>
          )}
        </div>
        {customisable && available ? <span className="mt-1 text-[10px] text-muted-foreground">Customisable</span> : null}
      </div>
    </article>
  );
}
