import { cn, formatPaise } from "@/lib/utils";

export type BillLines = {
  item_total_paise: number;
  delivery_fee_paise: number;
  platform_fee_paise: number;
  packaging_fee_paise: number;
  gst_paise: number;
  tip_paise: number;
  discount_paise: number;
  donation_paise: number;
  total_paise: number;
  wallet_used_paise?: number;
  payable_paise?: number;
  gold_savings_paise?: number;
  coupon_code?: string | null;
};

function Line({ label, value, muted, strong, green }: { label: React.ReactNode; value: string; muted?: boolean; strong?: boolean; green?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 text-sm", muted && "text-muted-foreground", strong && "text-base font-bold", green && "text-success")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Bill details as computed on the server. All amounts in paise. */
export function BillBreakdown({ bill, className }: { bill: BillLines; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Line label="Item total" value={formatPaise(bill.item_total_paise)} />
      <Line
        label="Delivery fee"
        value={bill.delivery_fee_paise === 0 ? "FREE" : formatPaise(bill.delivery_fee_paise)}
        green={bill.delivery_fee_paise === 0}
      />
      <Line label="Platform fee" value={formatPaise(bill.platform_fee_paise)} muted />
      {bill.packaging_fee_paise ? <Line label="Packaging charges" value={formatPaise(bill.packaging_fee_paise)} muted /> : null}
      <Line label="GST on food (5%)" value={formatPaise(bill.gst_paise)} muted />
      {bill.tip_paise ? <Line label="Rider tip" value={formatPaise(bill.tip_paise)} muted /> : null}
      {bill.donation_paise ? <Line label="Feeding India donation" value={formatPaise(bill.donation_paise)} muted /> : null}
      {bill.discount_paise ? (
        <Line label={`Discount${bill.coupon_code ? ` (${bill.coupon_code})` : ""}`} value={`− ${formatPaise(bill.discount_paise)}`} green />
      ) : null}
      <div className="my-2 border-t border-dashed" />
      <Line label="Grand total" value={formatPaise(bill.total_paise)} strong />
      {bill.wallet_used_paise ? (
        <>
          <Line label="Paid from wallet" value={`− ${formatPaise(bill.wallet_used_paise)}`} green />
          <Line label="Paid online / cash" value={formatPaise(bill.payable_paise ?? 0)} />
        </>
      ) : null}
      {bill.gold_savings_paise ? <p className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">You saved {formatPaise(bill.gold_savings_paise)} with Gold on this order</p> : null}
    </div>
  );
}
