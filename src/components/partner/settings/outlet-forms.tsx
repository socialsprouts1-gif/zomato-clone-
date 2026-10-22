"use client";

import { CalendarOff, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addHoliday, removeHoliday, saveKitchenSettings, saveOpeningHours, saveOutletProfile, type HoursInput } from "@/lib/partner/ops-actions";

type R = { ok: boolean; error?: string };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save");
      toast.success(success);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

const fmtHoliday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

// ───────────────────────── Holidays ─────────────────────────

export function HolidaysSection({ restaurantId, holidays, readOnly }: { restaurantId: string; holidays: string[]; readOnly: boolean }) {
  const { pending, run } = useAction();
  const [date, setDate] = useState("");
  const today = istToday();
  const upcoming = holidays.filter((h) => h >= today).sort();
  return (
    <div className="space-y-4">
      {!readOnly ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return void toast.error("Pick a date");
            run(() => addHoliday(restaurantId, date), `Closed on ${fmtHoliday(date)}`, () => setDate(""));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="holiday-date">Holiday date</Label>
            <Input id="holiday-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
          </div>
          <Button type="submit" variant="outline" disabled={pending || !date}>
            <Plus /> Add holiday
          </Button>
        </form>
      ) : null}
      {upcoming.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarOff className="size-4" aria-hidden /> No upcoming holidays. You&apos;re open as per your timings.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Upcoming holidays">
          {upcoming.map((h) => (
            <li key={h} className="flex items-center gap-1 rounded-full border bg-secondary/50 py-1 pr-1 pl-3 text-sm font-medium">
              {fmtHoliday(h)}
              {h === today ? <span className="text-xs text-destructive">· today</span> : null}
              {!readOnly ? (
                <button
                  type="button"
                  className="ml-1 flex size-6 items-center justify-center rounded-full hover:bg-accent"
                  aria-label={`Remove holiday ${fmtHoliday(h)}`}
                  disabled={pending}
                  onClick={() => run(() => removeHoliday(restaurantId, h), "Holiday removed")}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Opening hours ─────────────────────────

const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;
type Day = (typeof DAYS)[number][0];

export function OpeningHoursEditor({ restaurantId, initial, readOnly }: { restaurantId: string; initial: Partial<HoursInput>; readOnly: boolean }) {
  const { pending, run } = useAction();
  const [hours, setHours] = useState<HoursInput>(() => Object.fromEntries(DAYS.map(([d]) => [d, (initial[d] ?? []).slice(0, 2)])) as HoursInput);
  const set = (d: Day, ranges: [string, string][]) => setHours((h) => ({ ...h, [d]: ranges }));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveOpeningHours(restaurantId, hours), "Opening hours saved");
      }}
    >
      <fieldset disabled={readOnly || pending} className="divide-y rounded-2xl border">
        <legend className="sr-only">Opening hours</legend>
        {DAYS.map(([d, label]) => {
          const ranges = hours[d];
          const open = ranges.length > 0;
          return (
            <div key={d} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center" data-testid={`hours-${d}`}>
              <label className="flex w-40 shrink-0 items-center gap-3 text-sm font-semibold">
                <Switch checked={open} aria-label={`Open on ${label}`} onCheckedChange={(v) => set(d, v ? [["10:00", "23:00"]] : [])} />
                {label}
              </label>
              {open ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {ranges.map(([o, c], i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input type="time" aria-label={`${label} shift ${i + 1} opens`} value={o} onChange={(e) => set(d, ranges.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} className="w-32" required />
                      <span className="text-muted-foreground">–</span>
                      <Input type="time" aria-label={`${label} shift ${i + 1} closes`} value={c} onChange={(e) => set(d, ranges.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} className="w-32" required />
                      {ranges.length > 1 ? (
                        <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${label} shift ${i + 1}`} onClick={() => set(d, ranges.filter((_, j) => j !== i))}>
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {ranges.length < 2 ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => set(d, [...ranges, ["19:00", "23:00"]])}>
                      <Plus /> Second shift
                    </Button>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Times are in India time. A closing time earlier than opening means you close after midnight.</p>
        {!readOnly ? (
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} Save hours
          </Button>
        ) : null}
      </div>
    </form>
  );
}

// ───────────────────────── Kitchen ─────────────────────────

export function KitchenForm({ restaurantId, prepMinutes, packagingPaise, readOnly }: { restaurantId: string; prepMinutes: number; packagingPaise: number; readOnly: boolean }) {
  const { pending, run } = useAction();
  const [prep, setPrep] = useState(String(prepMinutes));
  const [pack, setPack] = useState(String(packagingPaise / 100));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveKitchenSettings(restaurantId, { avg_prep_minutes: prep, packaging_rupees: pack }), "Kitchen settings saved");
      }}
    >
      <fieldset disabled={readOnly || pending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="prep-minutes">Average prep time (minutes)</Label>
          <Input id="prep-minutes" type="number" inputMode="numeric" min={5} max={90} value={prep} onChange={(e) => setPrep(e.target.value)} required />
          <p className="text-xs text-muted-foreground">Used for delivery estimates and auto-accept.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="packaging">Packaging charge per order (₹)</Label>
          <Input id="packaging" type="number" inputMode="decimal" min={0} max={200} step="0.5" value={pack} onChange={(e) => setPack(e.target.value)} required />
          <p className="text-xs text-muted-foreground">Added to the customer&apos;s bill.</p>
        </div>
      </fieldset>
      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save kitchen settings
        </Button>
      ) : null}
    </form>
  );
}

// ───────────────────────── Outlet profile ─────────────────────────

export function OutletProfileForm({ restaurantId, phone, description, diningEnabled, readOnly }: { restaurantId: string; phone: string; description: string; diningEnabled: boolean; readOnly: boolean }) {
  const { pending, run } = useAction();
  const [v, setV] = useState({ phone, description, dining_enabled: diningEnabled });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveOutletProfile(restaurantId, v), "Outlet profile saved");
      }}
    >
      <fieldset disabled={readOnly || pending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="outlet-phone">Outlet phone</Label>
          <Input id="outlet-phone" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outlet-description">About your restaurant</Label>
          <Textarea id="outlet-description" rows={3} maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          <p className="text-right text-xs text-muted-foreground">{v.description.length}/300</p>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-2xl border p-4">
          <span>
            <span className="block font-semibold">Dine-in table booking</span>
            <span className="text-sm text-muted-foreground">Let customers book a table from your restaurant page.</span>
          </span>
          <Switch checked={v.dining_enabled} aria-label="Table booking enabled" onCheckedChange={(d) => setV({ ...v, dining_enabled: d })} />
        </label>
      </fieldset>
      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save profile
        </Button>
      ) : null}
    </form>
  );
}
