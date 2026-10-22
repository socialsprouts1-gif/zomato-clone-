"use client";

import { Loader2, PauseCircle, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setAutoAccept, setOutletBusy, setOutletOnline } from "@/lib/partner/actions";
import { cn } from "@/lib/utils";

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

export function StatusSection({ restaurantId, isOnline, busyUntil, autoAccept }: { restaurantId: string; isOnline: boolean; busyUntil: string | null; autoAccept: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [online, setOnline] = useState(isOnline);
  const [auto, setAuto] = useState(autoAccept);
  const busy = Boolean(busyUntil && new Date(busyUntil).getTime() > Date.now());

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, rollback?: () => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        rollback?.();
        return void toast.error(r.error ?? "Couldn't update the outlet");
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-2xl border p-4">
        <div>
          <p className="font-semibold">
            <span className={cn("mr-2 inline-block size-2.5 rounded-full", online && !busy ? "bg-success" : "bg-muted-foreground")} aria-hidden />
            {online ? (busy ? "Online · busy" : "Online") : "Offline"}
          </p>
          <p className="text-sm text-muted-foreground">{online ? "Customers can order from you." : "Customers see you as temporarily closed."}</p>
        </div>
        <Switch
          checked={online}
          aria-label="Restaurant online"
          className="data-[state=checked]:bg-success"
          onCheckedChange={(v) => {
            setOnline(v);
            act(() => setOutletOnline(restaurantId, v), v ? "You're online and accepting orders" : "You're offline. Customers can't order right now.", () => setOnline(!v));
          }}
        />
      </div>

      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex items-start gap-3">
          <PauseCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-semibold">Busy mode</p>
            <p className="text-sm text-muted-foreground" data-testid="busy-status">
              {busy ? `Busy until ${fmtTime(busyUntil!)}. New orders are paused.` : "Pause new orders for a while when the kitchen is swamped."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 60].map((m) => (
            <Button key={m} size="sm" variant="outline" disabled={pending || !online} onClick={() => act(() => setOutletBusy(restaurantId, m), `Paused new orders for ${m} minutes`)}>
              Busy for {m} min
            </Button>
          ))}
          {busy ? (
            <Button size="sm" disabled={pending} onClick={() => act(() => setOutletBusy(restaurantId, null), "Taking orders again")}>
              {pending ? <Loader2 className="animate-spin" /> : null} I&apos;m back now
            </Button>
          ) : null}
        </div>
        {!online ? <p className="text-xs text-muted-foreground">Go online to use busy mode.</p> : null}
      </div>

      <label className="flex items-center justify-between gap-4 rounded-2xl border p-4">
        <span className="flex items-start gap-3">
          <Zap className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold">Auto-accept orders</span>
            <span className="text-sm text-muted-foreground">New orders are accepted with your usual prep time.</span>
          </span>
        </span>
        <Switch
          checked={auto}
          aria-label="Auto-accept orders"
          onCheckedChange={(v) => {
            setAuto(v);
            act(() => setAutoAccept(restaurantId, v), v ? "New orders will be accepted automatically" : "Auto-accept off", () => setAuto(!v));
          }}
        />
      </label>
    </div>
  );
}
