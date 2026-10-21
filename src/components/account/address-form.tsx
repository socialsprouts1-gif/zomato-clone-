"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Crosshair, Home, Loader2, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getCurrentPosition, reverseGeocode, useAddressSearch } from "@/components/location/use-geocode";
import { Map, type LatLng } from "@/components/maps/map";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveAddress } from "@/lib/account/actions";
import { setDeliveryLocation } from "@/lib/preferences-actions";
import { cn } from "@/lib/utils";

const schema = z.object({
  label: z.enum(["Home", "Work", "Other"]),
  custom_label: z.string().trim().max(30).optional(),
  flat: z.string().trim().min(1, "Enter your flat, house or floor"),
  line1: z.string().trim().min(3, "Enter the street or area"),
  landmark: z.string().trim().max(120).optional(),
  area: z.string().trim().max(80).optional(),
  pincode: z.string().trim().regex(/^(\d{6})?$/, "6-digit pincode").optional(),
  instructions: z.string().trim().max(200).optional(),
  is_default: z.boolean(),
});
type Values = z.infer<typeof schema>;

export type AddressDefaults = Partial<Values> & { id?: string; lat: number; lng: number };

export function AddressForm({ defaults, redirectTo = "/account/addresses" }: { defaults: AddressDefaults; redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [center, setCenter] = useState<LatLng>({ lat: defaults.lat, lng: defaults.lng });
  const [query, setQuery] = useState("");
  const { results } = useAddressSearch(query);
  const [locating, setLocating] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: defaults.label ?? "Home",
      custom_label: defaults.custom_label ?? "",
      flat: defaults.flat ?? "",
      line1: defaults.line1 ?? "",
      landmark: defaults.landmark ?? "",
      area: defaults.area ?? "",
      pincode: defaults.pincode ?? "",
      instructions: defaults.instructions ?? "",
      is_default: defaults.is_default ?? false,
    },
  });
  const label = form.watch("label");

  async function fillFrom(p: LatLng) {
    const place = await reverseGeocode(p);
    form.setValue("line1", place.line, { shouldValidate: true });
    form.setValue("area", place.area);
    if (place.pincode) form.setValue("pincode", place.pincode);
  }

  async function useCurrent() {
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      setCenter(p);
      await fillFrom(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't get your location");
    } finally {
      setLocating(false);
    }
  }

  function submit(v: Values) {
    start(async () => {
      const res = await saveAddress({ ...v, id: defaults.id, lat: center.lat, lng: center.lng, pincode: v.pincode || "" });
      if (!res.ok) return void toast.error(res.error);
      await setDeliveryLocation({ lat: center.lat, lng: center.lng, label: v.label === "Other" && v.custom_label ? v.custom_label : v.label, line: `${v.flat}, ${v.line1}`, addressId: res.id });
      toast.success("Address saved");
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-6 lg:grid-cols-2" noValidate>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search area or landmark" className="pl-10" aria-label="Search address" />
          {results.length ? (
            <ul className="absolute inset-x-0 top-full z-[600] mt-1 divide-y overflow-hidden rounded-xl border bg-popover shadow-lg">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setCenter({ lat: r.lat, lng: r.lng });
                      form.setValue("line1", r.line, { shouldValidate: true });
                      form.setValue("area", r.area);
                      if (r.pincode) form.setValue("pincode", r.pincode);
                      setQuery("");
                    }}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> <span>{r.line}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Map
          center={center}
          zoom={16}
          className="h-72 w-full lg:h-96"
          onCenterChange={(c) => {
            setCenter(c);
            void fillFrom(c);
          }}
        />
        <Button type="button" variant="outline" className="w-full text-primary" onClick={useCurrent} disabled={locating}>
          {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my current location
        </Button>
      </div>

      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Save as</legend>
          <Controller
            control={form.control}
            name="label"
            render={({ field }) => (
              <div className="flex gap-2" role="radiogroup">
                {(["Home", "Work", "Other"] as const).map((l) => {
                  const Icon = l === "Home" ? Home : l === "Work" ? Briefcase : MapPin;
                  return (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={field.value === l}
                      onClick={() => field.onChange(l)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition",
                        field.value === l ? "border-primary bg-secondary text-secondary-foreground" : "bg-card text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" /> {l}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </fieldset>
        {label === "Other" ? (
          <div className="space-y-2">
            <Label htmlFor="custom_label">Name this place</Label>
            <Input id="custom_label" placeholder="e.g. Mom's place" {...form.register("custom_label")} />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="flat">Flat / house no. / floor</Label>
          <Input id="flat" placeholder="e.g. 402, Silver Oak Apartments" aria-invalid={Boolean(form.formState.errors.flat)} {...form.register("flat")} />
          {form.formState.errors.flat ? <p className="text-sm text-destructive">{form.formState.errors.flat.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="line1">Street / area</Label>
          <Input id="line1" aria-invalid={Boolean(form.formState.errors.line1)} {...form.register("line1")} />
          {form.formState.errors.line1 ? <p className="text-sm text-destructive">{form.formState.errors.line1.message}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="landmark">Landmark (optional)</Label>
            <Input id="landmark" {...form.register("landmark")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode</Label>
            <Input id="pincode" inputMode="numeric" maxLength={6} {...form.register("pincode")} />
            {form.formState.errors.pincode ? <p className="text-sm text-destructive">{form.formState.errors.pincode.message}</p> : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="instructions">Delivery instructions (optional)</Label>
          <Textarea id="instructions" placeholder="e.g. Ring the bell twice, take the lift to the 4th floor" {...form.register("instructions")} />
        </div>
        <Controller
          control={form.control}
          name="is_default"
          render={({ field }) => (
            <Label className="cursor-pointer font-normal">
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} /> Make this my default address
            </Label>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save address
        </Button>
      </div>
    </form>
  );
}
