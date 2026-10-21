import { ChevronRight, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { statusMeta } from "@/lib/orders/status";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Your orders" };

const toneClass = {
  live: "bg-primary text-primary-foreground",
  done: "bg-success text-white",
  bad: "bg-destructive/10 text-destructive",
  wait: "bg-secondary text-secondary-foreground",
};

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const supabase = await getSupabaseServerClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, status, total_paise, created_at, restaurants(name, locality, cover_image_url), order_items(name, quantity)")
    .eq("customer_id", user.id)
    .eq("hidden_by_customer", false)
    .neq("status", "PENDING_PAYMENT")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Your orders" description="Track live orders and see past ones." />
      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="When you place an order, you can track it live from here."
          action={
            <Button asChild>
              <Link href="/">Find something to eat</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {orders.map((o) => {
            const meta = statusMeta[o.status];
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="flex gap-4 p-4 transition hover:border-primary/50">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      {o.restaurants?.cover_image_url ? (
                        <Image src={o.restaurants.cover_image_url} alt="" fill sizes="64px" className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{o.restaurants?.name}</p>
                          <p className="text-xs text-muted-foreground">{o.restaurants?.locality}</p>
                        </div>
                        <Badge className={cn("shrink-0", toneClass[meta.tone])}>{meta.label}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                        {o.order_items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                      </p>
                      <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          #{o.order_number} · {new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          {formatPaise(o.total_paise)} <ChevronRight className="size-4" />
                        </span>
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
