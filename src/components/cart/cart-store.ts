"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { logCartStart } from "@/lib/catalog/actions";

export type CartAddon = { id: string; name: string; price: number };
export type CartLine = {
  key: string;
  itemId: string;
  name: string;
  isVeg: boolean;
  imageUrl: string | null;
  variantId: string | null;
  variantName: string | null;
  addons: CartAddon[];
  unitPrice: number; // paise, display only — the server recomputes at checkout
  qty: number;
};
export type CartRestaurant = { id: string; slug: string; name: string; locality: string; image: string | null };

type CartState = {
  restaurant: CartRestaurant | null;
  lines: CartLine[];
  add: (restaurant: CartRestaurant, line: Omit<CartLine, "key" | "qty">, qty?: number) => "added" | "conflict";
  replaceWith: (restaurant: CartRestaurant, line: Omit<CartLine, "key" | "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  updateLine: (key: string, line: Omit<CartLine, "key" | "qty">) => void;
  clear: () => void;
};

export function lineKey(l: Pick<CartLine, "itemId" | "variantId" | "addons">) {
  return [l.itemId, l.variantId ?? "-", ...l.addons.map((a) => a.id).sort()].join("|");
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      lines: [],
      add(restaurant, line, qty = 1) {
        const state = get();
        if (state.restaurant && state.restaurant.id !== restaurant.id && state.lines.length) return "conflict";
        if (!state.lines.length) void logCartStart(restaurant.id).catch(() => undefined);
        const key = lineKey(line);
        const existing = state.lines.find((l) => l.key === key);
        set({
          restaurant,
          lines: existing
            ? state.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(50, l.qty + qty) } : l))
            : [...state.lines, { ...line, key, qty }],
        });
        return "added";
      },
      replaceWith(restaurant, line, qty = 1) {
        void logCartStart(restaurant.id).catch(() => undefined);
        set({ restaurant, lines: [{ ...line, key: lineKey(line), qty }] });
      },
      setQty(key, qty) {
        const lines = qty <= 0 ? get().lines.filter((l) => l.key !== key) : get().lines.map((l) => (l.key === key ? { ...l, qty: Math.min(50, qty) } : l));
        set({ lines, restaurant: lines.length ? get().restaurant : null });
      },
      updateLine(key, line) {
        const newKey = lineKey(line);
        const lines = get().lines;
        const old = lines.find((l) => l.key === key);
        if (!old) return;
        const merged = lines.filter((l) => l.key !== key);
        const dup = merged.find((l) => l.key === newKey);
        set({
          lines: dup ? merged.map((l) => (l.key === newKey ? { ...l, qty: l.qty + old.qty } : l)) : [...merged, { ...line, key: newKey, qty: old.qty }],
        });
      },
      clear() {
        set({ restaurant: null, lines: [] });
      },
    }),
    { name: "thaali.cart", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export function cartTotals(lines: CartLine[]) {
  return {
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
  };
}

/** True after the persisted cart has loaded from localStorage (avoids hydration mismatches). */
export function useCartHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useCart.persist.hasHydrated()) setHydrated(true);
    return useCart.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
