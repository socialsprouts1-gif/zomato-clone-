"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { notify } from "@/lib/notifications";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { getOutletRole, OUTLET_COOKIE, type OutletRole } from "./context";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

class ActionError extends Error {}

const LEVEL: Record<OutletRole, number> = { order_taker: 1, manager: 2, admin: 3, owner: 3 };
const NEED_MESSAGE = { team: "You don't work at this restaurant", manager: "Only the owner or a manager can change this", owner: "Only the restaurant owner can manage staff" };

/** Checks the caller's role at the outlet. team = any member; manager = owner/manager/admin; owner = owner/admin. */
async function guard(restaurantId: string, need: "team" | "manager" | "owner"): Promise<{ user: SessionUser; role: OutletRole }> {
  const user = await getSessionUser();
  if (!user) throw new ActionError("Please sign in again");
  const rid = z.string().uuid().parse(restaurantId);
  const role = await getOutletRole(user.id, user.profile.role, rid);
  const min = need === "team" ? 1 : need === "manager" ? 2 : 3;
  if (!role || LEVEL[role] < min) throw new ActionError(NEED_MESSAGE[need]);
  return { user, role };
}

async function run<T>(fn: () => Promise<T>, paths: string[] = ["/partner"]): Promise<Result<T>> {
  try {
    const data = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form" };
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

function check(error: { message: string } | null) {
  if (error) throw new ActionError(error.message);
}

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtSlot = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};

// ───────────────────────── Bookings ─────────────────────────

async function loadBooking(bookingId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("table_bookings")
    .select("id, user_id, restaurant_id, status, booking_code, booking_date, time_slot, guests, restaurants(name, slug)")
    .eq("id", z.string().uuid().parse(bookingId))
    .maybeSingle();
  if (!data) throw new ActionError("Booking not found");
  return data;
}

export async function confirmBooking(bookingId: string, tableId: string | null) {
  return run(async () => {
    const b = await loadBooking(bookingId);
    await guard(b.restaurant_id, "team");
    if (b.status !== "pending") throw new ActionError("This booking was already handled");
    const supabase = await getSupabaseServerClient();
    let tableLabel: string | null = null;
    if (tableId) {
      const { data: t } = await supabase.from("restaurant_tables").select("id, label").eq("id", z.string().uuid().parse(tableId)).eq("restaurant_id", b.restaurant_id).maybeSingle();
      if (!t) throw new ActionError("Pick one of your tables");
      tableLabel = t.label;
    }
    const { error } = await supabase.from("table_bookings").update({ status: "confirmed", table_id: tableId, decline_reason: null }).eq("id", b.id).eq("status", "pending");
    check(error);
    await notify(b.user_id, {
      title: `Table booked at ${b.restaurants?.name ?? "the restaurant"}`,
      body: `${fmtDate(b.booking_date)}, ${fmtSlot(b.time_slot)} · ${b.guests} ${b.guests === 1 ? "guest" : "guests"}${tableLabel ? ` · Table ${tableLabel}` : ""} · Code ${b.booking_code}`,
      link: b.restaurants ? `/restaurant/${b.restaurants.slug}` : undefined,
      type: "info",
    });
  }, ["/partner/bookings"]);
}

export async function declineBooking(bookingId: string, reason: string) {
  return run(async () => {
    const why = z.string().trim().min(2, "Tell the guest why").max(140).parse(reason);
    const b = await loadBooking(bookingId);
    await guard(b.restaurant_id, "team");
    if (b.status !== "pending") throw new ActionError("This booking was already handled");
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("table_bookings").update({ status: "declined", decline_reason: why }).eq("id", b.id).eq("status", "pending");
    check(error);
    await notify(b.user_id, {
      title: `Booking at ${b.restaurants?.name ?? "the restaurant"} declined`,
      body: `${fmtDate(b.booking_date)}, ${fmtSlot(b.time_slot)}: ${why}`,
      link: b.restaurants ? `/restaurant/${b.restaurants.slug}` : undefined,
      type: "info",
    });
  }, ["/partner/bookings"]);
}

export async function completeBooking(bookingId: string) {
  return run(async () => {
    const b = await loadBooking(bookingId);
    await guard(b.restaurant_id, "team");
    if (b.status !== "confirmed") throw new ActionError("Only confirmed bookings can be marked as visited");
    const supabase = await getSupabaseServerClient();
    check((await supabase.from("table_bookings").update({ status: "completed" }).eq("id", b.id)).error);
  }, ["/partner/bookings"]);
}

// ───────────────────────── Tables ─────────────────────────

const tableSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "Give the table a name, e.g. T5").max(12, "Keep the table name short"),
  section: z.string().trim().min(1, "Enter a section, e.g. Main").max(30),
  seats: z.coerce.number().int().min(1, "At least 1 seat").max(20, "At most 20 seats"),
  is_active: z.boolean(),
});
export type TableInput = z.input<typeof tableSchema>;

export async function saveTable(restaurantId: string, input: TableInput) {
  return run(async () => {
    await guard(restaurantId, "manager");
    const v = tableSchema.parse(input);
    const supabase = await getSupabaseServerClient();
    const row = { label: v.label.toUpperCase(), section: v.section, seats: v.seats, is_active: v.is_active };
    const { error } = v.id
      ? await supabase.from("restaurant_tables").update(row).eq("id", v.id).eq("restaurant_id", restaurantId)
      : await supabase.from("restaurant_tables").insert({ ...row, restaurant_id: restaurantId });
    if (error?.code === "23505") throw new ActionError(`A table named ${row.label} already exists`);
    check(error);
  }, ["/partner/bookings"]);
}

export async function deleteTable(restaurantId: string, tableId: string) {
  return run(async () => {
    await guard(restaurantId, "manager");
    const supabase = await getSupabaseServerClient();
    check((await supabase.from("restaurant_tables").delete().eq("id", z.string().uuid().parse(tableId)).eq("restaurant_id", restaurantId)).error);
  }, ["/partner/bookings"]);
}

// ───────────────────────── Outlet settings ─────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export async function addHoliday(restaurantId: string, date: string) {
  return run(async () => {
    await guard(restaurantId, "manager");
    const d = isoDate.parse(date);
    const supabase = await getSupabaseServerClient();
    const { data: r } = await supabase.from("restaurants").select("holidays").eq("id", restaurantId).single();
    const holidays = [...new Set([...(r?.holidays ?? []), d])].sort();
    check((await supabase.from("restaurants").update({ holidays }).eq("id", restaurantId)).error);
  }, ["/partner/settings", "/"]);
}

export async function removeHoliday(restaurantId: string, date: string) {
  return run(async () => {
    await guard(restaurantId, "manager");
    const d = isoDate.parse(date);
    const supabase = await getSupabaseServerClient();
    const { data: r } = await supabase.from("restaurants").select("holidays").eq("id", restaurantId).single();
    check((await supabase.from("restaurants").update({ holidays: (r?.holidays ?? []).filter((h) => h !== d) }).eq("id", restaurantId)).error);
  }, ["/partner/settings", "/"]);
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time");
const range = z.tuple([hhmm, hhmm]).refine(([o, c]) => o !== c, "Opening and closing time can't be the same");
const hoursSchema = z.object(Object.fromEntries(DAYS.map((d) => [d, z.array(range).max(2, "At most two shifts a day")])) as Record<(typeof DAYS)[number], z.ZodArray<typeof range>>);
export type HoursInput = Record<(typeof DAYS)[number], [string, string][]>;

export async function saveOpeningHours(restaurantId: string, hours: HoursInput) {
  return run(async () => {
    await guard(restaurantId, "manager");
    const v = hoursSchema.parse(hours);
    const supabase = await getSupabaseServerClient();
    check((await supabase.from("restaurants").update({ opening_hours: v }).eq("id", restaurantId)).error);
  }, ["/partner/settings", "/"]);
}

const kitchenSchema = z.object({
  avg_prep_minutes: z.coerce.number().int().min(5, "Prep time must be 5–90 minutes").max(90, "Prep time must be 5–90 minutes"),
  packaging_rupees: z.coerce.number().min(0, "Packaging charge can't be negative").max(200, "Packaging charge can be at most ₹200"),
});

export async function saveKitchenSettings(restaurantId: string, input: z.input<typeof kitchenSchema>) {
  return run(async () => {
    await guard(restaurantId, "manager");
    const v = kitchenSchema.parse(input);
    const supabase = await getSupabaseServerClient();
    check((await supabase.from("restaurants").update({ avg_prep_minutes: v.avg_prep_minutes, packaging_charge_paise: Math.round(v.packaging_rupees * 100) }).eq("id", restaurantId)).error);
  }, ["/partner/settings", "/partner"]);
}

const profileSchema = z.object({
  phone: z.string().trim().regex(/^\+?[\d ]{10,15}$/, "Enter a valid phone number"),
  description: z.string().trim().max(300, "Keep it under 300 characters"),
  dining_enabled: z.boolean(),
});

export async function saveOutletProfile(restaurantId: string, input: z.input<typeof profileSchema>) {
  return run(async () => {
    await guard(restaurantId, "manager");
    const v = profileSchema.parse(input);
    const supabase = await getSupabaseServerClient();
    check((await supabase.from("restaurants").update({ phone: v.phone.replace(/\s/g, ""), description: v.description || null, dining_enabled: v.dining_enabled }).eq("id", restaurantId)).error);
  }, ["/partner/settings", "/"]);
}

// ───────────────────────── Staff ─────────────────────────

const staffRole = z.enum(["manager", "order_taker"]);

export async function inviteStaff(restaurantId: string, email: string, role: string) {
  return run(async () => {
    const { user } = await guard(restaurantId, "owner");
    const mail = z.string().trim().toLowerCase().email("Enter a valid email").parse(email);
    const r = staffRole.parse(role);
    if (mail === user.email?.toLowerCase()) throw new ActionError("You already own this outlet");
    const db = getSupabaseAdminClient();
    const [{ data: profile }, { data: outlet }] = await Promise.all([
      db.from("profiles").select("id, role").ilike("email", mail).maybeSingle(),
      db.from("restaurants").select("name, owner_id").eq("id", restaurantId).single(),
    ]);
    if (profile?.id === outlet?.owner_id) throw new ActionError("That's the outlet owner");
    if (profile?.role === "rider") throw new ActionError("This email belongs to a delivery partner account. Use a different email.");
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("restaurant_staff")
      .upsert({ restaurant_id: restaurantId, email: mail, role: r, status: profile ? "active" : "invited", user_id: profile?.id ?? null }, { onConflict: "restaurant_id,email" });
    check(error);
    if (profile) {
      // Existing account: give it partner access straight away (role changes need the service role).
      if (profile.role === "customer") await db.from("profiles").update({ role: "restaurant_staff" }).eq("id", profile.id);
      await notify(profile.id, { title: `You've joined ${outlet?.name ?? "a restaurant"} on Thaali Partner`, body: `Role: ${r === "manager" ? "Manager" : "Order taker"}`, link: "/partner", type: "partner" });
    }
    return { status: profile ? ("active" as const) : ("invited" as const) };
  }, ["/partner/settings"]);
}

async function loadStaff(staffId: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("restaurant_staff").select("id, restaurant_id, user_id, status").eq("id", z.string().uuid().parse(staffId)).maybeSingle();
  if (!data) throw new ActionError("Staff member not found");
  return data;
}

export async function changeStaffRole(staffId: string, role: string) {
  return run(async () => {
    const s = await loadStaff(staffId);
    await guard(s.restaurant_id, "owner");
    const supabase = await getSupabaseServerClient();
    check((await supabase.from("restaurant_staff").update({ role: staffRole.parse(role) }).eq("id", s.id)).error);
  }, ["/partner/settings"]);
}

export async function removeStaff(staffId: string) {
  return run(async () => {
    const s = await loadStaff(staffId);
    await guard(s.restaurant_id, "owner");
    const supabase = await getSupabaseServerClient();
    check((await supabase.from("restaurant_staff").update({ status: "removed" }).eq("id", s.id)).error);
    if (s.user_id) {
      // No other outlet left: back to a customer account.
      const db = getSupabaseAdminClient();
      const [{ count }, { data: p }] = await Promise.all([
        db.from("restaurant_staff").select("id", { count: "exact", head: true }).eq("user_id", s.user_id).eq("status", "active"),
        db.from("profiles").select("role").eq("id", s.user_id).single(),
      ]);
      if (!count && p?.role === "restaurant_staff") await db.from("profiles").update({ role: "customer" }).eq("id", s.user_id);
    }
  }, ["/partner/settings"]);
}

// ───────────────────────── Onboarding ─────────────────────────

const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Enter the restaurant name").max(60),
  cuisines: z.array(z.string().trim().min(2).max(24)).min(1, "Add at least one cuisine").max(6, "Up to 6 cuisines"),
  phone: z.string().trim().regex(/^\+?\d{10,13}$/, "Enter a valid phone number"),
  description: z.string().trim().max(300).optional(),
  cost_for_two_rupees: z.coerce.number().int().min(100, "Cost for two is at least ₹100").max(10000),
  is_pure_veg: z.boolean(),
  locality: z.string().trim().min(2, "Enter the locality").max(60),
  address: z.string().trim().min(8, "Enter the full address").max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  fssai: z.string().trim().regex(/^\d{14}$/, "FSSAI licence is 14 digits"),
  gst_number: z.string().trim().toUpperCase().regex(/^(\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d])?$/, "Invalid GSTIN, e.g. 27AAPFU0939F1ZV").optional(),
  pan_number: z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN, e.g. ABCDE1234F"),
  bank_account_name: z.string().trim().min(2, "Name on the account").max(60),
  bank_account_number: z.string().trim().regex(/^\d{9,18}$/, "9–18 digit account number"),
  bank_ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC, e.g. SBIN0001234"),
  owner_name: z.string().trim().min(2, "Enter the owner's name").max(60),
  owner_phone: z.string().trim().regex(/^\+?\d{10,13}$/, "Enter a valid phone number"),
  owner_email: z.string().trim().email("Enter a valid email"),
});
export type OnboardingInput = z.input<typeof onboardingSchema>;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "restaurant";

/** Partner onboarding: creates a pending restaurant (+ private legal/bank details) owned by the caller. */
export async function submitOnboarding(input: OnboardingInput) {
  return run(async () => {
    const user = await getSessionUser();
    if (!user) throw new ActionError("Please sign in first");
    if (user.profile.role === "rider" || user.profile.role === "restaurant_staff") {
      throw new ActionError(user.profile.role === "rider" ? "Delivery partner accounts can't register a restaurant. Sign in with another account." : "Staff accounts can't register a restaurant. Ask the owner, or sign in with another account.");
    }
    const v = onboardingSchema.parse(input);
    const db = getSupabaseAdminClient();
    // Slugs are unique across all restaurants (including pending ones the caller can't see).
    const base = slugify(v.name);
    let slug = base;
    for (const candidate of [base, `${base}-${slugify(v.locality)}`, `${base}-${Math.random().toString(36).slice(2, 6)}`]) {
      const { data } = await db.from("restaurants").select("id").eq("slug", candidate).maybeSingle();
      slug = candidate;
      if (!data) break;
    }
    const supabase = await getSupabaseServerClient();
    const { data: created, error } = await supabase
      .from("restaurants")
      .insert({
        owner_id: user.id,
        name: v.name,
        slug,
        description: v.description || null,
        cuisines: v.cuisines,
        locality: v.locality,
        address: v.address,
        lat: v.lat,
        lng: v.lng,
        phone: v.phone,
        cost_for_two_paise: v.cost_for_two_rupees * 100,
        is_pure_veg: v.is_pure_veg,
        fssai: v.fssai,
      })
      .select("id, slug")
      .single();
    if (error || !created) throw new ActionError(error?.message ?? "Couldn't create the restaurant");
    const { error: privErr } = await supabase.from("restaurant_private").insert({
      restaurant_id: created.id,
      gst_number: v.gst_number || null,
      pan_number: v.pan_number,
      bank_account_name: v.bank_account_name,
      bank_account_number_masked: `XXXXXX${v.bank_account_number.slice(-4)}`,
      bank_ifsc: v.bank_ifsc,
      owner_name: v.owner_name,
      owner_phone: v.owner_phone,
      owner_email: v.owner_email,
    });
    check(privErr);
    if (user.profile.role === "customer") await db.from("profiles").update({ role: "restaurant_owner" }).eq("id", user.id);
    const jar = await cookies();
    jar.set(OUTLET_COOKIE, created.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
    for (const a of admins ?? []) await notify(a.id, { title: "New restaurant application", body: `${v.name} · ${v.locality}`, link: "/admin/restaurants", type: "info" });
    return created;
  }, ["/partner", "/partner/onboarding"]);
}

const mediaSchema = z.object({
  cover_image_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  documents: z.partialRecord(z.enum(["fssai_licence", "gst_certificate", "cancelled_cheque"]), z.string().url()).optional(),
});

/** Attaches photos/documents uploaded (to restaurant-media/<id>/…) after the restaurant was created. */
export async function attachOnboardingMedia(restaurantId: string, input: z.input<typeof mediaSchema>) {
  return run(async () => {
    await guard(restaurantId, "owner");
    const v = mediaSchema.parse(input);
    const supabase = await getSupabaseServerClient();
    const patch: { cover_image_url?: string; logo_url?: string } = {};
    if (v.cover_image_url) patch.cover_image_url = v.cover_image_url;
    if (v.logo_url) patch.logo_url = v.logo_url;
    if (Object.keys(patch).length) check((await supabase.from("restaurants").update(patch).eq("id", restaurantId)).error);
    if (v.documents && Object.keys(v.documents).length) check((await supabase.from("restaurant_private").update({ documents: v.documents }).eq("restaurant_id", restaurantId)).error);
  }, ["/partner"]);
}
