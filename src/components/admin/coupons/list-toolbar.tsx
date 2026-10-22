"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { selectClass } from "./form-helpers";

/** Search box + optional status filter that write ?q=&status= (and reset ?page=). */
export function ListToolbar({
  placeholder,
  searchLabel,
  filters,
  filterLabel = "Status",
  children,
}: {
  placeholder: string;
  searchLabel: string;
  filters?: { value: string; label: string }[];
  filterLabel?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function push(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        role="search"
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: q.trim() });
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={searchLabel} className="pl-9" type="search" />
      </form>
      {filters ? (
        <select aria-label={filterLabel} className={cn(selectClass, "sm:w-44")} value={sp.get("status") ?? ""} onChange={(e) => push({ status: e.target.value })}>
          {filters.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      ) : null}
      {children}
    </div>
  );
}

/** Previous / next links that keep the other search params. */
export function Pager({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") s.set(k, v);
    if (p > 1) s.set("page", String(p));
    return `?${s}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pages} · {total.toLocaleString("en-IN")} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)}>
              <ChevronLeft /> Previous
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)}>
              Next <ChevronRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
