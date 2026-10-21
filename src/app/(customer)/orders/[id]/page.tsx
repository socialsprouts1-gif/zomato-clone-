import { CheckCircle2, Circle, MapPin, Receipt, Store, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BillBreakdown } from "@/components/orders/bill-breakdown";
import { PlacedOverlay } from "@/components/orders/placed-overlay";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { statusMeta } from "@/lib/orders/status";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details" };

const methodLabel: Record<string, string> = { razorpay: "Paid online", cod: "Cash on delivery", wallet: "Thaali wallet" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/orders/${id}`);
  const supabase = await getSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, restaurants(name, locality, slug), order_items(*), order_events(to_status, created_at, note)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const meta = statusMeta[order.status];
  const address = order.delivery_address as { label?: string; line1?: string };
  const events = [...order.order_events].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Suspense>
        <PlacedOverlay scheduled={order.status === "SCHEDULED"} />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Order #{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <Badge variant={meta.tone === "bad" ? "destructive" : meta.tone === "done" ? "success" : "default"}>{meta.label}</Badge>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <Store className="size-5 text-primary" />
          <div>
            <CardTitle>
              <Link href={`/restaurant/${order.restaurants?.slug}`} className="hover:underline">
                {order.restaurants?.name}
              </Link>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{order.restaurants?.locality}</p>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {order.order_items.map((it) => {
              const addons = (it.addons as { name: string }[] | null) ?? [];
              return (
                <li key={it.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex gap-2">
                    <span aria-label={it.is_veg ? "Veg" : "Non-veg"} className={`mt-1 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border-2 ${it.is_veg ? "border-veg" : "border-nonveg"}`}>
                      <span className={`size-1.5 rounded-full ${it.is_veg ? "bg-veg" : "bg-nonveg"}`} />
                    </span>
                    <div>
                      <p className="font-medium">
                        {it.quantity} × {it.name}
                      </p>
                      {it.variant_name || addons.length ? (
                        <p className="text-xs text-muted-foreground">{[it.variant_name, ...addons.map((a) => a.name)].filter(Boolean).join(", ")}</p>
                      ) : null}
                      {it.added_by_name ? <p className="text-xs text-muted-foreground">Added by {it.added_by_name}</p> : null}
                    </div>
                  </div>
                  <span className="text-sm tabular-nums">{formatPaise(it.total_paise)}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Receipt className="size-5 text-primary" />
            <CardTitle className="text-base">Bill details</CardTitle>
          </CardHeader>
          <CardContent>
            <BillBreakdown bill={order} />
            <p className="mt-3 text-xs text-muted-foreground">
              {methodLabel[order.payment_method]}
              {order.payment_method_detail ? ` · ${order.payment_method_detail.toUpperCase()}` : ""}
              {order.refund_paise ? ` · ${formatPaise(order.refund_paise)} refunded to ${order.refund_to === "wallet" ? "wallet" : "original payment method"}` : ""}
            </p>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-2">
              <MapPin className="size-5 text-primary" />
              <CardTitle className="text-base">Delivered to</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{address.label}</p>
              <p>{address.line1}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {events.map((e, i) => {
                  const bad = statusMeta[e.to_status].tone === "bad";
                  const Icon = bad ? XCircle : i === events.length - 1 ? CheckCircle2 : Circle;
                  return (
                    <li key={`${e.to_status}-${e.created_at}`} className="flex gap-3 text-sm">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${bad ? "text-destructive" : "text-success"}`} />
                      <div>
                        <p className="font-medium">{statusMeta[e.to_status].label}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                          {e.note ? ` · ${e.note}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
