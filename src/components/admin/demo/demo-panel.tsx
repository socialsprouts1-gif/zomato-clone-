"use client";

import { Bike, Check, ChefHat, ExternalLink, Loader2, PlayCircle, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DEMO_PASSWORD } from "@/config/demo";
import type { DemoProgress } from "@/lib/admin/demo";
import { runFullDemo } from "@/lib/admin/orders-actions";
import { statusMeta, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

const STEPS: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"];
const TERMINAL: OrderStatus[] = ["DELIVERED", "REJECTED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "FAILED_PAYMENT"];

const secs = (from: string, to: string | number) => Math.max(0, Math.round(((typeof to === "number" ? to : new Date(to).getTime()) - new Date(from).getTime()) / 1000));

/**
 * "Run full demo": places a real order for the demo customer and walks it to DELIVERED in about a
 * minute, while the presenter watches the customer, partner, rider and admin views.
 */
export function DemoPanel({ initialOrderId, onProgress }: { initialOrderId: string | null; onProgress?: () => void }) {
  const [orderId, setOrderId] = useState<string | null>(initialOrderId);
  const [progress, setProgress] = useState<DemoProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastStatus = useRef<OrderStatus | null>(null);
  const cb = useRef(onProgress);
  cb.current = onProgress;

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/demo/tick?order=${id}`, { method: "POST" });
      if (!res.ok) return null;
      const p = (await res.json()) as DemoProgress;
      setProgress(p);
      if (p.status !== lastStatus.current) {
        lastStatus.current = p.status;
        cb.current?.();
      }
      return p;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const p = await poll(orderId);
      if (stop || (p && TERMINAL.includes(p.status))) return;
      t = setTimeout(loop, 2000);
    };
    void loop();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [orderId, poll]);

  const running = Boolean(progress && !TERMINAL.includes(progress.status));
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  async function start() {
    setStarting(true);
    const res = await runFullDemo();
    setStarting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    lastStatus.current = null;
    setProgress(null);
    setOrderId(res.data!.orderId);
    toast.success(res.data!.resumed ? "A demo is already running. Showing it." : "Demo order placed");
  }

  const reached = new Set(progress?.steps.map((s) => s.status) ?? []);
  const stepAt = (s: OrderStatus) => progress?.steps.find((x) => x.status === s)?.at ?? null;
  const done = progress?.status === "DELIVERED";
  const failed = progress && TERMINAL.includes(progress.status) && !done;
  const pct = progress ? Math.round((STEPS.filter((s) => reached.has(s)).length / STEPS.length) * 100) : 0;
  const elapsed = progress ? secs(progress.createdAt, done && progress.deliveredAt ? progress.deliveredAt : now) : 0;

  const links = orderId
    ? [
        { href: `/orders/${orderId}`, label: "Customer tracking", who: "customer@demo.in", icon: Smartphone },
        { href: "/partner", label: "Partner board", who: "owner@demo.in", icon: ChefHat },
        { href: "/rider", label: "Rider app", who: "rider@demo.in", icon: Bike },
        { href: `/admin/orders/${orderId}`, label: "Admin order", who: "admin@demo.in", icon: ShieldCheck },
      ]
    : [];

  return (
    <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-secondary/70 to-card p-4 shadow-sm sm:p-5" aria-labelledby="demo-title" data-testid="demo-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 id="demo-title" className="font-display text-lg font-semibold">Run full demo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Places a cash-on-delivery order for Priya at Saffron Courtyard and walks it from placed to delivered in about a minute. Opening hours are ignored for this order.
          </p>
        </div>
        <Button onClick={() => void start()} disabled={starting || running} className="gap-2">
          {starting || running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlayCircle className="size-4" aria-hidden />}
          {running ? "Demo running" : done || failed ? "Run again" : "Run full demo"}
        </Button>
      </div>

      {progress ? (
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <p>
                Order <span className="font-semibold">#{progress.orderNumber}</span> ·{" "}
                <span className={cn("font-semibold", done ? "text-success" : failed ? "text-destructive" : "text-primary")} data-testid="demo-status" data-status={progress.status}>
                  {statusMeta[progress.status].label}
                </span>
                {progress.riderName ? <span className="text-muted-foreground"> · rider {progress.riderName}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums" aria-live="off">{done ? `Delivered in ${elapsed} s` : `${elapsed} s`}</p>
            </div>
            <Progress value={pct} aria-label="Demo progress" />
          </div>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Order steps">
            {STEPS.map((s) => {
              const at = stepAt(s);
              const isNow = progress.status === s && !done;
              return (
                <li key={s} className={cn("flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2 text-xs", reached.has(s) ? "border-success/40" : "opacity-60", isNow && "border-primary ring-2 ring-primary/20")}>
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", reached.has(s) ? "bg-success text-white" : "bg-muted")} aria-hidden>
                    {reached.has(s) ? <Check className="size-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{statusMeta[s].label}</span>
                    <span className="block text-muted-foreground tabular-nums">{at ? `+${secs(progress.createdAt, at)} s` : isNow ? "now" : "waiting"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Open each view in its own browser profile or private window, signed in as shown (password {DEMO_PASSWORD}).
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {links.map(({ href, label, who, icon: Icon }) => (
                <li key={label}>
                  <Link href={href} target="_blank" rel="noopener" className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-sm hover:border-primary">
                    <Icon className="size-4 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{who}</span>
                    </span>
                    <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : orderId ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the demo order…
        </p>
      ) : null}
    </section>
  );
}
