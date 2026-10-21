"use client";

import { Phone, PhoneCall } from "lucide-react";
import { useState } from "react";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Masked calling: numbers stay private on both sides (simulated in the demo). */
export function MaskedCallButton({ who, label = "Call", variant = "outline" }: { who: string; label?: string; variant?: "outline" | "secondary" | "default" }) {
  const [open, setOpen] = useState(false);
  const masked = `+91 80 4${Math.floor(100 + Math.random() * 899)} ${Math.floor(1000 + Math.random() * 8999)}`;
  return (
    <>
      <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)} aria-label={`${label} ${who}`}>
        <Phone /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto flex size-16 animate-pulse items-center justify-center rounded-full bg-success/15 text-success">
              <PhoneCall className="size-8" />
            </div>
            <DialogTitle>Calling {who}…</DialogTitle>
            <DialogDescription>
              Connecting through a masked number {masked}. Neither of you sees the other&apos;s real number.
            </DialogDescription>
          </DialogHeader>
          <DemoBadge label="Demo call" className="mx-auto" />
          <Button variant="destructive" onClick={() => setOpen(false)}>
            End call
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
