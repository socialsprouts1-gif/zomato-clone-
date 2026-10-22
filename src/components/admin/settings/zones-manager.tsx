"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MapPinned, MoreVertical, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteZone, saveZone, setZoneActive } from "@/lib/admin/settings-actions";
import { ZoneMap } from "./zone-map";
import { zoneSchema, type Zone, type ZoneInput, type ZoneValues } from "./schema";

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

function defaults(z: Zone | null): ZoneInput {
  return z
    ? { name: z.name, center_lat: String(z.center_lat), center_lng: String(z.center_lng), radius_km: String(Number(z.radius_km)), is_active: z.is_active }
    : { name: "", center_lat: "18.5204", center_lng: "73.8567", radius_km: "8", is_active: true };
}

function ZoneDialog({ open, onOpenChange, zone }: { open: boolean; onOpenChange: (v: boolean) => void; zone: Zone | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<ZoneInput, unknown, ZoneValues>({ resolver: zodResolver(zoneSchema), defaultValues: defaults(zone) });
  const { register, formState, reset, watch } = form;
  const errors = formState.errors;
  const [lat, lng, radius] = watch(["center_lat", "center_lng", "radius_km"]);
  const preview = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(radius) > 0 ? { lat: Number(lat), lng: Number(lng), radiusKm: Math.min(Number(radius), 50) } : null;

  useEffect(() => {
    if (open) reset(defaults(zone));
  }, [open, zone, reset]);

  function submit(v: ZoneValues) {
    start(async () => {
      const res = await saveZone(zone?.id ?? null, form.getValues());
      if (!res.ok) return void toast.error(res.error);
      toast.success(zone ? `${v.name} updated` : `${v.name} added`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col">
        <DialogHeader>
          <DialogTitle>{zone ? `Edit ${zone.name}` : "New delivery zone"}</DialogTitle>
          <DialogDescription>A circle around a centre point. Tip: copy coordinates from any map app.</DialogDescription>
        </DialogHeader>
        <form id="zone-form" onSubmit={form.handleSubmit(submit)} className="-mx-6 grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-1" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="zone-name">Zone name</Label>
            <Input id="zone-name" placeholder="Pune Metro" aria-invalid={Boolean(errors.name)} {...register("name")} />
            <Err e={errors.name} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="zone-lat">Latitude</Label>
              <Input id="zone-lat" inputMode="decimal" aria-invalid={Boolean(errors.center_lat)} {...register("center_lat")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="zone-lng">Longitude</Label>
              <Input id="zone-lng" inputMode="decimal" aria-invalid={Boolean(errors.center_lng)} {...register("center_lng")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="zone-radius">Radius (km)</Label>
              <Input id="zone-radius" inputMode="decimal" aria-invalid={Boolean(errors.radius_km)} {...register("radius_km")} />
            </div>
          </div>
          <Err e={errors.center_lat ?? errors.center_lng ?? errors.radius_km} />
          {preview ? <ZoneMap className="h-48" zones={[{ id: "preview", ...preview, active: true, highlight: true }]} /> : null}
          <label htmlFor="zone-active" className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-sm font-semibold">
            <input id="zone-active" type="checkbox" className="size-5 accent-primary" {...register("is_active")} /> Zone is active
          </label>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="zone-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {zone ? "Save zone" : "Add zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ZonesManager({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Zone | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Zone | null>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Something went wrong");
      toast.success(msg);
      router.refresh();
    });
  }
  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <section aria-labelledby="zones-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="zones-title" className="font-display text-lg font-semibold">
          Delivery zones
        </h2>
        <Button variant="outline" onClick={openNew}>
          <Plus /> New zone
        </Button>
      </div>
      {zones.length === 0 ? (
        <EmptyState icon={MapPinned} title="No zones yet" description="Add the area Thaali serves." action={<Button onClick={openNew}>Add a zone</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="space-y-2">
            {zones.map((z) => (
              <li key={z.id} className="min-w-0">
                <Card className="flex items-center gap-3 p-3" data-testid="zone" data-name={z.name}>
                  <MapPinned className="size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{z.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(z.radius_km)} km around {z.center_lat.toFixed(4)}, {z.center_lng.toFixed(4)}
                    </p>
                  </div>
                  <Badge className={z.is_active ? "border-transparent bg-success text-white" : "bg-muted text-muted-foreground"}>{z.is_active ? "Active" : "Paused"}</Badge>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${z.name}`} disabled={pending}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(z);
                          setOpen(true);
                        }}
                      >
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => act(() => setZoneActive(z.id, !z.is_active), z.is_active ? `${z.name} paused` : `${z.name} is active`)}>
                        <Power /> {z.is_active ? "Pause" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm(z)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Card>
              </li>
            ))}
          </ul>
          <ZoneMap className="h-56 lg:h-full lg:min-h-56" zones={zones.map((z) => ({ id: z.id, lat: z.center_lat, lng: z.center_lng, radiusKm: Number(z.radius_km), active: z.is_active }))} />
        </div>
      )}
      <ZoneDialog open={open} onOpenChange={setOpen} zone={editing} />
      <AlertDialog open={Boolean(confirm)} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>The zone is removed permanently. Pause it instead if you only need to stop it for a while.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const z = confirm;
                setConfirm(null);
                if (z) act(() => deleteZone(z.id), `${z.name} deleted`);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
