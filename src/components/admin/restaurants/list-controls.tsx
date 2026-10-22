import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ListParams = Record<string, string | undefined>;

/** Builds a list URL keeping the current filters, with `patch` applied (undefined/empty removes a key). */
export function listHref(base: string, params: ListParams, patch: ListParams = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Plain GET form so search works without JavaScript; hidden fields keep the other filters. */
export function ListSearch({ base, params, placeholder, label }: { base: string; params: ListParams; placeholder: string; label: string }) {
  const keep = Object.entries(params).filter(([k, v]) => v && k !== "q" && k !== "page");
  return (
    <form action={base} method="get" role="search" className="flex w-full gap-2 sm:max-w-md">
      {keep.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input name="q" type="search" defaultValue={params.q ?? ""} placeholder={placeholder} aria-label={label} className="pl-9" />
      </div>
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  );
}

export function FilterTabs({
  base,
  params,
  paramKey,
  options,
  label,
}: {
  base: string;
  params: ListParams;
  paramKey: string;
  options: { value: string; label: string; count?: number }[];
  label: string;
}) {
  const current = params[paramKey] ?? options[0]?.value ?? "";
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-2xl bg-muted p-1">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <li key={o.value}>
              <Link
                href={listHref(base, params, { [paramKey]: o.value === options[0]?.value ? undefined : o.value, page: undefined })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-muted-foreground transition focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-card text-foreground shadow-sm",
                )}
              >
                {o.label}
                {o.count !== undefined ? <span className="rounded-full bg-background px-1.5 text-xs tabular-nums">{o.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Pagination({ base, params, page, pageSize, total }: { base: string; params: ListParams; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground tabular-nums">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={listHref(base, params, { page: page === 2 ? undefined : String(page - 1) })}>
              <ChevronLeft aria-hidden /> Previous
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={listHref(base, params, { page: String(page + 1) })}>
              Next <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}

export function parsePage(raw: string | undefined) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/** Escapes a user search term for a PostgREST `ilike` inside an `or=(...)` filter. */
export function ilikeTerm(q: string) {
  return `%${q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ").trim()}%`;
}

export const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "success" | "destructive" }> = {
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "success" },
  suspended: { label: "Suspended", variant: "destructive" },
  rejected: { label: "Rejected", variant: "outline" },
};

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
