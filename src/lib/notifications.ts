import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type Notice = { title: string; body?: string; link?: string; type?: "order" | "offer" | "info" | "support" | "partner" | "rider" };

/** In-app notification (also shown as a browser notification by the client when allowed). */
export async function notify(userId: string | null | undefined, n: Notice) {
  if (!userId) return;
  await getSupabaseAdminClient().from("notifications").insert({ user_id: userId, title: n.title, body: n.body ?? null, link: n.link ?? null, type: n.type ?? "info" });
}

/** Notify the owner and active staff of a restaurant. */
export async function notifyRestaurantTeam(restaurantId: string, n: Notice) {
  const db = getSupabaseAdminClient();
  const [{ data: r }, { data: staff }] = await Promise.all([
    db.from("restaurants").select("owner_id").eq("id", restaurantId).single(),
    db.from("restaurant_staff").select("user_id").eq("restaurant_id", restaurantId).eq("status", "active"),
  ]);
  const ids = new Set([r?.owner_id, ...(staff ?? []).map((s) => s.user_id)].filter((x): x is string => Boolean(x)));
  if (!ids.size) return;
  await db.from("notifications").insert([...ids].map((user_id) => ({ user_id, title: n.title, body: n.body ?? null, link: n.link ?? null, type: n.type ?? "partner" })));
}
