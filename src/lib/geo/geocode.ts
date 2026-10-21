import "server-only";

import { nearestLocality, puneLocalities } from "./pune-localities";

export type GeocodeResult = { label: string; line: string; area: string; lat: number; lng: number; pincode?: string };

const UA = "Thaali-demo/1.0 (food delivery prototype)";

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

function fromNominatim(item: NominatimItem): GeocodeResult {
  const a = item.address ?? {};
  const area = a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? a.town ?? a.city ?? "Pune";
  const road = a.road ?? a.pedestrian ?? a.amenity ?? "";
  return {
    label: item.display_name.split(",")[0] ?? area,
    line: [a.house_number, road, area].filter(Boolean).join(", ") || item.display_name.split(",").slice(0, 3).join(","),
    area,
    lat: Number(item.lat),
    lng: Number(item.lon),
    pincode: a.postcode,
  };
}

async function nominatim(path: string): Promise<unknown> {
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(3500),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return res.json();
}

/** Address search, biased to Pune. Falls back to known Pune localities when OSM is unreachable. */
export async function searchAddress(q: string): Promise<GeocodeResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  try {
    const data = (await nominatim(
      `search?format=jsonv2&addressdetails=1&limit=6&countrycodes=in&viewbox=73.70,18.65,74.02,18.42&bounded=1&q=${encodeURIComponent(query)}`,
    )) as NominatimItem[];
    if (data.length) return data.map(fromNominatim);
  } catch {
    // fall through to offline list
  }
  const needle = query.toLowerCase();
  return puneLocalities
    .filter((l) => l.name.toLowerCase().includes(needle))
    .slice(0, 6)
    .map((l) => ({ label: l.name, line: `${l.name}, Pune`, area: l.name, lat: l.lat, lng: l.lng, pincode: l.pincode }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  try {
    const item = (await nominatim(`reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`)) as NominatimItem;
    if (item?.lat) return { ...fromNominatim(item), lat, lng };
  } catch {
    // fall through
  }
  const l = nearestLocality(lat, lng);
  return { label: l.name, line: `Near ${l.name}, Pune`, area: l.name, lat, lng, pincode: l.pincode };
}
