import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, homeForRole, safeNext } from "@/lib/auth/session";
import { syncPreferencesFromProfile } from "@/lib/preferences-actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Landing point for magic links and OAuth: exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");
  const supabase = await getSupabaseServerClient();

  let error: string | null = url.searchParams.get("error_description");
  if (!error && code) {
    const res = await supabase.auth.exchangeCodeForSession(code);
    error = res.error?.message ?? null;
  } else if (!error && tokenHash && type) {
    const res = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = res.error?.message ?? null;
  }
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, url.origin));
  }
  await syncPreferencesFromProfile();
  const user = await getSessionUser();
  return NextResponse.redirect(new URL(safeNext(next, user ? homeForRole(user.profile.role) : "/"), url.origin));
}
