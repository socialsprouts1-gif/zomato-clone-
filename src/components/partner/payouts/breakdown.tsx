import { formatPaise } from "@/lib/utils";

export type BreakdownValues = {
  orderCount: number;
  gross: number;
  commissionPct: number;
  commission: number;
  gstPct: number;
  gst: number;
  rescue: number;
  adjustments: number;
  net: number;
};

const signed = (paise: number, sign: "+" | "−" | "±") => (paise === 0 ? formatPaise(0) : `${sign === "±" ? (paise < 0 ? "−" : "+") : sign} ${formatPaise(Math.abs(paise))}`);

/** Order value − commission − GST on commission + Food Rescue ± adjustments = net payout. */
export function PayoutBreakdown({ v, netLabel = "Net payout" }: { v: BreakdownValues; netLabel?: string }) {
  const rows = [
    { id: "gross", label: "Order value", hint: `${v.orderCount} delivered order${v.orderCount === 1 ? "" : "s"} · items + packaging − your offer discounts`, value: formatPaise(v.gross) },
    { id: "commission", label: `Commission (${v.commissionPct}%)`, hint: "Thaali platform commission on order value", value: signed(v.commission, "−") },
    { id: "gst", label: `GST on commission (${v.gstPct}%)`, hint: "Charged on the commission, not on your sales", value: signed(v.gst, "−") },
    { id: "rescue", label: "Food Rescue earnings", hint: "Cancelled orders resold to nearby customers · no commission", value: signed(v.rescue, "+") },
    { id: "adjustments", label: "Adjustments", hint: "Refund recoveries or credits from Thaali support", value: signed(v.adjustments, "±") },
  ];
  return (
    <dl className="divide-y rounded-2xl border bg-card" data-testid="payout-breakdown">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <dt>
            <span className="text-sm font-medium">{r.label}</span>
            <span className="block text-xs text-muted-foreground">{r.hint}</span>
          </dt>
          <dd className="shrink-0 text-sm font-semibold tabular-nums" data-testid={`payout-${r.id}`}>{r.value}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 bg-secondary/50 px-4 py-3 rounded-b-2xl">
        <dt className="font-display font-semibold">{netLabel}</dt>
        <dd className="font-display text-lg font-bold tabular-nums" data-testid="payout-net">{formatPaise(v.net)}</dd>
      </div>
    </dl>
  );
}
