import { z } from "zod";

/** A numeric text input ("" allowed) → number | null. Forms keep raw strings; schemas parse them. */
export const amount = (label: string) =>
  z
    .string()
    .trim()
    .refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), `Enter ${label} as a number`)
    .transform((s) => (s === "" ? null : Number(s)));

/** Required rupee amount within a range. */
export const rupees = (label: string, min: number, max: number) =>
  amount(label.toLowerCase()).refine((n) => n !== null && n >= min && n <= max, `${label} must be ₹${min.toLocaleString("en-IN")}–₹${max.toLocaleString("en-IN")}`);

/** Optional whole number within a range ("" → null). */
export const optionalInt = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((s) => s === "" || (/^\d+$/.test(s) && Number(s) >= min && Number(s) <= max), `${label} must be a whole number from ${min} to ${max.toLocaleString("en-IN")}`)
    .transform((s) => (s === "" ? null : Number(s)));

export const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const toPaise = (rupeesValue: number | null) => (rupeesValue === null ? null : Math.round(rupeesValue * 100));
export const paiseToRupees = (p: number | null | undefined) => (p === null || p === undefined ? "" : String(p / 100));

/** YYYY-MM-DD of a timestamp in IST, for date inputs. */
export function istDate(ts: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ts));
}

/** Start / end of an IST calendar day as ISO timestamps. */
export const istDayStart = (d: string) => new Date(`${d}T00:00:00+05:30`).toISOString();
export const istDayEnd = (d: string) => new Date(`${d}T23:59:59.999+05:30`).toISOString();

export function shortDate(ts: string | Date) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function firstIssue(e: z.ZodError) {
  return e.issues[0]?.message ?? "Please check the form";
}

/** Parses with a schema and throws a readable Error (adminAction turns it into { ok: false, error }). */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new Error(firstIssue(r.error));
  return r.data;
}

export const selectClass =
  "flex h-11 w-full rounded-xl border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 md:text-sm";
