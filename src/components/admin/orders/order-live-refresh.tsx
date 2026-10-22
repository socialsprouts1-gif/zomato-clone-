"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";

/** Re-renders the order detail when the order or its timeline changes (realtime, polling fallback). */
export function OrderLiveRefresh({ orderId, active }: { orderId: string; active: boolean }) {
  const router = useRouter();
  const last = useRef(0);
  const status = useRealtime(
    `admin-order:${orderId}`,
    [
      { table: "orders", filter: `id=eq.${orderId}` },
      { table: "order_events", filter: `order_id=eq.${orderId}`, event: "INSERT" },
    ],
    () => {
      if (Date.now() - last.current < 1500) return;
      last.current = Date.now();
      router.refresh();
    },
    active ? 5000 : 30000,
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", status === "live" ? "bg-success" : "bg-muted-foreground")} aria-hidden />
      {status === "live" ? "Live" : "Auto-refreshing"}
    </span>
  );
}
