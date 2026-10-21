"use client";

import { UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DishStat } from "@/lib/partner/reports";
import { formatPaise } from "@/lib/utils";

/** Best sellers by quantity or by revenue (delivered orders). */
export function TopDishes({ byQty, byRevenue }: { byQty: DishStat[]; byRevenue: DishStat[] }) {
  const [mode, setMode] = useState<"qty" | "revenue">("qty");
  const list = mode === "qty" ? byQty : byRevenue;
  const max = Math.max(1, ...list.map((d) => (mode === "qty" ? d.qty : d.revenue_paise)));
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="dishes-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="dishes-title" className="font-display text-lg font-semibold">Top dishes</h2>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "qty" | "revenue")}>
          <TabsList className="h-9">
            <TabsTrigger value="qty" className="text-xs">By quantity</TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs">By revenue</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {list.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <UtensilsCrossed className="size-4" /> No delivered orders in this range.
        </p>
      ) : (
        <ol className="space-y-3" data-testid="top-dishes">
          {list.map((d, i) => {
            const v = mode === "qty" ? d.qty : d.revenue_paise;
            return (
              <li key={d.name} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="truncate font-medium" title={d.name}>{d.name}</span>
                <span className="text-right tabular-nums">
                  <span className="font-semibold">{mode === "qty" ? `${d.qty} sold` : formatPaise(d.revenue_paise)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{mode === "qty" ? formatPaise(d.revenue_paise) : `${d.qty} sold`}</span>
                </span>
                <div className="col-start-2 col-end-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
