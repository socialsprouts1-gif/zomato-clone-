import type { Funnel } from "@/lib/partner/reports";

const pct = (a: number, b: number) => (b > 0 && a <= b ? `${((a / b) * 100).toFixed(1)}%` : "–");

/** Menu views → add to cart → checkout → orders, with step-to-step conversion. */
export function FunnelCard({ funnel }: { funnel: Funnel }) {
  const steps = [
    { key: "menu_view", label: "Menu views", value: funnel.menu_view },
    { key: "add_to_cart", label: "Added to cart", value: funnel.add_to_cart },
    { key: "checkout_start", label: "Reached checkout", value: funnel.checkout_start },
    { key: "orders", label: "Orders placed", value: funnel.orders },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="funnel-title">
      <h2 id="funnel-title" className="font-display text-lg font-semibold">Conversion funnel</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Overall {pct(funnel.orders, funnel.menu_view)} of menu views became orders
      </p>
      {steps.some((s, i) => i > 0 && s.value > steps[i - 1]!.value) ? (
        <p className="mb-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          Some orders came in without a tracked cart or checkout visit (for example reorders), so a few step conversions aren&apos;t shown.
        </p>
      ) : null}
      <ol className="space-y-3" data-testid="funnel">
        {steps.map((s, i) => (
          <li key={s.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold" data-testid={`funnel-${s.key}`}>{s.value.toLocaleString("en-IN")}</span>
                {i > 0 && s.value <= steps[i - 1]!.value ? <span className="ml-2 text-xs text-muted-foreground">{pct(s.value, steps[i - 1]!.value)} of previous</span> : null}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(s.value > 0 ? 2 : 0, (s.value / max) * 100)}%`, opacity: 1 - i * 0.15 }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
