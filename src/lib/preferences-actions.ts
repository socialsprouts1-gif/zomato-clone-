"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { COOKIE } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const YEAR = 60 * 60 * 24 * 365;

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().min(1).max(60),
  line: z.string().max(200),
  addressId: z.string().uuid().optional(),
});

export async function setDeliveryLocation(input: z.input<typeof locationSchema>) {
  const loc = locationSchema.parse(input);
  const jar = await cookies();
  jar.set(COOKIE.location, JSON.stringify(loc), { path: "/", maxAge: YEAR, sameSite: "lax" });
  const user = await getSessionUser();
  if (user) {
    const supabase = await getSupabaseServerClient();
    await supabase.from("profiles").update({ last_lat: loc.lat, last_lng: loc.lng }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setMode(mode: "veg" | "healthy", on: boolean) {
  const jar = await cookies();
  jar.set(mode === "veg" ? COOKIE.veg : COOKIE.healthy, on ? "1" : "0", { path: "/", maxAge: YEAR, sameSite: "lax" });
  const user = await getSessionUser();
  if (user) {
    const supabase = await getSupabaseServerClient();
    await supabase.from("profiles").update(mode === "veg" ? { veg_mode: on } : { healthy_mode: on }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
  return { ok: true as const, on };
}

export async function setLanguage(locale: "en" | "hi") {
  const jar = await cookies();
  jar.set(COOKIE.lang, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const user = await getSessionUser();
  if (user) {
    const supabase = await getSupabaseServerClient();
    await supabase.from("profiles").update({ language: locale }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** After sign-in, copy the account's saved preferences into cookies. */
export async function syncPreferencesFromProfile() {
  const user = await getSessionUser();
  if (!user) return;
  const jar = await cookies();
  jar.set(COOKIE.veg, user.profile.veg_mode ? "1" : "0", { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set(COOKIE.healthy, user.profile.healthy_mode ? "1" : "0", { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set(COOKIE.lang, user.profile.language === "hi" ? "hi" : "en", { path: "/", maxAge: YEAR, sameSite: "lax" });
}
