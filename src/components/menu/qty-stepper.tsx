"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QtyStepper({ qty, onInc, onDec, label, size = "md", className }: { qty: number; onInc: () => void; onDec: () => void; label: string; size?: "sm" | "md"; className?: string }) {
  return (
    <div className={cn("inline-flex items-center rounded-xl border border-primary/40 bg-card font-bold text-primary shadow-sm", size === "sm" ? "h-8" : "h-10", className)}>
      <button type="button" onClick={onDec} aria-label={`Remove one ${label}`} className={cn("flex h-full items-center justify-center rounded-l-xl hover:bg-secondary", size === "sm" ? "w-8" : "w-10")}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-6 text-center tabular-nums" aria-live="polite" aria-label={`${qty} in cart`}>
        {qty}
      </span>
      <button type="button" onClick={onInc} aria-label={`Add one more ${label}`} className={cn("flex h-full items-center justify-center rounded-r-xl hover:bg-secondary", size === "sm" ? "w-8" : "w-10")}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}
