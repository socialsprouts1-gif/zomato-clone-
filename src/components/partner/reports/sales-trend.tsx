"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DailyPoint } from "@/lib/partner/reports";
import { formatPaise } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";
import { compactRupees, dayLabel } from "./format";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Sales (₹) or orders per day — one measure at a time, never a dual axis. */
export function SalesTrend({ daily }: { daily: DailyPoint[] }) {
  const [metric, setMetric] = useState<"sales" | "orders">("sales");
  const data = daily.map((d) => ({ ...d, label: dayLabel(d.day) }));
  const interval = data.length > 14 ? Math.ceil(data.length / 7) - 1 : 0;

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="trend-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="trend-title" className="font-display text-lg font-semibold">
            {metric === "sales" ? "Sales per day" : "Orders per day"}
          </h2>
          <p className="text-xs text-muted-foreground">{metric === "sales" ? "Food value of delivered orders" : "Orders placed, by day"}</p>
        </div>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as "sales" | "orders")}>
          <TabsList className="h-9">
            <TabsTrigger value="sales" className="text-xs">Sales</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">Orders</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="h-60 w-full sm:h-72" data-testid="chart-trend">
        <ResponsiveContainer width="100%" height="100%">
          {metric === "sales" ? (
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={interval} minTickGap={4} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactRupees(v)} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={({ active, payload, label }) => (
                  <ChartTooltip
                    active={active}
                    label={String(label ?? "")}
                    rows={payload?.length ? [{ name: "Sales", value: formatPaise(Number(payload[0]!.value)) }, { name: "Delivered", value: String((payload[0]!.payload as DailyPoint).delivered) }] : []}
                  />
                )}
              />
              <Bar dataKey="sales_paise" name="Sales" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={interval} minTickGap={4} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => (
                  <ChartTooltip active={active} label={String(label ?? "")} rows={payload?.length ? [{ name: "Orders", value: String(payload[0]!.value) }] : []} />
                )}
              />
              <Line type="monotone" dataKey="orders" name="Orders" stroke="var(--primary)" strokeWidth={2} dot={data.length <= 31 ? { r: 3, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
