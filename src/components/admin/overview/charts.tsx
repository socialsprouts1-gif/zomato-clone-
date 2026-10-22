"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/partner/reports/chart-tooltip";
import { compactRupees, dayLabel } from "@/components/partner/reports/format";
import { adminStatusLabel } from "@/components/admin/orders/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OverviewDay, StatusCount } from "@/lib/admin/overview";
import { statusMeta } from "@/lib/orders/status";
import { formatPaise } from "@/lib/utils";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
const TONE_FILL = { live: "var(--primary)", done: "var(--success)", bad: "var(--destructive)", wait: "var(--muted-foreground)" } as const;

/** Orders or GMV per day: one measure at a time (no dual axis). */
export function TrendChart({ daily, days, onDaysChange, loading }: { daily: OverviewDay[]; days: 14 | 30; onDaysChange: (d: 14 | 30) => void; loading?: boolean }) {
  const [metric, setMetric] = useState<"orders" | "gmv">("orders");
  const data = daily.map((d) => ({ ...d, label: dayLabel(d.day) }));
  const interval = data.length > 14 ? Math.ceil(data.length / 7) - 1 : 1;
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="trend-title" aria-busy={loading}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="trend-title" className="font-display text-lg font-semibold">{metric === "orders" ? "Orders per day" : "GMV per day"}</h2>
          <p className="text-xs text-muted-foreground">Last {days} days, India time{metric === "gmv" ? " · excludes cancelled orders" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tabs value={metric} onValueChange={(v) => setMetric(v as "orders" | "gmv")}>
            <TabsList className="h-9" aria-label="Measure">
              <TabsTrigger value="orders" className="text-xs">Orders</TabsTrigger>
              <TabsTrigger value="gmv" className="text-xs">GMV</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={String(days)} onValueChange={(v) => onDaysChange(v === "30" ? 30 : 14)}>
            <TabsList className="h-9" aria-label="Range">
              <TabsTrigger value="14" className="text-xs">14 days</TabsTrigger>
              <TabsTrigger value="30" className="text-xs">30 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="h-60 w-full sm:h-72" data-testid="chart-trend">
        <ResponsiveContainer width="100%" height="100%">
          {metric === "gmv" ? (
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={interval} minTickGap={4} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactRupees(v)} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={({ active, payload, label }) => (
                  <ChartTooltip active={active} label={String(label ?? "")} rows={payload?.length ? [{ name: "GMV", value: formatPaise(Number(payload[0]!.value)) }, { name: "Orders", value: String((payload[0]!.payload as OverviewDay).orders) }] : []} />
                )}
              />
              <Bar dataKey="gmv_paise" name="GMV" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={interval} minTickGap={4} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => (
                  <ChartTooltip active={active} label={String(label ?? "")} rows={payload?.length ? [{ name: "Orders", value: String(payload[0]!.value) }, { name: "Cancelled", value: String((payload[0]!.payload as OverviewDay).cancelled) }] : []} />
                )}
              />
              <Line type="monotone" dataKey="orders" name="Orders" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/** Orders by status, as labelled horizontal bars coloured by tone (live / delivered / cancelled / waiting). */
export function StatusMixChart({ today, range, days }: { today: StatusCount[]; range: StatusCount[]; days: number }) {
  const [scope, setScope] = useState<"today" | "range">("today");
  const rows = (scope === "today" ? today : range).map((r) => ({ ...r, label: adminStatusLabel(r.status), tone: statusMeta[r.status].tone }));
  const total = rows.reduce((s, r) => s + r.orders, 0);
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="mix-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="mix-title" className="font-display text-lg font-semibold">Status mix</h2>
          <p className="text-xs text-muted-foreground">{total} orders {scope === "today" ? "today" : `in the last ${days} days`}</p>
        </div>
        <Tabs value={scope} onValueChange={(v) => setScope(v as "today" | "range")}>
          <TabsList className="h-9" aria-label="Period">
            <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
            <TabsTrigger value="range" className="text-xs">{days} days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No orders yet today.</p>
      ) : (
        <div style={{ height: Math.max(160, rows.length * 34 + 16) }} className="w-full" data-testid="chart-status-mix">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={6}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={150} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  return <ChartTooltip active={active} label={p?.label} rows={p ? [{ name: "Orders", value: String(p.orders) }, { name: "Share", value: `${total ? Math.round((p.orders * 100) / total) : 0}%` }] : []} />;
                }}
              />
              <Bar dataKey="orders" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: "var(--foreground)" }}>
                {rows.map((r) => (
                  <Cell key={r.status} fill={TONE_FILL[r.tone]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
