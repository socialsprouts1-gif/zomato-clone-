"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveEvent } from "@/lib/admin/rescue-actions";

export const EVENT_CATEGORIES = ["Concert", "Comedy", "Food festival", "Workshop", "Theatre", "Sports", "Other"];

export type EventFormValue = {
  id?: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  city: string;
  startsAtLocal: string;
  imageUrl: string;
  isActive: boolean;
  tiers: { id?: string; name: string; price_paise: number; capacity: number; sold?: number }[];
};

type TierDraft = { key: string; id?: string; name: string; price: string; capacity: string; sold: number };

const blank: EventFormValue = { title: "", description: "", category: "Concert", venue: "", city: "Pune", startsAtLocal: "", imageUrl: "", isActive: true, tiers: [{ name: "General", price_paise: 49900, capacity: 100 }] };
let keySeq = 0;
const toDraft = (t: EventFormValue["tiers"][number]): TierDraft => ({ key: `t${keySeq++}`, id: t.id, name: t.name, price: String(t.price_paise / 100), capacity: String(t.capacity), sold: t.sold ?? 0 });

export function EventFormDialog({ initial }: { initial?: EventFormValue }) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<EventFormValue>(initial ?? blank);
  const [tiers, setTiers] = useState<TierDraft[]>((initial ?? blank).tiers.map(toDraft));
  const [pending, start] = useTransition();
  const set = <K extends keyof EventFormValue>(k: K, val: EventFormValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const setTier = (key: string, patch: Partial<TierDraft>) => setTiers((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setV(initial ?? blank);
      setTiers((initial ?? blank).tiers.map(toDraft));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = tiers.map((t) => ({ id: t.id, name: t.name, price_paise: Math.round(Number(t.price) * 100), capacity: Number(t.capacity) }));
    if (parsed.some((t) => !Number.isFinite(t.price_paise) || t.price_paise < 0 || !Number.isInteger(t.capacity) || t.capacity < 1)) {
      toast.error("Check the ticket prices and capacities");
      return;
    }
    start(async () => {
      const r = await saveEvent({ ...v, tiers: parsed });
      if (!r.ok) return void toast.error(r.error);
      toast.success(editing ? "Event updated" : "Event created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm" aria-label={`Edit ${initial?.title}`}>
            <Pencil /> Edit
          </Button>
        ) : (
          <Button>
            <Plus /> New event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>Times are India time. Prices are per ticket.</DialogDescription>
        </DialogHeader>
        <form id="event-form" onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input id="ev-title" value={v.title} onChange={(e) => set("title", e.target.value)} required minLength={3} maxLength={120} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-category">Category</Label>
              <select id="ev-category" value={v.category} onChange={(e) => set("category", e.target.value)} className="h-10 w-full rounded-xl border bg-background px-3 text-sm">
                {(EVENT_CATEGORIES.includes(v.category) ? EVENT_CATEGORIES : [v.category, ...EVENT_CATEGORIES]).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date and time</Label>
              <Input id="ev-date" type="datetime-local" value={v.startsAtLocal} onChange={(e) => set("startsAtLocal", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-venue">Venue</Label>
              <Input id="ev-venue" value={v.venue} onChange={(e) => set("venue", e.target.value)} required maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-city">City</Label>
              <Input id="ev-city" value={v.city} onChange={(e) => set("city", e.target.value)} required maxLength={60} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-image">Image URL</Label>
            <Input id="ev-image" type="url" inputMode="url" value={v.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea id="ev-desc" value={v.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={2000} />
          </div>

          <fieldset className="space-y-2 rounded-xl border p-3">
            <legend className="px-1 text-sm font-semibold">Ticket tiers</legend>
            {tiers.map((t, i) => (
              <div key={t.key} className="grid grid-cols-[1fr_5.5rem_5rem_auto] items-end gap-2" data-testid="tier-row">
                <div className="space-y-1">
                  <Label htmlFor={`${t.key}-name`} className="text-xs">
                    Tier {i + 1} name
                  </Label>
                  <Input id={`${t.key}-name`} value={t.name} onChange={(e) => setTier(t.key, { name: e.target.value })} required maxLength={40} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${t.key}-price`} className="text-xs">
                    Tier {i + 1} price (₹)
                  </Label>
                  <Input id={`${t.key}-price`} type="number" min={0} step="0.01" value={t.price} onChange={(e) => setTier(t.key, { price: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${t.key}-cap`} className="text-xs">
                    Tier {i + 1} capacity
                  </Label>
                  <Input id={`${t.key}-cap`} type="number" min={Math.max(1, t.sold)} step={1} value={t.capacity} onChange={(e) => setTier(t.key, { capacity: e.target.value })} required />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove tier ${i + 1}`} disabled={tiers.length === 1 || t.sold > 0} title={t.sold > 0 ? `${t.sold} sold` : undefined} onClick={() => setTiers((ts) => ts.filter((x) => x.key !== t.key))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            {tiers.length < 8 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setTiers((ts) => [...ts, toDraft({ name: "", price_paise: 0, capacity: 50 })])}>
                <Plus /> Add tier
              </Button>
            ) : null}
          </fieldset>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <Label htmlFor="ev-active">Listed (visible to customers)</Label>
            <Switch id="ev-active" checked={v.isActive} onCheckedChange={(c) => set("isActive", c)} />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="event-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {editing ? "Save changes" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
