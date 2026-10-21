/** Calendar-date helpers in Asia/Kolkata. Dates are "YYYY-MM-DD" strings; weeks run Monday–Sunday. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string | null | undefined): s is string {
  if (!s || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today's date in India. */
export function todayIst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export type Period = { start: string; end: string };

/** The Mon–Sun week containing `date`. */
export function weekOf(date: string): Period {
  const start = weekStart(date);
  return { start, end: addDays(start, 6) };
}

/** The most recent fully finished Mon–Sun week (India time). */
export function lastCompleteWeek(now = new Date()): Period {
  return weekOf(addDays(weekStart(todayIst(now)), -7));
}

/** "12 – 18 Oct 2026" */
export function formatPeriod(p: Period): string {
  const fmt = (s: string, opts: Intl.DateTimeFormatOptions) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
  const sameMonth = p.start.slice(0, 7) === p.end.slice(0, 7);
  return `${fmt(p.start, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${fmt(p.end, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function formatDay(s: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
}
