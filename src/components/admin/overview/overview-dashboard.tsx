"use client";

import { Ban, Bike, IndianRupee, Receipt, ShoppingBag, Store, type LucideIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { DemoPanel } from "@/components/admin/demo/demo-panel";
import { useRealtime } from "@/hooks/use-realtime";
import { fetchOverview, type Overview } from "@/lib/admin/overview";
import { cn, formatPaise } from "@/lib/utils";
import { StatusMixChart, TrendChart } from "./charts";
import { LiveMap } from "./live-map";

function Kpi({ id, label, value, hint, icon: Icon }: { id: string; label: string; value: string; hint?: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm" data-testid={`kpi-${id}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-bold tabular-nums" data-testid={`kpi-${id}-value`}>{value}</p>
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Admin overview: KPIs, live map and trends. Refreshes on order / rider movement (realtime, polling fallback). */
export function OverviewDashboard({ initial, demo }: { initial: Overview; demo: { enabled: boolean; orderId: string | null } }) {
  const [data, setData] = useState(initial);
  const [days, setDays] = useState<14 | 30>(initial.days === 30 ? 30 : 14);
  const [loading, setLoading] = useState(false);
  const daysRef = useRef(days);
  daysRef.current = days;
  const inFlight = useRef(false);
  const lastRun = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastRun.current = Date.now();
    try {
      setData(await fetchOverview(daysRef.current));
    } catch {
      // keep the last good numbers; the next event or poll retries
    } finally {
      inFlight.current = false;
    }
  }, []);

  // At most one refresh every 3 s, however many rows change.
  const schedule = useCallback(() => {
    if (timer.current) return;
    const wait = Math.max(0, 3000 - (Date.now() - lastRun.current));
    timer.current = setTimeout(() => {
      timer.current = null;
      void refresh();
    }, wait);
  }, [refresh]);

  const status = useRealtime("admin-overview", [{ table: "orders" }, { table: "rider_locations", event: "INSERT" }], schedule, 10000);

  async function changeDays(d: 14 | 30) {
    setDays(d);
    daysRef.current = d;
    setLoading(true);
    await refresh();
    setLoading(false);
  }

  const k = data.kpis;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span className={cn("inline-block size-2 rounded-full", status === "live" ? "bg-success" : "bg-muted-foreground")} aria-hidden />
          {status === "live" ? "Live" : "Updating every 10 s"} · today is {new Date(`${data.today}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })} (IST)
        </p>
      </div>
      {demo.enabled ? <DemoPanel initialOrderId={demo.orderId} onProgress={schedule} /> : null}
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi id="gmv" label="GMV today" value={formatPaise(k.gmv_paise)} icon={IndianRupee} hint="Excludes cancelled" />
        <Kpi id="orders" label="Orders today" value={String(k.orders)} icon={ShoppingBag} />
        <Kpi id="aov" label="Avg order value" value={formatPaise(k.aov_paise)} icon={Receipt} />
        <Kpi id="riders" label="Riders online" value={String(k.active_riders)} icon={Bike} />
        <Kpi id="restaurants" label="Restaurants online" value={String(k.active_restaurants)} icon={Store} hint="Approved & accepting" />
        <Kpi id="cancel" label="Cancellation rate" value={`${k.cancellation_rate}%`} icon={Ban} hint={`${k.cancelled} of ${k.orders} today`} />
      </section>
      <LiveMap live={data.live} riders={data.riders} restaurants={data.restaurants} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TrendChart daily={data.daily} days={days} onDaysChange={(d) => void changeDays(d)} loading={loading} />
        <StatusMixChart today={data.statusMixToday} range={data.statusMixRange} days={data.days} />
      </div>
    </div>
  );
}
