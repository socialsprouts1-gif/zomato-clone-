"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";

export type ZoneCircle = { id: string; lat: number; lng: number; radiusKm: number; active: boolean; highlight?: boolean };

function Fit({ zones }: { zones: ZoneCircle[] }) {
  const map = useMap();
  const key = zones.map((z) => `${z.lat.toFixed(3)},${z.lng.toFixed(3)},${z.radiusKm}`).join("|");
  useEffect(() => {
    if (!zones.length) return;
    const bounds = zones.reduce<L.LatLngBounds | null>((b, z) => {
      const zb = L.latLng(z.lat, z.lng).toBounds(z.radiusKm * 2000);
      return b ? b.extend(zb) : zb;
    }, null);
    if (bounds) map.fitBounds(bounds, { padding: [16, 16] });
    // Refit only when the zones change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function ZoneMapInner({ zones, className }: { zones: ZoneCircle[]; className?: string }) {
  const first = zones[0] ?? { lat: 18.52, lng: 73.86 };
  return (
    <div className={className}>
      <MapContainer center={[first.lat, first.lng]} zoom={10} className="size-full rounded-2xl" scrollWheelZoom={false} attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {zones.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={z.radiusKm * 1000}
            pathOptions={{ color: z.active ? "#F97316" : "#94a3b8", weight: z.highlight ? 3 : 2, fillOpacity: z.highlight ? 0.2 : 0.1, dashArray: z.active ? undefined : "6 6" }}
          />
        ))}
        {zones.map((z) => (
          <CircleMarker key={`${z.id}-c`} center={[z.lat, z.lng]} radius={4} pathOptions={{ color: "#fff", fillColor: "#F97316", fillOpacity: 1, weight: 2 }} />
        ))}
        <Fit zones={zones} />
      </MapContainer>
    </div>
  );
}
