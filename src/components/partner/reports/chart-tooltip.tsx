"use client";

/** Shared Recharts tooltip body, styled with theme tokens. */
export function ChartTooltip({ active, label, rows }: { active?: boolean; label?: string; rows: { name: string; value: string }[] }) {
  if (!active || !rows.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label ? <p className="mb-1 font-semibold">{label}</p> : null}
      {rows.map((r) => (
        <p key={r.name} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{r.name}</span>
          <span className="font-semibold tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}
