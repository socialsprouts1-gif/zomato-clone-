"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getUnreadCount() {
  const user = await getSessionUser();
  if (!user) return 0;
  const supabase = await getSupabaseServerClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return count ?? 0;
}
