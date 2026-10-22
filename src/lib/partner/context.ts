import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const OUTLET_COOKIE = "thaali_outlet";

export type Outlet = {
  id: string;
  name: string;
  slug: string;
  locality: string;
  status: string;
  is_online: boolean;
  busy_until: string | null;
  auto_accept: boolean;
  avg_prep_minutes: number;
};

/** The signed-in partner's outlets and the one currently selected (cookie, else first). */
export const getPartnerContext = cache(async (next = "/partner") => {
  const user = await requireRole(["restaurant_owner", "restaurant_staff", "admin"], next);
  const supabase = await getSupabaseServerClient();
  const { data: ids } = await supabase.rpc("my_restaurant_ids");
  const idList = ids ?? [];
  let outlets: Outlet[] = [];
  if (idList.length) {
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, slug, locality, status, is_online, busy_until, auto_accept, avg_prep_minutes")
      .in("id", idList)
      .order("name");
    outlets = data ?? [];
  }
  const jar = await cookies();
  const wanted = jar.get(OUTLET_COOKIE)?.value;
  let current = outlets.find((o) => o.id === wanted) ?? null;
  if (!current && outlets.length > 1) {
    // No outlet chosen yet: open the one with the most recent order.
    const { data: latest } = await supabase.from("orders").select("restaurant_id").in("restaurant_id", outlets.map((o) => o.id)).order("created_at", { ascending: false }).limit(1).maybeSingle();
    current = outlets.find((o) => o.id === latest?.restaurant_id) ?? null;
  }
  current ??= outlets[0] ?? null;
  return { user, outlets, current };
});

export type OutletRole = "owner" | "manager" | "order_taker" | "admin";

/**
 * The caller's role at an outlet: owner (restaurants.owner_id), active staff role, or admin.
 * Owners manage staff; owners and managers edit settings; order takers handle orders and bookings only.
 */
export const getOutletRole = cache(async (userId: string, platformRole: string, restaurantId: string): Promise<OutletRole | null> => {
  const supabase = await getSupabaseServerClient();
  const [{ data: r }, { data: staff }] = await Promise.all([
    supabase.from("restaurants").select("owner_id").eq("id", restaurantId).maybeSingle(),
    supabase.from("restaurant_staff").select("role").eq("restaurant_id", restaurantId).eq("user_id", userId).eq("status", "active").maybeSingle(),
  ]);
  if (r?.owner_id === userId) return "owner";
  if (staff?.role === "manager" || staff?.role === "order_taker") return staff.role;
  return platformRole === "admin" ? "admin" : null;
});
