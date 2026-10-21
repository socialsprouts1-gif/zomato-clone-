import type { PayoutOrderLine, RescueLine } from "@/lib/payouts";
import { formatPaise } from "@/lib/utils";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function PayoutOrdersTable({ orders, rescue }: { orders: PayoutOrderLine[]; rescue: RescueLine[] }) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm" aria-labelledby="payout-orders-title">
      <h2 id="payout-orders-title" className="px-4 pt-4 font-display text-lg font-semibold">Orders included</h2>
      <p className="px-4 pb-3 text-xs text-muted-foreground">Delivered between Monday 00:00 and Sunday 23:59 (India time).</p>
      {orders.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">No delivered orders in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm" data-testid="payout-orders">
            <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Order</th>
                <th scope="col" className="px-2 py-2 font-medium">Delivered</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Items</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Packaging</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Your offer</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Order value</th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {orders.map((o) => (
                <tr key={o.order_id}>
                  <td className="px-4 py-2 font-medium">#{o.order_number}</td>
                  <td className="px-2 py-2 text-muted-foreground">{when(o.delivered_at)}</td>
                  <td className="px-2 py-2 text-right">{formatPaise(o.item_total_paise)}</td>
                  <td className="px-2 py-2 text-right">{formatPaise(o.packaging_paise)}</td>
                  <td className="px-2 py-2 text-right">{o.restaurant_discount_paise ? `− ${formatPaise(o.restaurant_discount_paise)}` : "–"}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatPaise(o.order_value_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rescue.length ? (
        <div className="border-t px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold">Food Rescue sales</h3>
          <ul className="space-y-1 text-sm">
            {rescue.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="truncate">{r.items_summary} <span className="text-xs text-muted-foreground">· {when(r.claimed_at)}</span></span>
                <span className="font-semibold tabular-nums">{formatPaise(r.rescue_price_paise)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
