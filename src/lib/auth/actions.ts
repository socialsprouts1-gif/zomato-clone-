"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_OTP, demoPersonas, DEMO_PASSWORD } from "@/config/demo";
import { getSessionUser, homeForRole, safeNext } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { syncPreferencesFromProfile } from "@/lib/preferences-actions";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };



const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[^\d]/g, ""))
  .refine((d) => d.length === 10 || (d.length === 12 && d.startsWith("91")), "Enter a valid 10-digit mobile number")
  .transform((d) => `+91${d.slice(-10)}`);

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Step 1 of phone login. In demo mode the code is always 123456 and no SMS is sent. */
export async function requestPhoneOtp(rawPhone: string): Promise<ActionResult<{ demoCode?: string }>> {
  const parsed = phoneSchema.safeParse(rawPhone);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid number" };
  if (isDemoMode) return { ok: true, data: { demoCode: DEMO_OTP } };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Step 2 of phone login: verify the code and start a session. */
export async function verifyPhoneOtp(rawPhone: string, code: string, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = phoneSchema.safeParse(rawPhone);
  if (!parsed.success) return { ok: false, error: "Invalid number" };
  const phone = parsed.data;
  const supabase = await getSupabaseServerClient();

  if (isDemoMode) {
    if (code.trim() !== DEMO_OTP) return { ok: false, error: "Incorrect code. In demo mode the code is 123456." };
    const admin = getSupabaseAdminClient();
    // Existing account with this phone? Otherwise create one keyed by a phone-only email.
    const { data: existing } = await admin.from("profiles").select("id").eq("phone", phone).limit(1).maybeSingle();
    let email: string | undefined;
    if (existing) {
      const { data } = await admin.auth.admin.getUserById(existing.id);
      email = data.user?.email ?? undefined;
    }
    if (!email) {
      email = `${phone.replace("+", "")}@phone.thaali.app`;
      const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { phone, name: "" } });
      if (created.error && !/already/i.test(created.error.message)) return { ok: false, error: created.error.message };
    }
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) return { ok: false, error: link.error.message };
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: "sms" });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, data: { redirectTo: await afterSignIn(next) } };
}

export async function sendMagicLink(rawEmail: string, next?: string): Promise<ActionResult> {
  const email = z.string().email("Enter a valid email").safeParse(rawEmail.trim().toLowerCase());
  if (!email.success) return { ok: false, error: email.error.issues[0]?.message ?? "Invalid email" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: `We've emailed a sign-in link to ${email.data}.` };
}

export async function signInWithGoogle(next?: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { ok: false, error: error?.message ?? "Google sign-in is not configured for this project." };
  return { ok: true, data: { url: data.url } };
}

export async function signInWithPassword(rawEmail: string, password: string, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: rawEmail.trim().toLowerCase(), password });
  if (error) return { ok: false, error: error.message === "Invalid login credentials" ? "Wrong email or password." : error.message };
  return { ok: true, data: { redirectTo: await afterSignIn(next) } };
}

/** Demo Switcher: sign in as a seeded persona. Only available in demo mode. */
export async function demoSignIn(personaId: string): Promise<ActionResult<{ redirectTo: string; name: string }>> {
  if (!isDemoMode) return { ok: false, error: "Demo mode is off." };
  const persona = demoPersonas.find((p) => p.id === personaId);
  if (!persona) return { ok: false, error: "Unknown persona" };
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email: persona.email, password: DEMO_PASSWORD });
  if (error) return { ok: false, error: `${error.message}. Has the database been seeded? (pnpm seed)` };
  await syncPreferencesFromProfile();
  return { ok: true, data: { redirectTo: persona.href, name: persona.label } };
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

async function afterSignIn(next?: string) {
  await syncPreferencesFromProfile();
  const user = await getSessionUser();
  return safeNext(next, user ? homeForRole(user.profile.role) : "/");
}
