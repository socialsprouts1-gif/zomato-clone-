"use client";

import { ArrowLeft, Briefcase, Crosshair, Home, Loader2, MapPin, MapPinned, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Map, type LatLng } from "@/components/maps/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getCurrentPosition, reverseGeocode, useAddressSearch, type GeoResult } from "./use-geocode";

export type SavedAddress = {
  id: string;
  label: string;
  custom_label: string | null;
  line1: string;
  flat: string | null;
  area: string | null;
  lat: number;
  lng: number;
};

export type ChosenLocation = { lat: number; lng: number; label: string; line: string; addressId?: string };

const labelIcon = (label: string) => (label === "Home" ? Home : label === "Work" ? Briefcase : MapPin);

export function LocationChooser({
  saved = [],
  initialCenter,
  onChosen,
  busy,
}: {
  saved?: SavedAddress[];
  initialCenter: LatLng;
  onChosen: (loc: ChosenLocation) => void | Promise<void>;
  busy?: boolean;
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const { results, loading } = useAddressSearch(query);
  const [detecting, startDetect] = useTransition();
  const [center, setCenter] = useState<LatLng>(initialCenter);
  const [preview, setPreview] = useState<GeoResult | null>(null);
  const [resolving, setResolving] = useState(false);

  function detect() {
    startDetect(async () => {
      try {
        const pos = await getCurrentPosition();
        const place = await reverseGeocode(pos);
        await onChosen({ lat: pos.lat, lng: pos.lng, label: place.area || "Current location", line: place.line });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't detect location");
        setView("map");
      }
    });
  }

  async function onCenter(c: LatLng) {
    setCenter(c);
    setResolving(true);
    try {
      setPreview(await reverseGeocode(c));
    } finally {
      setResolving(false);
    }
  }

  if (view === "map") {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setView("list")} className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </button>
        <p className="text-sm text-muted-foreground">Move the map to place the pin on your exact location.</p>
        <Map center={center} zoom={16} onCenterChange={onCenter} className="h-72 w-full" />
        <div className="rounded-2xl border bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-primary" />
            {resolving ? "Finding address…" : preview?.label ?? "Move the map to choose"}
          </p>
          {preview ? <p className="mt-0.5 text-xs text-muted-foreground">{preview.line}</p> : null}
        </div>
        <Button
          size="lg"
          disabled={!preview || busy || resolving}
          onClick={() => preview && onChosen({ lat: center.lat, lng: center.lng, label: preview.area || preview.label, line: preview.line })}
        >
          {busy ? <Loader2 className="animate-spin" /> : null} Confirm location
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for an area, street or landmark"
          className="pl-10"
          aria-label="Search address"
        />
        {loading ? <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      </div>

      {results.length ? (
        <ul className="divide-y rounded-2xl border bg-card" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="flex w-full items-start gap-3 p-3 text-left hover:bg-accent/60"
                onClick={() => onChosen({ lat: r.lat, lng: r.lng, label: r.area || r.label, line: r.line })}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.line}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="h-12 justify-start text-primary" onClick={detect} disabled={detecting || busy}>
          {detecting ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my current location
        </Button>
        <Button variant="outline" className="h-12 justify-start" onClick={() => setView("map")} disabled={busy}>
          <MapPinned /> Pick on map
        </Button>
      </div>

      {saved.length ? (
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">Saved addresses</h3>
          <ul className="grid gap-2">
            {saved.map((a) => {
              const Icon = labelIcon(a.label);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onChosen({ lat: a.lat, lng: a.lng, label: a.custom_label || a.label, line: [a.flat, a.line1].filter(Boolean).join(", "), addressId: a.id })
                    }
                    className={cn("flex w-full items-start gap-3 rounded-2xl border bg-card p-3 text-left transition hover:border-primary")}
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{a.custom_label || a.label}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{[a.flat, a.line1].filter(Boolean).join(", ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
