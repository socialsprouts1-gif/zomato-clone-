import { ChevronLeft, ChevronRight, ListChecks, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/admin/orders/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth/session";
import { cn, formatPaise } from "@/lib/utils";
import { PAGE_SIZE, PAYMENT_METHODS, STATUS_GROUP_LABEL, parseFilters, searchOrders, type OrderFilters } from "./queries";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const selectClass = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30";

function hrefFor(f: OrderFilters, page: number) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.method) p.set("method", f.method);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return `/admin/orders${s ? `?${s}` : ""}`;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["admin"], "/admin/orders");
  const f = parseFilters(await searchParams);
  const { rows, total } = await searchOrders(f);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(f.q || f.status || f.method || f.from || f.to);

  return (
    <>
      <PageHeader title="Orders" description="Search, inspect, reassign, cancel and refund orders across the platform." />
      <form method="get" action="/admin/orders" className="mb-5 grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]" role="search">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="q" className="mb-1.5 text-xs">Search</Label>
          <Input id="q" name="q" defaultValue={f.q} placeholder="Order number, customer, phone or restaurant" />
        </div>
        <div>
          <Label htmlFor="status" className="mb-1.5 text-xs">Status</Label>
          <select id="status" name="status" defaultValue={f.status} className={selectClass}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_GROUP_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="method" className="mb-1.5 text-xs">Payment</Label>
          <select id="method" name="method" defaultValue={f.method} className={selectClass}>
            <option value="">All methods</option>
            {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="from" className="mb-1.5 text-xs">From</Label>
          <Input id="from" name="from" type="date" defaultValue={f.from} />
        </div>
        <div>
          <Label htmlFor="to" className="mb-1.5 text-xs">To</Label>
          <Input id="to" name="to" type="date" defaultValue={f.to} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" className="flex-1 gap-2 lg:flex-none">
            <Search className="size-4" aria-hidden /> Search
          </Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href="/admin/orders">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title={filtered ? "No matching orders" : "No orders yet"} description={filtered ? "Try another search or clear the filters." : "Orders across the platform appear here."} />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground" data-testid="orders-count">
            {total.toLocaleString("en-IN")} {total === 1 ? "order" : "orders"}
          </p>
          {/* Phones: cards */}
          <ul className="space-y-2 md:hidden" aria-label="Orders">
            {rows.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="block rounded-2xl border bg-card p-4 shadow-sm hover:border-primary" aria-label={`Order #${o.order_number}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">#{o.order_number} {o.is_demo ? <Badge variant="secondary" className="ml-1">Demo</Badge> : null}</p>
                      <p className="truncate text-sm text-muted-foreground">{o.restaurants?.name ?? "Restaurant"}</p>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{o.customer_name ?? "Customer"} · {fmtDate(o.created_at)}</span>
                    <span className="font-semibold text-foreground">{formatPaise(o.total_paise)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Restaurant</th>
                  <th scope="col" className="px-4 py-3 font-medium">Rider</th>
                  <th scope="col" className="px-4 py-3 font-medium">Payment</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/admin/orders/${o.id}`} className="hover:text-primary hover:underline">#{o.order_number}</Link>
                      {o.is_demo ? <Badge variant="secondary" className="ml-2">Demo</Badge> : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="block">{o.customer_name ?? "Customer"}</span>
                      <span className="block text-xs text-muted-foreground">{o.customer_phone ?? ""}</span>
                    </td>
                    <td className="px-4 py-3">{o.restaurants?.name ?? ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.riders?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {PAYMENT_METHODS[o.payment_method]}
                      {o.refunded_at && o.refund_paise > 0 ? <span className="block text-xs text-success">Refunded {formatPaise(o.refund_paise)}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPaise(o.total_paise)}</td>
                    <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Pagination">
            <p className="text-xs text-muted-foreground">Page {f.page} of {pages}</p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className={cn(f.page <= 1 && "pointer-events-none opacity-50")} aria-disabled={f.page <= 1}>
                <Link href={hrefFor(f, f.page - 1)} tabIndex={f.page <= 1 ? -1 : undefined}><ChevronLeft className="size-4" aria-hidden /> Previous</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className={cn(f.page >= pages && "pointer-events-none opacity-50")} aria-disabled={f.page >= pages}>
                <Link href={hrefFor(f, f.page + 1)} tabIndex={f.page >= pages ? -1 : undefined}>Next <ChevronRight className="size-4" aria-hidden /></Link>
              </Button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
