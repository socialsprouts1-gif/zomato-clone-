"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateStatements } from "@/lib/admin/payouts-actions";

/** Week picker (navigates with ?week=) — keeps the type/status filters. */
export function WeekSelect({ weeks, value, keep }: { weeks: { start: string; label: string }[]; value: string; keep: Record<string, string | undefined> }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="payout-week" className="shrink-0 text-sm">
        Week
      </Label>
      <select
        id="payout-week"
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams();
          for (const [k, v] of Object.entries({ ...keep, week: e.target.value })) if (v) sp.set(k, v);
          router.push(`/admin/payouts?${sp.toString()}`);
        }}
        className="h-10 rounded-xl border bg-background px-3 text-sm"
      >
        {weeks.map((w) => (
          <option key={w.start} value={w.start}>
            {w.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function GenerateButton({ week, hasStatements }: { week: string; hasStatements: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateStatements(week);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`Statements ready: ${r.data?.restaurants ?? 0} restaurants, ${r.data?.riders ?? 0} riders`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {hasStatements ? "Regenerate statements" : "Generate statements"}
    </Button>
  );
}
