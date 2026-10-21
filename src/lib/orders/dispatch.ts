import "server-only";

import type { Tables } from "@/lib/supabase/database.types";

type Order = Tables<"orders">;

/** Rider dispatch hooks. Filled in with nearest-rider assignment in Phase 6. */
export async function onOrderAccepted(o: Order) {
  void o;
}

export async function onDelivered(o: Order) {
  void o;
}
