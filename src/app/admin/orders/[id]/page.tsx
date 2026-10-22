import { ArrowLeft, Bike, CreditCard, LifeBuoy, MapPin, MessageSquare, Store, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions, type OrderActionState } from "@/components/admin/orders/order-actions";
import { OrderLiveRefresh } from "@/components/admin/orders/order-live-refresh";
import { OrderStatusBadge, adminStatusLabel } from "@/components/admin/orders/status-badge";
import { VegDot } from "@/components/catalog/badges";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/session";
import { amountPaid } from "@/lib/orders/side-effects";
import { canTransition } from "@/lib/orders/state-machine";
import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { cn, formatPaise } from "@/lib/utils";
import { PAYMENT_METHODS, loadOrderDetail } from "../queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await loadOrderDetail(id).catch(() => null);
  return { title: d ? `Order #${d.order.order_number}` : "Order" };
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" });
const ROLE_LABEL: Record<string, string> = { customer: "Customer", restaurant: "Restaurant", rider: "Rider", admin: "Support", system: "System" };
const PAYMENT_STATUS: Record<string, string> = {
  pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded", partially_refunded: "Partly refunded", cod_pending: "Cash due on delivery", cod_collected: "Cash collected",
};
const REASSIGNABLE: OrderStatus[] = ["ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED"];

function Panel({ title, icon: Icon, children, className }: { title: string; icon: typeof User; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)} aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
        <Icon className="size-4 text-primary" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4 py-1 text-sm", strong && "border-t pt-2 font-semibold")}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["admin"], `/admin/orders/${id}`);
  const detail = await loadOrderDetail(id);
  if (!detail) notFound();
  const { order: o, customer, events, walletTxns, chats, tickets } = detail;
  const addr = o.delivery_address as { label?: string; line1?: string; landmark?: string | null; area?: string | null };
  const instr = o.delivery_instructions as { avoidCalling?: boolean; leaveAtDoor?: boolean; directions?: string };
  const paid = amountPaid(o);
  const onlinePaid = o.payment_method === "razorpay" && Boolean(o.razorpay_payment_id) && o.payment_status === "paid";
  const live = ACTIVE_STATUSES.includes(o.status);
  const actions: OrderActionState = {
    orderId: o.id,
    orderNumber: o.order_number,
    canCancel: canTransition(o.status, "CANCELLED", "admin"),
    canReassign: REASSIGNABLE.includes(o.status),
    hasRider: Boolean(o.rider_id),
    refundablePaise: o.refunded_at ? 0 : paid,
    canRefund: !live && o.status !== "SCHEDULED" && !o.refunded_at && paid > 0,
    onlinePaid,
    alreadyRefunded: Boolean(o.refunded_at),
  };
  const bill: [string, number][] = [
    ["Item total", o.item_total_paise],
    ["Delivery fee", o.delivery_fee_paise],
    ["Platform fee", o.platform_fee_paise],
    ["Packaging", o.packaging_fee_paise],
    ["GST", o.gst_paise],
    ["Tip", o.tip_paise],
    ["Donation", o.donation_paise],
  ];

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All orders
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold tracking-tight">
            Order #{o.order_number}
            <OrderStatusBadge status={o.status} className="text-sm" />
            {o.is_demo ? <Badge variant="secondary">Demo</Badge> : null}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Placed {fmt(o.created_at)}</span>
            <span>Source: {o.source.replaceAll("_", " ")}</span>
            <OrderLiveRefresh orderId={o.id} active={live} />
          </p>
          {o.cancel_reason ? <p className="mt-1 text-sm text-destructive">Reason: {o.cancel_reason}</p> : null}
          {o.reject_reason ? <p className="mt-1 text-sm text-destructive">Rejected: {o.reject_reason}</p> : null}
        </div>
        <OrderActions s={actions} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="mb-3 font-display text-base font-semibold">Timeline</h2>
            <ol className="relative space-y-4 border-l pl-5" data-testid="order-timeline">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className={cn("absolute top-1 -left-[26.5px] size-3 rounded-full border-2 border-card", e.from_status === e.to_status ? "bg-muted-foreground" : "bg-primary")} aria-hidden />
                  <p className="text-sm font-medium">
                    {e.from_status === e.to_status ? e.note : adminStatusLabel(e.to_status)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(e.created_at)} · {ROLE_LABEL[e.actor_role] ?? e.actor_role}
                    {e.actor_name ? ` (${e.actor_name})` : ""}
                    {e.from_status !== e.to_status && e.note ? ` · ${e.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="items-title">
            <h2 id="items-title" className="mb-3 font-display text-base font-semibold">Items</h2>
            <ul className="divide-y">
              {o.order_items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-start gap-2">
                    <VegDot veg={it.is_veg} />
                    <span className="min-w-0">
                      <span className="font-medium">{it.quantity} × {it.name}</span>
                      {it.variant_name ? <span className="block text-xs text-muted-foreground">{it.variant_name}</span> : null}
                      {Array.isArray(it.addons) && it.addons.length ? (
                        <span className="block text-xs text-muted-foreground">+ {(it.addons as { name: string }[]).map((a) => a.name).join(", ")}</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatPaise(it.total_paise)}</span>
                </li>
              ))}
            </ul>
            {o.cooking_instructions ? <p className="mt-2 rounded-xl bg-muted/50 p-2.5 text-xs">Cooking note: {o.cooking_instructions}</p> : null}
            <dl className="mt-3 border-t pt-2">
              {bill.filter(([, v]) => v > 0).map(([l, v]) => (
                <Row key={l} label={l} value={formatPaise(v)} />
              ))}
              {o.discount_paise > 0 ? <Row label={`Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`} value={`− ${formatPaise(o.discount_paise)}`} /> : null}
              <Row label="Total" value={formatPaise(o.total_paise)} strong />
              {o.wallet_used_paise > 0 ? <Row label="Paid from wallet" value={formatPaise(o.wallet_used_paise)} /> : null}
              <Row label="Payable" value={formatPaise(o.payable_paise)} />
            </dl>
          </section>

          {chats.length ? (
            <Panel title="Chat" icon={MessageSquare}>
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {chats.map((c) => (
                  <li key={c.id} className="rounded-xl bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      {c.sender_name ?? ROLE_LABEL[c.sender_role] ?? c.sender_role} · {c.thread.replaceAll("_", " ")} · {fmt(c.created_at)}
                    </p>
                    <p>{c.body}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Payment" icon={CreditCard}>
            <dl data-testid="payment-panel">
              <Row label="Method" value={`${PAYMENT_METHODS[o.payment_method]}${o.payment_method_detail ? ` · ${o.payment_method_detail.toUpperCase()}` : ""}`} />
              <Row label="Status" value={PAYMENT_STATUS[o.payment_status] ?? o.payment_status} />
              <Row label="Paid so far" value={formatPaise(paid)} />
              {o.razorpay_payment_id ? <Row label="Payment ID" value={<code className="text-xs">{o.razorpay_payment_id}</code>} /> : null}
              {o.refunded_at ? (
                <Row label="Refund" value={o.refund_paise > 0 ? `${formatPaise(o.refund_paise)} to ${o.refund_to === "original" ? "original method" : "wallet"}` : "Nothing to refund"} />
              ) : null}
            </dl>
            {walletTxns.length ? (
              <div className="mt-3 border-t pt-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Wallet movements</p>
                <ul className="space-y-1 text-xs">
                  {walletTxns.map((t) => (
                    <li key={t.id} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{t.description}</span>
                      <span className={cn("tabular-nums", t.amount_paise > 0 ? "text-success" : "")}>{t.amount_paise > 0 ? "+" : "−"}{formatPaise(Math.abs(t.amount_paise))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel title="Customer" icon={User}>
            <p className="text-sm font-medium">{o.customer_name ?? customer?.name ?? "Customer"}</p>
            <p className="text-sm text-muted-foreground">{o.customer_phone ?? customer?.phone ?? "No phone"}</p>
            {customer?.email ? <p className="text-sm text-muted-foreground">{customer.email}</p> : null}
          </Panel>

          <Panel title="Delivery address" icon={MapPin}>
            <p className="text-sm font-medium">{addr.label ?? "Address"}</p>
            <p className="text-sm text-muted-foreground">{[addr.line1, addr.landmark, addr.area].filter(Boolean).join(", ")}</p>
            {o.distance_km ? <p className="mt-1 text-xs text-muted-foreground">{Number(o.distance_km).toFixed(1)} km from the restaurant</p> : null}
            {instr.directions || instr.leaveAtDoor || instr.avoidCalling ? (
              <p className="mt-2 rounded-xl bg-muted/50 p-2.5 text-xs">
                {[instr.leaveAtDoor ? "Leave at door" : null, instr.avoidCalling ? "Avoid calling" : null, instr.directions].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </Panel>

          <Panel title="Restaurant" icon={Store}>
            <p className="text-sm font-medium">{o.restaurants?.name}</p>
            <p className="text-sm text-muted-foreground">{[o.restaurants?.address, o.restaurants?.locality].filter(Boolean).join(", ")}</p>
            {o.restaurants?.phone ? <p className="text-sm text-muted-foreground">{o.restaurants.phone}</p> : null}
          </Panel>

          <Panel title="Rider" icon={Bike}>
            {o.riders ? (
              <div data-testid="rider-panel">
                <p className="text-sm font-medium">{o.riders.name} {o.riders.is_simulated ? <Badge variant="secondary" className="ml-1">Simulated</Badge> : null}</p>
                <p className="text-sm text-muted-foreground capitalize">{o.riders.vehicle_type}{o.riders.vehicle_number ? ` · ${o.riders.vehicle_number}` : ""}</p>
                {o.riders.phone ? <p className="text-sm text-muted-foreground">{o.riders.phone}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="rider-panel">No rider assigned yet.</p>
            )}
          </Panel>

          {tickets.length ? (
            <Panel title="Support tickets" icon={LifeBuoy}>
              <ul className="space-y-1 text-sm">
                {tickets.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3">
                    <Link href="/admin/support" className="truncate hover:text-primary hover:underline">{t.subject}</Link>
                    <span className="text-xs text-muted-foreground capitalize">{t.status.replaceAll("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
