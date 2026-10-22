"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Search, Store, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { FoodImage } from "@/components/shared/food-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setCollectionRestaurants } from "@/lib/admin/content-actions";

export type RestaurantPick = { id: string; name: string; locality: string | null; cuisines: string[]; cover_image_url: string | null; status: string };

export function CollectionRestaurantsEditor({ collectionId, initial, restaurants }: { collectionId: string; initial: string[]; restaurants: RestaurantPick[] }) {
  const router = useRouter();
  const [ids, setIds] = useState(initial);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(restaurants.map((r) => [r.id, r])), [restaurants]);
  const dirty = ids.join() !== initial.join();
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return restaurants
      .filter((r) => !ids.includes(r.id))
      .filter((r) => !s || r.name.toLowerCase().includes(s) || (r.locality ?? "").toLowerCase().includes(s) || r.cuisines.some((c) => c.toLowerCase().includes(s)))
      .slice(0, 12);
  }, [q, ids, restaurants]);

  function move(i: number, d: -1 | 1) {
    setIds((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }
  function save() {
    start(async () => {
      const res = await setCollectionRestaurants(collectionId, ids);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Restaurants saved");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section aria-labelledby="in-collection" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="in-collection" className="font-display text-lg font-semibold">
            In this collection ({ids.length})
          </h2>
          <div className="flex gap-2">
            {dirty ? (
              <Button variant="ghost" size="sm" onClick={() => setIds(initial)} disabled={pending}>
                Undo changes
              </Button>
            ) : null}
            <Button onClick={save} disabled={!dirty || pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Save restaurants
            </Button>
          </div>
        </div>
        {ids.length === 0 ? (
          <EmptyState icon={Store} title="No restaurants yet" description="Search on the right and add restaurants. The collection is hidden from the home page until it has some." />
        ) : (
          <ol className="space-y-2" aria-label="Restaurants in this collection">
            {ids.map((id, i) => {
              const r = byId.get(id);
              if (!r) return null;
              return (
                <li key={id}>
                  <Card className="flex items-center gap-3 p-2.5" data-testid="collection-member">
                    <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <FoodImage src={r.cover_image_url} alt="" name={r.name} sizes="48px" className="size-12 shrink-0 rounded-lg" emojiClassName="text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.locality ?? r.cuisines.slice(0, 2).join(", ")}
                        {r.status !== "approved" ? " · not live" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${r.name} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label={`Remove ${r.name}`} onClick={() => setIds((cur) => cur.filter((x) => x !== id))}>
                        <X />
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="add-restaurants" className="space-y-3">
        <h2 id="add-restaurants" className="font-display text-lg font-semibold">
          Add restaurants
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search by name, area or cuisine" aria-label="Search restaurants to add" className="pl-9" />
        </div>
        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{q ? "No matching restaurants." : "Every restaurant is already in this collection."}</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
                <FoodImage src={r.cover_image_url} alt="" name={r.name} sizes="40px" className="size-10 shrink-0 rounded-lg" emojiClassName="text-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[r.locality, r.cuisines.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</p>
                </div>
                {r.status !== "approved" ? <Badge variant="outline">{r.status}</Badge> : null}
                <Button variant="outline" size="sm" aria-label={`Add ${r.name}`} onClick={() => setIds((cur) => [...cur, r.id])}>
                  <Plus /> Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
