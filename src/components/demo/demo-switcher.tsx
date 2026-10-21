"use client";

import { Bike, ChefHat, ShieldCheck, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DemoBadge } from "@/components/shared/demo-badge";
import type { AppKey } from "@/config/brand";
import { demoPersonas, type DemoPersona } from "@/config/demo";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "thaali.demo.persona";

const appIcons: Record<AppKey, LucideIcon> = {
  customer: UserRound,
  partner: ChefHat,
  rider: Bike,
  admin: ShieldCheck,
};

function readStoredPersona(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Floating switcher for jumping between the four apps as a demo persona.
 * Phase 0: remembers the persona and opens its app.
 * Phase 2 replaces the body of `choose` with a real sign-in as that persona.
 */
export function DemoSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(readStoredPersona());
  }, []);

  // Customer and rider apps have a bottom tab bar on phones; sit above it.
  const hasBottomBar = !pathname.startsWith("/partner") && !pathname.startsWith("/admin");

  function choose(persona: DemoPersona) {
    try {
      window.localStorage.setItem(STORAGE_KEY, persona.id);
    } catch {
      // Storage can be blocked (private mode); switching still works for this tab.
    }
    setActiveId(persona.id);
    setOpen(false);
    toast.success(`Switched to ${persona.label}`, { description: persona.description });
    router.push(persona.href);
  }

  const active = demoPersonas.find((p) => p.id === activeId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open demo switcher"
        data-testid="demo-switcher"
        className={cn(
          "fixed left-4 z-40 flex items-center gap-2 rounded-full bg-foreground py-2 pr-4 pl-3 text-sm font-semibold text-background shadow-lg transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring",
          hasBottomBar ? "bottom-20 md:bottom-4" : "bottom-4",
        )}
      >
        <Sparkles className="size-4 text-primary" aria-hidden />
        {active ? active.label : "Demo"}
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-lg pb-6">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>Switch demo persona</SheetTitle>
            <DemoBadge />
          </div>
          <SheetDescription>Jump into any of the four apps as a seeded demo account.</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2 px-5">
          {demoPersonas.map((persona) => {
            const Icon = appIcons[persona.app];
            const isActive = persona.id === activeId;
            return (
              <li key={persona.id}>
                <button
                  type="button"
                  onClick={() => choose(persona)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:border-primary hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "border-primary bg-secondary",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{persona.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {persona.description} · {persona.email}
                    </span>
                  </span>
                  {isActive ? <span className="text-xs font-semibold text-primary">Active</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
