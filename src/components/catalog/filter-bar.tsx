"use client";

import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SORT_LABELS, type SortKey } from "@/lib/catalog/filters";
import { cn } from "@/lib/utils";

const TOGGLES: { key: string; label: string }[] = [
  { key: "rating4", label: "Rating 4.0+" },
  { key: "veg", label: "Pure Veg" },
  { key: "offers", label: "Offers" },
  { key: "fast", label: "Fast delivery" },
  { key: "budget", label: "Under ₹300" },
  { key: "new", label: "New arrivals" },
];

export function FilterBar({ cuisines, resultCount }: { cuisines: string[]; resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [sortOpen, setSortOpen] = useState(false);
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const selected = (params.get("cuisines") ?? "").split(",").filter(Boolean);
  const [draft, setDraft] = useState<string[]>(selected);
  const sort = (params.get("sort") as SortKey | null) ?? "relevance";

  function update(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(params.toString());
    mutate(p);
    const qs = p.toString();
    start(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}#restaurants`, { scroll: false }));
  }

  const activeCount = TOGGLES.filter((t) => params.get(t.key) === "1").length + (selected.length ? 1 : 0) + (sort !== "relevance" ? 1 : 0);

  return (
    <div className={cn("sticky top-16 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur", pending && "opacity-80")}>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Filters">
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium", sort !== "relevance" && "border-primary bg-secondary text-secondary-foreground")}
        >
          <ArrowUpDown className="size-4" /> {sort === "relevance" ? "Sort" : SORT_LABELS[sort]} <ChevronDown className="size-3.5" />
        </button>
        {TOGGLES.map((t) => {
          const on = params.get(t.key) === "1";
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => update((p) => (on ? p.delete(t.key) : p.set(t.key, "1")))}
              className={cn("flex shrink-0 items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition", on && "border-primary bg-secondary text-secondary-foreground")}
            >
              {t.label}
              {on ? <X className="size-3.5" aria-hidden /> : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setDraft(selected);
            setCuisineOpen(true);
          }}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium", selected.length && "border-primary bg-secondary text-secondary-foreground")}
        >
          <SlidersHorizontal className="size-4" /> Cuisines{selected.length ? ` (${selected.length})` : ""} <ChevronDown className="size-3.5" />
        </button>
        {activeCount ? (
          <button type="button" onClick={() => start(() => router.replace(`${pathname}#restaurants`, { scroll: false }))} className="shrink-0 px-2 text-sm font-semibold text-primary">
            Clear all
          </button>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {resultCount} restaurants match
      </p>

      <Sheet open={sortOpen} onOpenChange={setSortOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-lg pb-6">
          <SheetHeader>
            <SheetTitle>Sort by</SheetTitle>
          </SheetHeader>
          <RadioGroup
            value={sort}
            onValueChange={(v) => {
              setSortOpen(false);
              update((p) => (v === "relevance" ? p.delete("sort") : p.set("sort", v)));
            }}
            className="px-5"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <Label key={k} className="flex cursor-pointer items-center justify-between rounded-xl border p-3 font-medium">
                {SORT_LABELS[k]} <RadioGroupItem value={k} aria-label={SORT_LABELS[k]} />
              </Label>
            ))}
          </RadioGroup>
        </SheetContent>
      </Sheet>

      <Sheet open={cuisineOpen} onOpenChange={setCuisineOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-lg pb-6">
          <SheetHeader>
            <SheetTitle>Cuisines</SheetTitle>
          </SheetHeader>
          <div className="grid max-h-[55dvh] grid-cols-2 gap-2 overflow-y-auto px-5">
            {cuisines.map((c) => (
              <Label key={c} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 font-normal">
                <Checkbox checked={draft.includes(c)} onCheckedChange={(v) => setDraft((d) => (v ? [...d, c] : d.filter((x) => x !== c)))} />
                {c}
              </Label>
            ))}
          </div>
          <div className="flex gap-2 px-5">
            <Button variant="outline" className="flex-1" onClick={() => setDraft([])}>
              Clear
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setCuisineOpen(false);
                update((p) => (draft.length ? p.set("cuisines", draft.join(",")) : p.delete("cuisines")));
              }}
            >
              <Check /> Apply
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
