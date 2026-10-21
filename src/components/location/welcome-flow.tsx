"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, Loader2, MapPinned } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { setDeliveryLocation } from "@/lib/preferences-actions";
import { LocationChooser, type ChosenLocation } from "./location-chooser";
import { getCurrentPosition, reverseGeocode } from "./use-geocode";

const DEFAULT = { lat: 18.5385, lng: 73.8925 };

export function WelcomeFlow({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"splash" | "ask" | "pick">("splash");
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s === "splash" ? "ask" : s)), 1400);
    return () => clearTimeout(t);
  }, []);

  function finish(loc: ChosenLocation) {
    start(async () => {
      await setDeliveryLocation(loc);
      toast.success(`Delivering to ${loc.label}`);
      router.replace(next);
      router.refresh();
    });
  }

  function detect() {
    start(async () => {
      try {
        const pos = await getCurrentPosition();
        const place = await reverseGeocode(pos);
        await setDeliveryLocation({ lat: pos.lat, lng: pos.lng, label: place.area || "Current location", line: place.line });
        toast.success(`Delivering to ${place.area}`);
        router.replace(next);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't detect your location");
        setStep("pick");
      }
    });
  }

  return (
    <main id="main" className="flex min-h-dvh flex-col bg-gradient-to-b from-secondary to-background">
      <AnimatePresence mode="wait">
        {step === "splash" ? (
          <motion.div
            key="splash"
            className="flex flex-1 flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <motion.div initial={{ scale: 0.6, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 180, damping: 12 }}>
              <LogoMark className="size-24" />
            </motion.div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight">{brand.name}</h1>
            <p className="text-muted-foreground">{brand.tagline}</p>
            <button type="button" className="sr-only" onClick={() => setStep("ask")}>
              Continue
            </button>
          </motion.div>
        ) : step === "ask" ? (
          <motion.div key="ask" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-card shadow-md">
              <MapPinned className="size-12 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold">Where should we deliver?</h1>
              <p className="mt-2 text-muted-foreground">Allow location access to see restaurants, delivery times and fees near you.</p>
            </div>
            <div className="grid gap-3">
              <Button size="lg" onClick={detect} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my current location
              </Button>
              <Button size="lg" variant="outline" onClick={() => setStep("pick")} disabled={pending}>
                Enter location manually
              </Button>
              <Button
                variant="link"
                disabled={pending}
                onClick={() => finish({ ...DEFAULT, label: "Koregaon Park", line: "Koregaon Park, Pune" })}
              >
                Skip for now, browse {brand.city}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="pick" className="mx-auto w-full max-w-lg flex-1 px-4 py-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display mb-4 text-2xl font-bold">Choose your location</h1>
            <LocationChooser initialCenter={DEFAULT} onChosen={finish} busy={pending} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
