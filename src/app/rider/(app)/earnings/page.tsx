import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Earnings" };

export default async function RiderEarningsPage() {
  const user = await requireRole(["rider", "admin"], "/rider/earnings");
  const supabase = await getSupabaseServerClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [{ data: rows }, { data: s }] = await Promise.all([
    supabase.from("rider_earnings").select("*, orders(order_number, restaurants(name))").eq("rider_id", user.id).gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false }),
    supabase.from("platform_settings").select("rider_daily_target_orders, rider_daily_target_bonus_paise").single(),
  ]);
  const list = rows ?? [];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const sum = (from: Date) => list.filter((r) => new Date(r.created_at) >= from).reduce((t, r) => t + r.total_paise, 0);
  const todayTrips = list.filter((r) => r.kind === "delivery" && new Date(r.created_at) >= dayStart).length;
  const target = s?.rider_daily_target_orders ?? 10;

  return (
    <>
      <PageHeader title="Earnings" description="Base pay + distance + tips + incentives" />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          ["Today", sum(dayStart)],
          ["This week", sum(weekStart)],
          ["This month", sum(monthStart)],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="font-display text-lg font-bold">{formatPaise(v as number)}</p>
          </Card>
        ))}
      </div>
      <Card className="mb-4 space-y-2 p-4">
        <p className="text-sm font-semibold">
          Daily target: {todayTrips}/{target} orders → {formatPaise(s?.rider_daily_target_bonus_paise ?? 15000)} bonus
        </p>
        <Progress value={Math.min(100, (todayTrips / target) * 100)} aria-label="Daily incentive progress" />
      </Card>
      {list.length === 0 ? (
        <EmptyState icon={Wallet} title="No earnings yet this month" description="Complete deliveries to see your per-order breakdown." />
      ) : (
        <Card className="divide-y">
          {list.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold">{r.kind === "delivery" ? `Order #${r.orders?.order_number} · ${r.orders?.restaurants?.name ?? ""}` : r.note}</p>
                <p className="text-xs text-muted-foreground">
                  Base {formatPaise(r.base_pay_paise)} · Distance {formatPaise(r.distance_pay_paise)} · Tip {formatPaise(r.tip_paise)}
                  {r.incentive_paise ? ` · Incentive ${formatPaise(r.incentive_paise)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              <span className="font-bold">{formatPaise(r.total_paise)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
