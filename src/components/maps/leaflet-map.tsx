"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { cn } from "@/lib/utils";

export type LatLng = { lat: number; lng: number };
export type MapMarker = LatLng & {
  id: string;
  kind: "home" | "restaurant" | "rider" | "dot";
  label?: string;
  rotation?: number;
};

const ICONS: Record<MapMarker["kind"], { emoji: string; bg: string }> = {
  home: { emoji: "🏠", bg: "#1F2937" },
  restaurant: { emoji: "🍽️", bg: "#F97316" },
  rider: { emoji: "🛵", bg: "#15803d" },
  dot: { emoji: "", bg: "#F97316" },
};

function iconFor(m: MapMarker) {
  const { emoji, bg } = ICONS[m.kind];
  if (m.kind === "dot") {
    return L.divIcon({
      className: "thaali-marker",
      html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${bg};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }
  return L.divIcon({
    className: cn("thaali-marker", m.kind === "rider" && "thaali-rider-marker"),
    html: `<span role="img" aria-label="${m.label ?? m.kind}" style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9999px;background:${bg};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:18px;${m.rotation !== undefined && m.kind === "rider" ? "" : ""}">${emoji}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function FitBounds({ points, padding = 48 }: { points: LatLng[]; padding?: number }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], Math.max(map.getZoom(), 15));
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [padding, padding] });
    // Only refit when the set of points meaningfully changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    const k = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    if (k === last.current) return;
    last.current = k;
    const c = map.getCenter();
    if (Math.abs(c.lat - center.lat) > 1e-5 || Math.abs(c.lng - center.lng) > 1e-5) map.setView([center.lat, center.lng]);
  }, [center, map]);
  return null;
}

function CenterWatcher({ onChange }: { onChange: (c: LatLng) => void }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      onChange({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
    },
  });
  return null;
}

export type LeafletMapProps = {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  route?: LatLng[];
  fit?: boolean;
  /** Picker mode: a fixed pin in the middle; reports the map centre when panning stops. */
  onCenterChange?: (c: LatLng) => void;
  className?: string;
  interactive?: boolean;
};

export default function LeafletMap({ center, zoom = 14, markers = [], route, fit = false, onCenterChange, className, interactive = true }: LeafletMapProps) {
  const fitPoints = useMemo(() => (fit ? markers.map(({ lat, lng }) => ({ lat, lng })) : []), [fit, markers]);
  return (
    <div className={cn("relative isolate overflow-hidden rounded-2xl border bg-[#eef0e8] dark:bg-[#1d2420]", className)}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="size-full"
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        attributionControl
        style={{ background: "transparent" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route && route.length > 1 ? (
          <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#F97316", weight: 4, dashArray: "8 8" }} />
        ) : null}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={iconFor(m)} keyboard={false}>
            {m.label ? <Tooltip direction="top" offset={[0, -18]}>{m.label}</Tooltip> : null}
          </Marker>
        ))}
        {fit ? <FitBounds points={fitPoints} /> : <Recenter center={center} />}
        {onCenterChange ? <CenterWatcher onChange={onCenterChange} /> : null}
      </MapContainer>
      {onCenterChange ? (
        <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-x-1/2 -translate-y-full">
          <svg width="40" height="48" viewBox="0 0 40 48">
            <path d="M20 47s16-15.6 16-27A16 16 0 0 0 4 20c0 11.4 16 27 16 27z" fill="#F97316" stroke="#fff" strokeWidth="3" />
            <circle cx="20" cy="20" r="6" fill="#fff" />
          </svg>
        </div>
      ) : null}
    </div>
  );
}
