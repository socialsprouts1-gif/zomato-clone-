"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeafletMapProps } from "./leaflet-map";

/** Leaflet touches `window`, so the map is loaded on the client only. */
export const Map = dynamic<LeafletMapProps>(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full min-h-48 rounded-2xl" />,
});

export type { LatLng, MapMarker } from "./leaflet-map";
