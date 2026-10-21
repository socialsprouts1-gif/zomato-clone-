"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { setDeliveryLocation } from "@/lib/preferences-actions";
import { LocationChooser, type ChosenLocation, type SavedAddress } from "./location-chooser";

export function LocationButton({
  label,
  line,
  lat,
  lng,
  saved,
}: {
  label: string;
  line: string;
  lat: number;
  lng: number;
  saved: SavedAddress[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function choose(loc: ChosenLocation) {
    start(async () => {
      await setDeliveryLocation(loc);
      setOpen(false);
      toast.success(`Delivering to ${loc.label}`);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 text-left hover:bg-accent" aria-label={`Delivery location: ${label}. Change location`}>
        <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">
          <span className="flex items-center gap-0.5 text-sm font-bold">
            <span className="truncate">{label}</span> <ChevronDown className="size-4 shrink-0" aria-hidden />
          </span>
          <span className="block max-w-[52vw] truncate text-xs text-muted-foreground md:max-w-64">{line}</span>
        </span>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-lg overflow-y-auto pb-8">
        <SheetHeader>
          <SheetTitle>Choose delivery location</SheetTitle>
          <SheetDescription>Restaurants, delivery times and fees update for this location.</SheetDescription>
        </SheetHeader>
        <div className="px-5">
          <LocationChooser saved={saved} initialCenter={{ lat, lng }} onChosen={choose} busy={pending} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
