import { Ban, IndianRupee, ReceiptText, ShoppingBag, XCircle } from "lucide-react";
import type { ReportKpis } from "@/lib/partner/reports";
import { formatPaise } from "@/lib/utils";

export function KpiCards({ kpis }: { kpis: ReportKpis }) {
  const cards = [
    { id: "gross", label: "Gross sales", value: formatPaise(kpis.gross_paise), sub: "Food value of delivered orders", icon: IndianRupee },
    { id: "orders", label: "Orders", value: kpis.placed.toLocaleString("en-IN"), sub: `${kpis.delivered.toLocaleString("en-IN")} delivered`, icon: ShoppingBag },
    { id: "aov", label: "Avg order value", value: formatPaise(kpis.aov_paise), sub: "Per delivered order", icon: ReceiptText },
    { id: "rejected", label: "Rejected", value: kpis.rejected.toLocaleString("en-IN"), sub: `${kpis.rejection_rate.toFixed(1)}% rejection rate`, icon: Ban },
    { id: "cancelled", label: "Cancelled", value: kpis.cancelled.toLocaleString("en-IN"), sub: "By customer or Thaali", icon: XCircle },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Key figures">
      {cards.map((c) => (
        <li key={c.id} className="rounded-2xl border bg-card p-4 shadow-sm last:col-span-2 lg:last:col-span-1" data-testid={`kpi-${c.id}`}>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <c.icon className="size-3.5" aria-hidden /> {c.label}
          </p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl" data-testid={`kpi-${c.id}-value`}>{c.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`kpi-${c.id}-sub`}>{c.sub}</p>
        </li>
      ))}
    </ul>
  );
}
