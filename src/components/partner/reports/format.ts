import { formatPaise } from "@/lib/utils";

/** Compact rupee label for chart axes: ₹950, ₹12.5k, ₹1.2L. */
export function compactRupees(paise: number): string {
  const r = paise / 100;
  if (r >= 100_000) return `₹${trim(r / 100_000)}L`;
  if (r >= 1000) return `₹${trim(r / 1000)}k`;
  return `₹${Math.round(r)}`;
}
const trim = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

export const rupeeLabel = formatPaise;

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** 0 → "12 am", 13 → "1 pm" */
export function hourLabel(h: number, short = false): string {
  const suffix = h < 12 ? "am" : "pm";
  const n = h % 12 === 0 ? 12 : h % 12;
  return short ? `${n}${suffix[0]}` : `${n} ${suffix}`;
}

export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
}
