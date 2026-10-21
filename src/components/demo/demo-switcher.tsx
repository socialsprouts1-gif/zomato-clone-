"use client";

import { Bike, ChefHat, Loader2, LogOut, ShieldCheck, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DemoBadge } from "@/components/shared/demo-badge";
import type { AppKey } from "@/config/brand";
import { demoPersonas, type DemoPersona } from "@/config/demo";
import { demoSignIn, signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const appIcons: Record<AppKey, LucideIcon> = {
  customer: UserRound,
  partner: ChefHat,
  rider: Bike,
  admin: ShieldCheck,
};

/** Floating switcher that signs in as any seeded demo persona (demo mode only). */
export function DemoSwitcher({ currentEmail }: { currentEmail: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();

  // Customer and rider apps have a bottom tab bar on phones; sit above it.
  const hasBottomBar = !pathname.startsWith("/partner") && !pathname.startsWith("/admin") && !pathname.startsWith("/login");
  const active = demoPersonas.find((p) => p.email === currentEmail);

  function choose(persona: DemoPersona) {
    setPendingId(persona.id);
    start(async () => {
      const res = await demoSignIn(persona.id);
      setPendingId(null);
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
      toast.success(`Signed in as ${persona.label}`, { description: `${persona.description} · ${persona.email}` });
      router.push(res.data!.redirectTo);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open demo switcher"
        data-testid="demo-switcher"
        className={cn(
          "fixed left-4 z-40 flex max-w-[60vw] items-center gap-2 rounded-full bg-foreground py-2 pr-4 pl-3 text-sm font-semibold text-background shadow-lg transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring",
          hasBottomBar ? "bottom-20 md:bottom-4" : "bottom-4",
        )}
      >
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{active ? `${active.label}` : "Demo"}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto pb-6">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>Switch demo persona</SheetTitle>
            <DemoBadge />
          </div>
          <SheetDescription>Sign in as any seeded account. Open several tabs to show all four apps at once.</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2 px-5">
          {demoPersonas.map((persona) => {
            const Icon = appIcons[persona.app];
            const isActive = persona.email === currentEmail;
            return (
              <li key={persona.id}>
                <button
                  type="button"
                  onClick={() => choose(persona)}
                  disabled={pendingId !== null}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:border-primary hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    isActive && "border-primary bg-secondary",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    {pendingId === persona.id ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" aria-hidden />}
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
        {currentEmail ? (
          <div className="px-5">
            <button
              type="button"
              onClick={() => start(() => signOut())}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" /> Sign out ({currentEmail})
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
