"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

/** Singleton Supabase client for Client Components (uses the anon key + user session cookie). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = requireSupabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
