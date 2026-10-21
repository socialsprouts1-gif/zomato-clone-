"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/components/maps/map";

export type GeoResult = { label: string; line: string; area: string; lat: number; lng: number; pincode?: string };

export function useAddressSearch(query: string) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<GeoResult[]>)
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  return { results, loading };
}

export async function reverseGeocode(p: LatLng): Promise<GeoResult> {
  const r = await fetch(`/api/geocode/reverse?lat=${p.lat}&lng=${p.lng}`);
  return (await r.json()) as GeoResult;
}

export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location isn't available in this browser."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Pick your location on the map instead."
              : "Couldn't detect your location. Try again or pick it on the map.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
