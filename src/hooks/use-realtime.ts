"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Spec = { table: string; filter?: string; event?: "INSERT" | "UPDATE" | "DELETE" | "*" };

/**
 * Subscribe to Postgres changes (RLS-filtered by Supabase Realtime).
 * While the channel isn't connected, `onChange` is also called every `pollMs` as a fallback.
 */
export function useRealtime(
  key: string | null,
  specs: Spec[],
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>> | null) => void,
  pollMs = 15000,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const specKey = JSON.stringify(specs);

  useEffect(() => {
    if (!key) return;
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      // Join with the user's token so Realtime applies their RLS (the session loads asynchronously from cookies).
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      let ch = supabase.channel(`${key}:${Math.random().toString(36).slice(2, 8)}`);
      for (const s of JSON.parse(specKey) as Spec[]) {
        ch = ch.on(
          "postgres_changes" as never,
          { event: s.event ?? "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => cb.current(payload),
        );
      }
      channel = ch.subscribe((st) => setStatus(st === "SUBSCRIBED" ? "live" : st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED" ? "offline" : "connecting"));
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, specKey]);

  useEffect(() => {
    if (!key || status === "live") return;
    const t = setInterval(() => cb.current(null), pollMs);
    return () => clearInterval(t);
  }, [key, status, pollMs]);

  return status;
}
