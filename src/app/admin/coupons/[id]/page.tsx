import { ArrowLeft, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponDetailActions } from "@/components/admin/coupons/coupon-detail-actions";
import { StatusBadge } from "@/components/admin/coupons/coupons-manager";
import { shortDate } from "@/components/admin/coupons/form-helpers";
import { couponRules, couponSummary } from "@/components/admin/coupons/schema";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assertAdmin } from "@/lib/admin/guard";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Coupon" };

export default async function AdminCouponPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getSupabaseAdminClient();
  const [{ data: c }, { data: restaurants }, { data: redemptions, count }] = await Promise.all([
    db.from("coupons").select("*").eq("id", id).maybeSingle(),
    db.from("restaurants").select("id, name").order("name"),
    db
      .from("coupon_redemptions")
      .select("id, discount_paise, created_at, orders(order_number, total_paise), profiles(name, email)", { count: "exact" })
      .eq("coupon_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (!c) notFound();
  const restaurantName = c.restaurant_id ? (restaurants ?? []).find((r) => r.id === c.restaurant_id)?.name : null;
  const given = (redemptions ?? []).reduce((s, r) => s + r.discount_paise, 0);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/coupons">
          <ArrowLeft /> All coupons
        </Link>
      </Button>
      <PageHeader title={c.code} description={c.title} actions={<CouponDetailActions coupon={c} restaurants={restaurants ?? []} />} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5 lg:col-span-1">
          <div className="flex items-center gap-2">
            <StatusBadge c={c} />
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Discount</dt>
              <dd className="font-semibold">{couponSummary(c)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rules</dt>
              <dd>{couponRules(c, restaurantName).join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Valid</dt>
              <dd>
                {shortDate(c.valid_from)}
                {c.valid_until ? ` – ${shortDate(c.valid_until)}` : " onwards"}
              </dd>
            </div>
            {c.description ? (
              <div>
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd>{c.description}</dd>
              </div>
            ) : null}
          </dl>
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-2 text-center">
            <div>
              <dt className="text-[11px] text-muted-foreground">Orders</dt>
              <dd className="font-semibold">{(count ?? 0).toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Uses counted</dt>
              <dd className="font-semibold">{c.used_count.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Given (latest)</dt>
              <dd className="font-semibold">{formatPaise(given)}</dd>
            </div>
          </dl>
        </Card>
        <section className="lg:col-span-2" aria-labelledby="redemptions-title">
          <h2 id="redemptions-title" className="font-display mb-3 text-lg font-semibold">
            Recent redemptions
          </h2>
          {(redemptions ?? []).length === 0 ? (
            <EmptyState icon={Receipt} title="Not used yet" description="Orders that use this coupon will appear here." />
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {(redemptions ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.profiles?.name ?? r.profiles?.email ?? "Customer"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.orders ? `Order #${r.orders.order_number} · ${formatPaise(r.orders.total_paise)} · ` : ""}
                      {shortDate(r.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-success">−{formatPaise(r.discount_paise)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
