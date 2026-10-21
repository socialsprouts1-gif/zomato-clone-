"use client";

import { CalendarRange, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Preset = "today" | "7d" | "30d" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Custom" },
];

export function RangePicker({ preset, from, to, today }: { preset: Preset; from: string; to: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [showCustom, setShowCustom] = useState(preset === "custom");
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const go = (qs: string) => start(() => router.push(`${pathname}?${qs}`, { scroll: false }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
        {PRESETS.map((p) => {
          const active = p.key === "custom" ? showCustom : !showCustom && preset === p.key;
          return (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              disabled={pending}
              onClick={() => {
                if (p.key === "custom") return setShowCustom(true);
                setShowCustom(false);
                go(`range=${p.key}`);
              }}
            >
              {p.key === "custom" ? <CalendarRange /> : null}
              {p.label}
            </Button>
          );
        })}
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading report" /> : null}
      </div>
      {showCustom ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!customFrom || !customTo) return toast.error("Pick both dates");
            if (customFrom > customTo) return toast.error("The start date must be before the end date");
            go(`range=custom&from=${customFrom}&to=${customTo}`);
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" value={customFrom} max={today} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" type="date" value={customTo} max={today} onChange={(e) => setCustomTo(e.target.value)} className="w-40" required />
          </div>
          <Button type="submit" size="sm" className={cn("h-10")} disabled={pending}>
            Apply
          </Button>
        </form>
      ) : null}
    </div>
  );
}
