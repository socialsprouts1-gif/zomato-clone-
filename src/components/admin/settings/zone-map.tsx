"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet needs `window`, so the zone preview loads on the client only. */
export const ZoneMap = dynamic(() => import("./zone-map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="size-full min-h-48 rounded-2xl" />,
});
export type { ZoneCircle } from "./zone-map-inner";
