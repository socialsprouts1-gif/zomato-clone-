"use client";

import { BookOpen, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCart, useCartHydrated, type CartRestaurant } from "@/components/cart/cart-store";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { unitPriceOf, type MenuCategory, type MenuItem } from "@/lib/catalog/menu-shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { CustomiseSheet, type Customisation } from "./customise-sheet";
import { MenuItemRow } from "./menu-item-row";

type Pending = { item: MenuItem; c: Customisation };

export function RestaurantMenu({
  restaurant,
  categories,
  items: initialItems,
  unavailableCategories,
  healthyMode,
  vegMode,
  realtime = true,
}: {
  restaurant: CartRestaurant;
  categories: (MenuCategory & { windowLabel?: string })[];
  items: MenuItem[];
  unavailableCategories: Record<string, string>;
  healthyMode: boolean;
  vegMode: boolean;
  realtime?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(vegMode);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [bestsellers, setBestsellers] = useState(false);
  const [customising, setCustomising] = useState<MenuItem | null>(null);
  const [conflict, setConflict] = useState<Pending | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const hydrated = useCartHydrated();
  const cart = useCart();
  const navRef = useRef<HTMLDivElement>(null);

  // Live stock / price / visibility updates from the restaurant (Supabase Realtime).
  useEffect(() => {
    if (!realtime) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`menu:${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${restaurant.id}` },
        (payload) => {
          const row = payload.new as Partial<MenuItem> & { id: string; is_deleted?: boolean };
          setItems((list) =>
            row.is_deleted
              ? list.filter((i) => i.id !== row.id)
              : list.map((i) =>
                  i.id === row.id
                    ? { ...i, in_stock: row.in_stock ?? i.in_stock, stock_qty: row.stock_qty ?? null, price_paise: row.price_paise ?? i.price_paise, name: row.name ?? i.name, bestseller: row.bestseller ?? i.bestseller }
                    : i,
                ),
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, realtime]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!vegMode || i.is_veg) &&
        (!vegOnly || i.is_veg) &&
        (!nonVegOnly || !i.is_veg) &&
        (!bestsellers || i.bestseller) &&
        (!q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)),
    );
  }, [items, query, vegOnly, nonVegOnly, bestsellers, vegMode]);

  const sections = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, items: visible.filter((i) => i.category_id === c.id) }))
        .filter((c) => c.items.length),
    [categories, visible],
  );

  // Scroll-spy for the sticky category nav.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveCat(top.target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(`cat-${s.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!activeCat || !navRef.current) return;
    navRef.current.querySelector(`[data-cat="${activeCat}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeCat]);

  const qtyFor = useCallback(
    (itemId: string) => (hydrated && cart.restaurant?.id === restaurant.id ? cart.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qty, 0) : 0),
    [hydrated, cart.lines, cart.restaurant, restaurant.id],
  );

  function lineFor(item: MenuItem, c: Customisation) {
    const addons = item.addon_groups.flatMap((g) => g.addons).filter((a) => c.addonIds.includes(a.id));
    const variant = item.item_variants.find((v) => v.id === c.variantId);
    return {
      itemId: item.id,
      name: item.name,
      isVeg: item.is_veg,
      imageUrl: item.image_url,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price_paise })),
      unitPrice: unitPriceOf(item, variant?.id ?? null, addons),
    };
  }

  function commit(item: MenuItem, c: Customisation) {
    const res = cart.add(restaurant, lineFor(item, c), c.qty);
    if (res === "conflict") {
      setConflict({ item, c });
      return;
    }
    toast.success(`Added ${item.name}`, { duration: 1500 });
  }

  function onAdd(item: MenuItem) {
    if (item.item_variants.length || item.addon_groups.length) setCustomising(item);
    else commit(item, { variantId: null, addonIds: [], qty: 1 });
  }

  function onDec(item: MenuItem) {
    const lines = cart.lines.filter((l) => l.itemId === item.id);
    const last = lines.at(-1);
    if (!last) return;
    if (lines.length > 1 && last.qty === 1) toast("Removed the last customisation you added");
    cart.setQty(last.key, last.qty - 1);
  }

  function scrollTo(catId: string) {
    setMenuOpen(false);
    const el = document.getElementById(`cat-${catId}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth" });
  }

  const chip = (on: boolean) =>
    cn("flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition", on && "border-primary bg-secondary text-secondary-foreground");

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 space-y-2 bg-background/95 px-4 pt-2 pb-1 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search in ${restaurant.name}`} className="pl-10" aria-label="Search the menu" />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="toolbar" aria-label="Menu filters">
          {!vegMode ? (
            <>
              <button type="button" aria-pressed={vegOnly} onClick={() => { setVegOnly((v) => !v); setNonVegOnly(false); }} className={chip(vegOnly)}>
                <span className="size-2.5 rounded-full bg-veg" /> Veg
              </button>
              <button type="button" aria-pressed={nonVegOnly} onClick={() => { setNonVegOnly((v) => !v); setVegOnly(false); }} className={chip(nonVegOnly)}>
                <span className="size-2.5 rounded-full bg-nonveg" /> Non-veg
              </button>
            </>
          ) : (
            <span className={chip(true)}>
              <span className="size-2.5 rounded-full bg-veg" /> Veg Mode on
            </span>
          )}
          <button type="button" aria-pressed={bestsellers} onClick={() => setBestsellers((v) => !v)} className={chip(bestsellers)}>
            Bestseller
          </button>
        </div>
        <nav ref={navRef} aria-label="Menu categories" className="flex gap-1 overflow-x-auto border-t pt-1 [scrollbar-width:none]">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              data-cat={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                "shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-semibold whitespace-nowrap text-muted-foreground transition",
                activeCat === s.id && "border-primary text-foreground",
              )}
            >
              {s.name} <span className="font-normal">({s.items.length})</span>
            </button>
          ))}
        </nav>
      </div>

      {sections.length === 0 ? (
        <EmptyState className="mt-4" icon={Search} title="No dishes match" description="Try a different search or remove a filter." />
      ) : (
        sections.map((s) => {
          const reason = unavailableCategories[s.id];
          return (
            <section key={s.id} id={`cat-${s.id}`} aria-labelledby={`cat-title-${s.id}`} className="scroll-mt-36 border-b pt-6 last:border-0">
              <h2 id={`cat-title-${s.id}`} className="font-display text-lg font-bold">
                {s.name} <span className="text-sm font-normal text-muted-foreground">({s.items.length})</span>
              </h2>
              {reason ? <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">{reason}</p> : null}
              <div className="divide-y">
                {s.items.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    available={item.in_stock && !reason}
                    unavailableReason={!item.in_stock ? "Out of stock" : reason ? "Not available now" : undefined}
                    healthyMode={healthyMode}
                    qty={qtyFor(item.id)}
                    onAdd={() => onAdd(item)}
                    onInc={() => onAdd(item)}
                    onDec={() => onDec(item)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className="fixed right-4 bottom-36 z-30 flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-bold text-background shadow-xl md:bottom-24"
      >
        <BookOpen className="size-4" /> Menu
      </button>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[75dvh] max-w-md pb-6">
          <SheetHeader>
            <SheetTitle>Jump to</SheetTitle>
          </SheetHeader>
          <ul className="overflow-y-auto px-5">
            {sections.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => scrollTo(s.id)} className="flex w-full justify-between rounded-xl px-3 py-3 text-left font-medium hover:bg-accent">
                  {s.name} <span className="text-muted-foreground">{s.items.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      <CustomiseSheet
        item={customising}
        open={Boolean(customising)}
        onOpenChange={(o) => !o && setCustomising(null)}
        vegOnly={vegMode}
        onSubmit={(c) => {
          if (customising) commit(customising, c);
          setCustomising(null);
        }}
      />

      <AlertDialog open={Boolean(conflict)} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace cart items?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items from {cart.restaurant?.name}. Do you want to discard them and add items from {restaurant.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep my cart</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!conflict) return;
                cart.replaceWith(restaurant, lineFor(conflict.item, conflict.c), conflict.c.qty);
                toast.success(`Cart replaced. Added ${conflict.item.name}`);
                setConflict(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
