"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

/** Singleton Supabase client for Client Components (uses the anon key + user session cookie). */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!client) {
    const { url, anonKey } = requireSupabaseEnv();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
