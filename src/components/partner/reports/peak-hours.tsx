"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HeatCell } from "@/lib/partner/reports";
import { ChartTooltip } from "./chart-tooltip";
import { DOW, hourLabel } from "./format";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Orders by hour of day (bar) and a weekday × hour heatmap (one hue, light → dark). */
export function PeakHours({ cells }: { cells: HeatCell[] }) {
  const grid = new Map(cells.map((c) => [`${c.dow}:${c.hour}`, c.orders]));
  const byHour = HOURS.map((h) => ({ hour: h, label: hourLabel(h, true), orders: cells.filter((c) => c.hour === h).reduce((s, c) => s + c.orders, 0) }));
  const total = byHour.reduce((s, h) => s + h.orders, 0);
  const peak = byHour.reduce((a, b) => (b.orders > a.orders ? b : a), byHour[0]!);
  const max = Math.max(1, ...cells.map((c) => c.orders));
  // Trim quiet early-morning hours when nothing happened there.
  const firstHour = Math.min(8, ...cells.map((c) => c.hour));
  const hours = HOURS.filter((h) => h >= firstHour);
  const shade = (n: number) => (n === 0 ? "var(--muted)" : `color-mix(in oklab, var(--primary) ${Math.round(20 + Math.sqrt(n / max) * 80)}%, var(--card))`);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="peak-title">
      <h2 id="peak-title" className="font-display text-lg font-semibold">Peak hours</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {total > 0 ? `Busiest hour: ${hourLabel(peak.hour)}–${hourLabel((peak.hour + 1) % 24)} (${peak.orders} orders)` : "No orders in this range yet."}
      </p>
      <div className="h-48 w-full" data-testid="chart-hours">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byHour.filter((h) => h.hour >= firstHour)} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as { hour: number; orders: number } | undefined;
                return <ChartTooltip active={active} label={p ? `${hourLabel(p.hour)}–${hourLabel((p.hour + 1) % 24)}` : ""} rows={p ? [{ name: "Orders", value: String(p.orders) }] : []} />;
              }}
            />
            <Bar dataKey="orders" name="Orders" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mt-5 mb-2 text-sm font-semibold">Day × hour</h3>
      <div className="overflow-x-auto pb-1">
        <div
          role="table"
          aria-label="Orders by weekday and hour of day"
          data-testid="heatmap"
          className="grid min-w-[20rem] gap-[2px] text-[10px]"
          style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))` }}
        >
          <div role="row" style={{ display: "contents" }}>
            <span role="columnheader"><span className="sr-only">Day</span></span>
            {hours.map((h) => (
              <span key={h} role="columnheader" className="overflow-visible whitespace-nowrap text-muted-foreground" aria-label={hourLabel(h)}>
                {h % 3 === 0 ? hourLabel(h, true) : ""}
              </span>
            ))}
          </div>
          {DOW.map((d, dow) => (
            <div key={d} role="row" style={{ display: "contents" }} data-testid="heatmap-row">
              <span role="rowheader" className="font-medium text-muted-foreground">{d}</span>
              {hours.map((h) => {
                const n = grid.get(`${dow}:${h}`) ?? 0;
                return (
                  <span key={h} role="cell" title={`${d} ${hourLabel(h)}: ${n} orders`} aria-label={`${d} ${hourLabel(h)}: ${n} orders`} className="h-5 rounded-[4px]" style={{ background: shade(n) }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-muted-foreground" aria-hidden>
        Fewer
        {[0.15, 0.4, 0.65, 0.9].map((f) => (
          <span key={f} className="size-3 rounded-[3px]" style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(20 + f * 80)}%, var(--card))` }} />
        ))}
        More
      </div>
    </section>
  );
}
