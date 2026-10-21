import { History, Star } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { statusMeta } from "@/lib/orders/status";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Trip history" };

export default async function RiderHistoryPage() {
  const user = await requireRole(["rider", "admin"], "/rider/history");
  const supabase = await getSupabaseServerClient();
  const [{ data: trips }, { data: ratings }] = await Promise.all([
    supabase.from("orders").select("id, order_number, status, delivered_at, created_at, distance_km, payment_method, payable_paise, restaurants(name), delivery_address").eq("rider_id", user.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("reviews").select("delivery_rating, delivery_tags, created_at, customer_name").eq("rider_id", user.id).not("delivery_rating", "is", null).order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <>
      <PageHeader title="Trip history" description="Every delivery you've handled" />
      {ratings?.length ? (
        <Card className="mb-4 p-4">
          <p className="mb-2 text-sm font-semibold">Recent ratings from customers</p>
          <ul className="flex gap-2 overflow-x-auto">
            {ratings.map((r) => (
              <li key={r.created_at} className="shrink-0 rounded-xl bg-muted px-3 py-2 text-xs">
                <span className="flex items-center gap-1 font-bold">
                  {r.delivery_rating} <Star className="size-3 fill-amber-400 text-amber-400" />
                </span>
                {r.delivery_tags.join(", ")}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {!trips?.length ? (
        <EmptyState icon={History} title="No trips yet" description="Your completed deliveries will be listed here." />
      ) : (
        <Card className="divide-y">
          {trips.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">
                  #{t.order_number} · {t.restaurants?.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {(t.delivery_address as { line1?: string }).line1} · {Number(t.distance_km ?? 0).toFixed(1)} km
                </p>
                <p className="text-xs text-muted-foreground">{new Date(t.delivered_at ?? t.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={statusMeta[t.status].tone === "done" ? "success" : statusMeta[t.status].tone === "bad" ? "destructive" : "secondary"}>{statusMeta[t.status].label}</Badge>
                {t.payment_method === "cod" ? <span className="text-xs text-muted-foreground">Cash {formatPaise(t.payable_paise)}</span> : null}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
