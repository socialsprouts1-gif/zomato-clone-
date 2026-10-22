import { NextResponse, type NextRequest } from "next/server";
import { DEMO_PASSWORD, demoPersonas } from "@/config/demo";
import { safeNext } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { COOKIE } from "@/lib/preferences";
import { syncPreferencesFromProfile } from "@/lib/preferences-actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Koregaon Park, Pune: where the demo customer and most demo restaurants are. */
const DEMO_LOCATION = { lat: 18.5385, lng: 73.8925, label: "Home", line: "Koregaon Park, Pune" };

/**
 * Demo mode only: signs in a demo persona and continues to `next`, so every app opens without a login screen.
 * GET /demo/enter?as=owner-1&next=/partner
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"), "/");
  if (!isDemoMode) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));

  const persona = demoPersonas.find((p) => p.id === url.searchParams.get("as")) ?? demoPersonas[0]!;
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email: persona.email, password: DEMO_PASSWORD });
  if (error) {
    // Don't loop back into the app: show the login page with the reason (usually: demo data not loaded).
    const msg = `Demo sign-in failed (${error.message}). Load the demo data with pnpm local:reset.`;
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));
  }
  await syncPreferencesFromProfile();

  const res = NextResponse.redirect(new URL(next, url.origin));
  if (!request.cookies.has(COOKIE.location)) {
    res.cookies.set(COOKIE.location, JSON.stringify(DEMO_LOCATION), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return res;
}
