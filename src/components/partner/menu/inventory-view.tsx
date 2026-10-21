"use client";

import { Boxes, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { VegDot } from "@/components/catalog/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adjustStock, setStock } from "@/lib/partner/menu-actions";
import { isLowStock, type PartnerCategory, type PartnerItem } from "@/lib/partner/menu-types";
import { cn } from "@/lib/utils";
import { useMenuAction } from "./use-menu-action";

export function InventoryView({ items, categories }: { items: PartnerItem[]; categories: PartnerCategory[] }) {
  const tracked = items
    .filter((i) => i.stock_qty !== null)
    .sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)) || (a.stock_qty ?? 0) - (b.stock_qty ?? 0) || a.name.localeCompare(b.name));
  const untracked = items.filter((i) => i.stock_qty === null);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  const low = tracked.filter(isLowStock).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{tracked.length} tracked</Badge>
        {low ? <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{low} low on stock</Badge> : null}
        <span className="text-muted-foreground">Stock goes down automatically as orders are placed. At 0 the item is hidden from customers.</span>
      </div>
      <StartTracking items={untracked} />
      {tracked.length ? (
        <ul className="space-y-2" aria-label="Tracked items">
          {tracked.map((i) => (
            <StockRow key={i.id} item={i} category={catName(i.category_id)} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={Boxes} title="No items tracked yet" description="Start tracking an item above, or switch on stock tracking in the item editor." />
      )}
    </div>
  );
}

function StockRow({ item, category }: { item: PartnerItem; category: string }) {
  const { run, pending } = useMenuAction();
  const [qty, setQty] = useState(String(item.stock_qty ?? 0));
  const [threshold, setThreshold] = useState(String(item.low_stock_threshold));
  const [synced, setSynced] = useState({ qty: item.stock_qty, t: item.low_stock_threshold });
  if (synced.qty !== item.stock_qty || synced.t !== item.low_stock_threshold) {
    // Server state moved (an order consumed stock, or another tab edited it): reflect it.
    setSynced({ qty: item.stock_qty, t: item.low_stock_threshold });
    setQty(String(item.stock_qty ?? 0));
    setThreshold(String(item.low_stock_threshold));
  }
  const low = isLowStock(item);
  const out = item.stock_qty === 0;
  const valid = /^\d{1,6}$/.test(qty) && /^\d{1,4}$/.test(threshold);
  const dirty = qty !== String(item.stock_qty) || threshold !== String(item.low_stock_threshold);

  return (
    <li
      data-testid="inventory-row"
      data-item-name={item.name}
      className={cn("flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3", low && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30", out && "border-destructive/40 bg-destructive/5")}
    >
      <div className="min-w-40 flex-1">
        <p className="flex items-center gap-2 font-semibold">
          <VegDot veg={item.is_veg} /> {item.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {category}
          {out ? <Badge variant="destructive" className="ml-2">Out of stock</Badge> : low ? <Badge className="ml-2 bg-amber-500 text-white">Low stock</Badge> : null}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="size-9" aria-label={`Decrease stock of ${item.name}`} disabled={pending || out} onClick={() => void run(() => adjustStock(item.id, -1))}>
          <Minus />
        </Button>
        <span className="w-12 text-center text-lg font-bold tabular-nums" data-testid="stock-qty" aria-label={`${item.name} quantity`}>
          {item.stock_qty}
        </span>
        <Button type="button" variant="outline" size="icon" className="size-9" aria-label={`Increase stock of ${item.name}`} disabled={pending} onClick={() => void run(() => adjustStock(item.id, 1))}>
          <Plus />
        </Button>
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void run(() => setStock(item.id, Number(qty), Number(threshold)), "Stock updated");
        }}
      >
        <div className="space-y-0.5">
          <Label htmlFor={`qty-${item.id}`} className="text-[11px] text-muted-foreground">
            Set qty
          </Label>
          <Input id={`qty-${item.id}`} aria-label={`Stock quantity: ${item.name}`} inputMode="numeric" className="h-9 w-20" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor={`thr-${item.id}`} className="text-[11px] text-muted-foreground">
            Alert at
          </Label>
          <Input id={`thr-${item.id}`} aria-label={`Low-stock alert: ${item.name}`} inputMode="numeric" className="h-9 w-16" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <Button type="submit" size="sm" className="h-9" disabled={pending || !valid || !dirty} aria-label={`Save stock for ${item.name}`}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-9" disabled={pending} onClick={() => void run(() => setStock(item.id, null, item.low_stock_threshold), `Stopped tracking ${item.name}`)}>
          Untrack
        </Button>
      </form>
    </li>
  );
}

function StartTracking({ items }: { items: PartnerItem[] }) {
  const { run, pending } = useMenuAction();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [threshold, setThreshold] = useState("5");
  if (!items.length) return null;
  const valid = itemId && /^\d{1,6}$/.test(qty) && /^\d{1,4}$/.test(threshold);
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void run(() => setStock(itemId, Number(qty), Number(threshold)), "Now tracking stock", () => {
          setItemId("");
          setQty("");
        });
      }}
    >
      <div className="min-w-48 flex-1 space-y-1">
        <Label htmlFor="track-item">Track an item</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger id="track-item" className="h-10">
            <SelectValue placeholder="Choose an item" />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="track-qty">Quantity</Label>
        <Input id="track-qty" inputMode="numeric" className="h-10 w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="track-threshold">Alert at</Label>
        <Input id="track-threshold" inputMode="numeric" className="h-10 w-20" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending || !valid}>
        Start tracking
      </Button>
    </form>
  );
}
