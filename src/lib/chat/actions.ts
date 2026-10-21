"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

export type Thread = "customer_rider" | "customer_restaurant" | "rider_restaurant";

const RIDER_REPLIES = [
  "Got it! On my way 🛵",
  "I'm at the restaurant, food will be ready soon.",
  "Reaching in a few minutes.",
  "Sure, I'll take care of that.",
];
const RESTAURANT_REPLIES = ["Noted! We'll make sure of it.", "Thanks for letting us know 🙏", "Your food is being prepared fresh."];

export async function sendChatMessage(orderId: string, thread: Thread, body: string, as: "customer" | "rider" | "restaurant") {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in" };
  const text = z.string().trim().min(1).max(1000).parse(body);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("chat_messages").insert({ order_id: orderId, thread, sender_id: user.id, sender_role: as, sender_name: user.profile.name, body: text });
  if (error) return { ok: false as const, error: "You can't message on this order" };

  // Demo: simulated riders and unattended restaurants reply so a solo presenter can show chat.
  if (isDemoMode && as === "customer") {
    const db = getSupabaseAdminClient();
    const { data: o } = await db.from("orders").select("rider_id, restaurant_id, riders!orders_rider_id_fkey(is_simulated, name), restaurants(name)").eq("id", orderId).single();
    if (thread === "customer_rider" && o?.riders?.is_simulated) {
      await db.from("chat_messages").insert({ order_id: orderId, thread, sender_id: o.rider_id, sender_role: "rider", sender_name: o.riders.name, body: RIDER_REPLIES[Math.floor(Math.random() * RIDER_REPLIES.length)]! });
    }
    if (thread === "customer_restaurant" && o) {
      await db.from("chat_messages").insert({ order_id: orderId, thread, sender_id: null, sender_role: "restaurant", sender_name: o.restaurants?.name ?? "Restaurant", body: RESTAURANT_REPLIES[Math.floor(Math.random() * RESTAURANT_REPLIES.length)]! });
    }
  }
  return { ok: true as const };
}

export async function loadChat(orderId: string, thread: Thread) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("chat_messages").select("id, sender_id, sender_role, sender_name, body, created_at").eq("order_id", orderId).eq("thread", thread).order("created_at").limit(200);
  return data ?? [];
}
