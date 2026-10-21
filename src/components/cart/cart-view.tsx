"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { VegDot } from "@/components/catalog/badges";
import { QtyStepper } from "@/components/menu/qty-stepper";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise } from "@/lib/utils";
import { cartTotals, useCart, useCartHydrated } from "./cart-store";

export function CartView() {
  const hydrated = useCartHydrated();
  const { lines, restaurant, setQty } = useCart();
  if (!hydrated) return <Skeleton className="mx-auto h-64 max-w-2xl" />;
  if (!lines.length || !restaurant)
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add something delicious from a restaurant near you."
        action={
          <Button asChild>
            <Link href="/">Browse restaurants</Link>
          </Button>
        }
      />
    );
  const { subtotal } = cartTotals(lines);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-2xl font-bold">{restaurant.name}</h1>
      <Card className="divide-y">
        {lines.map((l) => (
          <div key={l.key} className="flex items-start gap-3 p-4">
            <VegDot veg={l.isVeg} className="mt-1" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.name}</p>
              {l.variantName || l.addons.length ? <p className="text-xs text-muted-foreground">{[l.variantName, ...l.addons.map((a) => a.name)].filter(Boolean).join(", ")}</p> : null}
              <p className="text-sm">{formatPaise(l.unitPrice * l.qty)}</p>
            </div>
            <QtyStepper qty={l.qty} size="sm" label={l.name} onInc={() => setQty(l.key, l.qty + 1)} onDec={() => setQty(l.key, l.qty - 1)} />
          </div>
        ))}
      </Card>
      <p className="text-right font-semibold">Item total {formatPaise(subtotal)}</p>
    </div>
  );
}
