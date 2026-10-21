"use client";

import { BadgePercent, Briefcase, CalendarClock, Check, Home, MapPin, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CouponView } from "@/lib/checkout/types";
import { cn, formatPaise } from "@/lib/utils";

export type AddressOption = { id: string; label: string; custom_label: string | null; flat: string | null; line1: string; landmark: string | null };

export function AddressPicker({ addresses, value, onChange, distanceKm }: { addresses: AddressOption[]; value: string | null; onChange: (id: string) => void; distanceKm: number | null }) {
  const [open, setOpen] = useState(false);
  const current = addresses.find((a) => a.id === value);
  const Icon = current?.label === "Home" ? Home : current?.label === "Work" ? Briefcase : MapPin;
  return (
    <>
      {current ? (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-start gap-3 text-left" aria-label="Change delivery address">
          <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              Delivering to {current.custom_label || current.label}
              {distanceKm !== null ? <span className="ml-1 text-xs font-normal text-muted-foreground">· {distanceKm.toFixed(1)} km away</span> : null}
            </span>
            <span className="line-clamp-2 text-sm text-muted-foreground">{[current.flat, current.line1].filter(Boolean).join(", ")}</span>
          </span>
          <span className="text-sm font-semibold text-primary">Change</span>
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Add an address to see delivery fees and place your order.</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/account/addresses/new?next=/cart">
              <Plus /> Add delivery address
            </Link>
          </Button>
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[80dvh] max-w-lg overflow-y-auto pb-6">
          <SheetHeader>
            <SheetTitle>Choose delivery address</SheetTitle>
          </SheetHeader>
          <ul className="grid gap-2 px-5">
            {addresses.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                  className={cn("flex w-full items-start gap-3 rounded-2xl border bg-card p-3 text-left", a.id === value && "border-primary bg-secondary/60")}
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{a.custom_label || a.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{[a.flat, a.line1].filter(Boolean).join(", ")}</span>
                  </span>
                  {a.id === value ? <Check className="size-4 text-primary" /> : null}
                </button>
              </li>
            ))}
            <li>
              <Link href="/account/addresses/new?next=/cart" className="flex items-center gap-2 rounded-2xl border border-dashed p-3 text-sm font-semibold text-primary">
                <Plus className="size-4" /> Add a new address
              </Link>
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function CouponPicker({
  coupons,
  applied,
  message,
  onApply,
  onRemove,
  loading,
}: {
  coupons: CouponView[];
  applied: string | null;
  message: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  return (
    <>
      {applied ? (
        <div className="flex items-center gap-3">
          <BadgePercent className="size-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">‘{applied}’ applied</p>
            <p className={cn("text-sm", message?.startsWith("You save") || message?.includes("applied") || message?.includes("free") ? "text-success" : "text-destructive")}>{message}</p>
          </div>
          <button type="button" className="text-sm font-semibold text-destructive" onClick={onRemove}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 text-left">
          <BadgePercent className="size-5 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">Apply coupon</span>
            <span className="text-sm text-muted-foreground">
              {coupons.filter((c) => c.eligible).length ? `${coupons.filter((c) => c.eligible).length} offers available` : "View all offers"}
            </span>
          </span>
          <span className="text-sm font-semibold text-primary">View</span>
        </button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[85dvh] max-w-lg flex-col pb-6">
          <SheetHeader>
            <SheetTitle>Coupons and offers</SheetTitle>
          </SheetHeader>
          <form
            className="flex gap-2 px-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) return;
              onApply(code.trim().toUpperCase());
              setOpen(false);
              setCode("");
            }}
          >
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" aria-label="Coupon code" className="uppercase" />
            <Button type="submit" disabled={loading || !code.trim()}>
              Apply
            </Button>
          </form>
          <ul className="grid gap-2 overflow-y-auto px-5">
            {coupons.map((c) => (
              <li key={c.code} className={cn("rounded-2xl border bg-card p-4", !c.eligible && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="w-fit rounded-md border border-dashed border-primary px-2 py-0.5 font-mono text-sm font-bold text-primary">{c.code}</p>
                    <p className="mt-2 font-semibold">{c.title}</p>
                    {c.description ? <p className="text-sm text-muted-foreground">{c.description}</p> : null}
                    <p className={cn("mt-1 text-xs font-semibold", c.eligible ? "text-success" : "text-muted-foreground")}>
                      {c.eligible ? (c.savingsPaise ? `Save ${formatPaise(c.savingsPaise)} on this order` : "Applicable on this order") : c.reason}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={c.eligible ? "default" : "outline"}
                    disabled={!c.eligible || loading}
                    onClick={() => {
                      onApply(c.code);
                      setOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** ASAP, or a 30-minute slot from 2 hours to 2 days ahead. */
export function SchedulePicker({ value, onChange, restaurantOpen }: { value: string | null; onChange: (iso: string | null) => void; restaurantOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const days = useMemo(() => {
    const start = new Date(Date.now() + 2 * 3600000);
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
    const end = Date.now() + 48 * 3600000;
    const slots: Date[] = [];
    for (let t = start.getTime(); t <= end; t += 30 * 60000) {
      const d = new Date(t);
      const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(d)) % 24;
      if (h >= 8 && h <= 23) slots.push(d);
    }
    const byDay = new Map<string, Date[]>();
    for (const s of slots) {
      const key = s.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
      byDay.set(key, [...(byDay.get(key) ?? []), s]);
    }
    return [...byDay.entries()];
  }, []);
  const [day, setDay] = useState(0);
  const label = value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Delivery time">
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          disabled={!restaurantOpen}
          onClick={() => onChange(null)}
          className={cn("flex items-center gap-2 rounded-2xl border bg-card p-3 text-left text-sm font-semibold disabled:opacity-50", !value && "border-primary bg-secondary")}
        >
          <Zap className="size-4 text-primary" /> ASAP
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={Boolean(value)}
          onClick={() => setOpen(true)}
          className={cn("flex items-center gap-2 rounded-2xl border bg-card p-3 text-left text-sm font-semibold", value && "border-primary bg-secondary")}
        >
          <CalendarClock className="size-4 text-primary" /> <span className="truncate">{label ?? "Schedule"}</span>
        </button>
      </div>
      {!restaurantOpen && !value ? <p className="mt-2 text-sm text-destructive">The restaurant is closed right now. Pick a time to schedule.</p> : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[80dvh] max-w-lg pb-6">
          <SheetHeader>
            <SheetTitle>Schedule your order</SheetTitle>
          </SheetHeader>
          <div className="flex gap-2 overflow-x-auto px-5">
            {days.map(([d], i) => (
              <button key={d} type="button" onClick={() => setDay(i)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", i === day && "border-primary bg-secondary")}>
                {d}
              </button>
            ))}
          </div>
          <div className="grid max-h-[45dvh] grid-cols-3 gap-2 overflow-y-auto px-5">
            {(days[day]?.[1] ?? []).map((s) => (
              <button
                key={s.toISOString()}
                type="button"
                onClick={() => {
                  onChange(s.toISOString());
                  setOpen(false);
                }}
                className={cn("rounded-xl border bg-card px-2 py-2 text-sm", value === s.toISOString() && "border-primary bg-secondary font-semibold")}
              >
                {s.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function TipSelector({ value, onChange }: { value: number; onChange: (paise: number) => void }) {
  const [custom, setCustom] = useState(false);
  const presets = [2000, 3000, 5000];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Rider tip">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value === p && !custom}
            onClick={() => {
              setCustom(false);
              onChange(value === p ? 0 : p);
            }}
            className={cn("rounded-full border bg-card px-4 py-1.5 text-sm font-semibold", value === p && !custom && "border-primary bg-secondary")}
          >
            {formatPaise(p)}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => setCustom(true)}
          className={cn("rounded-full border bg-card px-4 py-1.5 text-sm font-semibold", custom && "border-primary bg-secondary")}
        >
          Other
        </button>
      </div>
      {custom ? (
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          placeholder="Tip amount in ₹"
          aria-label="Custom tip in rupees"
          onChange={(e) => onChange(Math.max(0, Math.min(500, Math.round(Number(e.target.value) || 0))) * 100)}
          className="w-40"
        />
      ) : null}
      <p className="text-xs text-muted-foreground">100% of the tip goes to your delivery partner.</p>
    </div>
  );
}
