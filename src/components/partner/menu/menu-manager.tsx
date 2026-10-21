"use client";

import { ArrowDown, ArrowUp, Boxes, Clock, FolderPlus, LayoutList, Pencil, Plus, Search, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useState } from "react";
import { VegDot } from "@/components/catalog/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { FoodImage } from "@/components/shared/food-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatClock } from "@/lib/catalog/open-state";
import { moveCategory, moveItem, setItemInStock } from "@/lib/partner/menu-actions";
import { DAY_LABELS, isLowStock, type PartnerCategory, type PartnerItem } from "@/lib/partner/menu-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn, formatPaise } from "@/lib/utils";
import { CategoryDialog, type CategoryDialogState } from "./category-dialog";
import { InventoryView } from "./inventory-view";
import { ItemEditor, type EditorState } from "./item-editor";
import { useMenuAction } from "./use-menu-action";

type View = "menu" | "inventory";

function scheduleLabel(c: PartnerCategory) {
  const parts: string[] = [];
  if (c.available_from && c.available_to) parts.push(`${formatClock(c.available_from)} – ${formatClock(c.available_to)}`);
  if (c.available_days.length && c.available_days.length < 7) parts.push(c.available_days.map((d) => DAY_LABELS[d]).join(", "));
  return parts.join(" · ");
}

export function MenuManager({
  restaurant,
  categories,
  items,
  initialView,
}: {
  restaurant: { id: string; name: string; slug: string };
  categories: PartnerCategory[];
  items: PartnerItem[];
  initialView: View;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(categories.find((c) => !c.parent_id)?.id ?? null);
  const [query, setQuery] = useState("");
  const [catDialog, setCatDialog] = useState<CategoryDialogState | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  // Orders consume stock server-side; keep this screen current without a reload.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`partner-menu:${restaurant.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${restaurant.id}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 600);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, router]);

  const tops = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
  const selected = categories.find((c) => c.id === selectedId) ?? tops[0] ?? null;
  const ownCount = (id: string) => items.filter((i) => i.category_id === id).length;
  const treeCount = (id: string) => ownCount(id) + childrenOf(id).reduce((s, c) => s + ownCount(c.id), 0);
  const lowCount = items.filter(isLowStock).length;

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hits = items.filter((i) => i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q) || i.tags.some((t) => t.includes(q)));
      return categories.map((c) => ({ category: c, items: hits.filter((i) => i.category_id === c.id) })).filter((s) => s.items.length);
    }
    if (!selected) return [];
    return [selected, ...categories.filter((c) => c.parent_id === selected.id)].map((c) => ({ category: c, items: items.filter((i) => i.category_id === c.id) }));
  }, [query, items, categories, selected]);

  function changeView(v: string) {
    const next = v === "inventory" ? "inventory" : "menu";
    setView(next);
    const url = new URL(window.location.href);
    if (next === "inventory") url.searchParams.set("view", "inventory");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  }

  const dialogs = (
    <>
      <CategoryDialog restaurantId={restaurant.id} state={catDialog} onClose={() => setCatDialog(null)} onCreated={(id) => setSelectedId(id)} />
      <ItemEditor restaurantId={restaurant.id} categories={categories} state={editor} onClose={() => setEditor(null)} />
    </>
  );

  if (!categories.length) {
    return (
      <>
        <EmptyState
          icon={UtensilsCrossed}
          title="Your menu is empty"
          description="Start with a category like Starters or Main Course, then add dishes to it."
          action={
            <Button onClick={() => setCatDialog({ mode: "create", parent: null })}>
              <Plus /> Add your first category
            </Button>
          }
        />
        {dialogs}
      </>
    );
  }

  return (
    <Tabs value={view} onValueChange={changeView}>
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="menu">
          <LayoutList /> Menu
        </TabsTrigger>
        <TabsTrigger value="inventory">
          <Boxes /> Inventory
          {lowCount ? <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{lowCount}</span> : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="menu">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border bg-card p-3 lg:self-start" aria-label="Categories">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <h2 className="font-semibold">Categories</h2>
              <Button size="sm" variant="outline" onClick={() => setCatDialog({ mode: "create", parent: null })}>
                <Plus /> Add category
              </Button>
            </div>
            <ul className="space-y-1">
              {tops.map((c, i) => (
                <li key={c.id}>
                  <CategoryRow
                    category={c}
                    count={treeCount(c.id)}
                    active={selected?.id === c.id && !query}
                    first={i === 0}
                    last={i === tops.length - 1}
                    onSelect={() => { setSelectedId(c.id); setQuery(""); }}
                    onEdit={() => setCatDialog({ mode: "edit", category: c, itemCount: treeCount(c.id) })}
                    onAddSub={() => setCatDialog({ mode: "create", parent: c })}
                  />
                  {childrenOf(c.id).length ? (
                    <ul className="mt-1 ml-4 space-y-1 border-l pl-2">
                      {childrenOf(c.id).map((s, j, arr) => (
                        <li key={s.id}>
                          <CategoryRow
                            category={s}
                            count={ownCount(s.id)}
                            active={selected?.id === s.id && !query}
                            first={j === 0}
                            last={j === arr.length - 1}
                            onSelect={() => { setSelectedId(s.id); setQuery(""); }}
                            onEdit={() => setCatDialog({ mode: "edit", category: s, itemCount: ownCount(s.id) })}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-0 space-y-4" aria-label="Items">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all items" aria-label="Search items" className="pl-9" />
            </div>
            {query && !sections.length ? <EmptyState icon={Search} title="No matching items" description={`Nothing on the menu matches “${query}”.`} /> : null}
            {sections.map(({ category, items: list }) => (
              <div key={category.id} className="rounded-2xl border bg-card" data-testid="item-section" data-category-name={category.name}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      {category.parent_id ? <span className="text-muted-foreground">{categories.find((c) => c.id === category.parent_id)?.name} › </span> : null}
                      {category.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {list.length} item{list.length === 1 ? "" : "s"}
                      {!category.is_active ? " · hidden from customers" : ""}
                      {scheduleLabel(category) ? ` · ${scheduleLabel(category)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setEditor({ item: null, categoryId: category.id })} aria-label={`Add item to ${category.name}`}>
                    <Plus /> Add item
                  </Button>
                </div>
                {list.length ? (
                  <ul className="divide-y">
                    {list.map((it, idx) => (
                      <ItemRow key={it.id} item={it} first={idx === 0} last={idx === list.length - 1} reorderable={!query} onEdit={() => setEditor({ item: it, categoryId: it.category_id })} />
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No items here yet.</p>
                )}
              </div>
            ))}
          </section>
        </div>
      </TabsContent>

      <TabsContent value="inventory">
        <InventoryView items={items} categories={categories} />
      </TabsContent>
      {dialogs}
    </Tabs>
  );
}

function CategoryRow({
  category,
  count,
  active,
  first,
  last,
  onSelect,
  onEdit,
  onAddSub,
}: {
  category: PartnerCategory;
  count: number;
  active: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onAddSub?: () => void;
}) {
  const { run, pending } = useMenuAction();
  const schedule = scheduleLabel(category);
  return (
    <div className={cn("group flex items-center gap-1 rounded-xl px-1 py-1", active ? "bg-secondary" : "hover:bg-accent/60")} data-testid="category-row" data-category-name={category.name}>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
        aria-current={active ? "true" : undefined}
        aria-label={`${category.name}, ${count} item${count === 1 ? "" : "s"}${category.is_active ? "" : ", hidden"}`}
      >
        <span className={cn("flex items-center gap-2 text-sm font-medium", !category.is_active && "text-muted-foreground line-through")}>
          <span className="truncate">{category.name}</span>
          <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground" data-testid="category-count">
            {count}
          </span>
        </span>
        {schedule || !category.is_active ? (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {schedule ? (
              <>
                <Clock className="size-3" aria-hidden /> {schedule}
              </>
            ) : null}
            {!category.is_active ? <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Hidden</Badge> : null}
          </span>
        ) : null}
      </button>
      <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${category.name} up`} disabled={first || pending} onClick={() => void run(() => moveCategory(category.id, -1))}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${category.name} down`} disabled={last || pending} onClick={() => void run(() => moveCategory(category.id, 1))}>
        <ArrowDown />
      </Button>
      {onAddSub ? (
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Add subcategory to ${category.name}`} onClick={onAddSub}>
          <FolderPlus />
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${category.name}`} onClick={onEdit}>
        <Pencil />
      </Button>
    </div>
  );
}

function ItemRow({ item, first, last, reorderable, onEdit }: { item: PartnerItem; first: boolean; last: boolean; reorderable: boolean; onEdit: () => void }) {
  const { run, pending } = useMenuAction();
  const [inStock, setInStock] = useOptimistic(item.in_stock);
  const low = isLowStock(item);
  const fromPrice = item.item_variants.length ? Math.min(...item.item_variants.map((v) => v.price_paise)) : item.price_paise;
  const addons = item.addon_groups.reduce((s, g) => s + g.addons.length, 0);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap" data-testid="partner-item" data-item-name={item.name}>
      <FoodImage src={item.image_url} alt={item.name} name={item.name} sizes="56px" className={cn("size-14 shrink-0 rounded-xl", !inStock && "grayscale")} emojiClassName="text-2xl" />
      <div className="min-w-0 flex-1 basis-[calc(100%-4.75rem)] sm:basis-auto">
        <p className="flex items-center gap-2">
          <VegDot veg={item.is_veg} />
          {item.contains_egg ? <span className="text-[10px] font-bold text-amber-700 uppercase">Egg</span> : null}
          <span className="truncate font-semibold">{item.name}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {item.item_variants.length > 1 ? "from " : ""}
            {formatPaise(fromPrice)}
          </span>
          {item.item_variants.length ? <span>{item.item_variants.length} variants</span> : null}
          {addons ? <span>{addons} add-ons</span> : null}
          {item.stock_qty !== null ? <span data-testid="item-stock">{item.stock_qty} in stock</span> : null}
          {item.bestseller ? <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Bestseller</Badge> : null}
          {item.stock_qty === 0 ? (
            <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Out of stock</Badge>
          ) : low ? (
            <Badge className="bg-amber-500 px-1.5 py-0 text-[10px] text-white">Low stock</Badge>
          ) : null}
        </p>
      </div>
      <div className="flex w-full items-center justify-end gap-1 sm:ml-auto sm:w-auto">
        <label className="mr-auto flex items-center gap-2 text-xs font-medium text-muted-foreground sm:mr-2">
          <span>In stock</span>
          <Switch
            checked={inStock}
            aria-label={`In stock: ${item.name}`}
            disabled={pending}
            onCheckedChange={(on) =>
              void run(() => {
                setInStock(on);
                return setItemInStock(item.id, on);
              }, on ? `${item.name} is back in stock` : `${item.name} marked out of stock`)
            }
          />
        </label>
        {reorderable ? (
          <>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${item.name} up`} disabled={first || pending} onClick={() => void run(() => moveItem(item.id, -1))}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${item.name} down`} disabled={last || pending} onClick={() => void run(() => moveItem(item.id, 1))}>
              <ArrowDown />
            </Button>
          </>
        ) : null}
        <Button variant="outline" size="sm" aria-label={`Edit ${item.name}`} onClick={onEdit}>
          <Pencil /> <span className="hidden sm:inline">Edit</span>
        </Button>
      </div>
    </li>
  );
}
