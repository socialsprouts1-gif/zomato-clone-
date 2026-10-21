import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;
export type Role = Enums<"user_role">;
export type SessionUser = { id: string; email: string | null; profile: Profile };

/** The signed-in user with their profile, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? null, profile };
});

export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.profile.is_blocked) redirect("/blocked");
  return user;
}

export async function requireRole(roles: Role[], next: string, loginPath = "/login"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`${loginPath}?next=${encodeURIComponent(next)}`);
  if (user.profile.is_blocked) redirect("/blocked");
  if (!roles.includes(user.profile.role)) redirect(`/forbidden?need=${roles.join(",")}&next=${encodeURIComponent(next)}`);
  return user;
}

/** Where each role lands after signing in. */
export function homeForRole(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "restaurant_owner":
    case "restaurant_staff":
      return "/partner";
    case "rider":
      return "/rider";
    default:
      return "/";
  }
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
