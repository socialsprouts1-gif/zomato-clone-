"use client";

import { Map } from "@/components/maps/map";

export function InfoMap({ lat, lng, name, home }: { lat: number; lng: number; name: string; home?: { lat: number; lng: number } }) {
  return (
    <Map
      center={{ lat, lng }}
      zoom={15}
      fit={Boolean(home)}
      markers={[{ id: "r", lat, lng, kind: "restaurant", label: name }, ...(home ? [{ id: "h", ...home, kind: "home" as const, label: "You" }] : [])]}
      className="h-64 w-full"
    />
  );
}
