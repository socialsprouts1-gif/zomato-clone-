import "server-only";

import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/dictionaries";

export const COOKIE = {
  location: "thaali_loc",
  veg: "thaali_veg",
  healthy: "thaali_healthy",
  lang: "thaali_lang",
} as const;

export type DeliveryLocation = {
  lat: number;
  lng: number;
  label: string; // "Home", "Work", "Current location"…
  line: string; // short address line
  addressId?: string;
};

export const DEFAULT_LOCATION: DeliveryLocation = {
  lat: 18.5385,
  lng: 73.8925,
  label: "Koregaon Park",
  line: "Koregaon Park, Pune",
};

export function parseLocation(raw: string | undefined): DeliveryLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DeliveryLocation>;
    if (typeof v.lat !== "number" || typeof v.lng !== "number") return null;
    return { lat: v.lat, lng: v.lng, label: String(v.label ?? "Location"), line: String(v.line ?? ""), addressId: v.addressId };
  } catch {
    return null;
  }
}

export type Preferences = {
  location: DeliveryLocation;
  hasLocation: boolean;
  vegMode: boolean;
  healthyMode: boolean;
  locale: Locale;
};

export async function getPreferences(): Promise<Preferences> {
  const jar = await cookies();
  const loc = parseLocation(jar.get(COOKIE.location)?.value);
  return {
    location: loc ?? DEFAULT_LOCATION,
    hasLocation: Boolean(loc),
    vegMode: jar.get(COOKIE.veg)?.value === "1",
    healthyMode: jar.get(COOKIE.healthy)?.value === "1",
    locale: jar.get(COOKIE.lang)?.value === "hi" ? "hi" : "en",
  };
}
