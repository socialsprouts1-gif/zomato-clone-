"use client";

import { useEffect } from "react";
import { pushRecent, type RecentItem } from "@/components/catalog/recently-viewed";
import { recordRestaurantView } from "@/lib/catalog/actions";

export function ViewTracker({ restaurantId, recent }: { restaurantId: string; recent: RecentItem }) {
  useEffect(() => {
    pushRecent(recent);
    void recordRestaurantView(restaurantId);
    // record once per page view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);
  return null;
}
