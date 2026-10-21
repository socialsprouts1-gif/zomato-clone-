"use client";

import { Check, ChevronDown, Store, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { selectOutlet, setAutoAccept, setOutletBusy, setOutletOnline } from "@/lib/partner/actions";
import type { Outlet } from "@/lib/partner/context";
import { cn } from "@/lib/utils";

export function OutletSwitcher({ outlets, current }: { outlets: Outlet[]; current: Outlet | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!current) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-40 gap-2 sm:max-w-56" disabled={pending} aria-label="Switch outlet">
          <Store className="size-4 text-primary" /> <span className="truncate">{current.name}</span>
          {outlets.length > 1 ? <ChevronDown className="size-4" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your outlets</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {outlets.map((o) => (
          <DropdownMenuItem
            key={o.id}
            onSelect={() =>
              start(async () => {
                await selectOutlet(o.id);
                router.refresh();
                toast.success(`Switched to ${o.name}`);
              })
            }
          >
            <span className="flex-1">
              <span className="block font-medium">{o.name}</span>
              <span className="text-xs text-muted-foreground">
                {o.locality}
                {o.status !== "approved" ? ` · ${o.status}` : ""}
              </span>
            </span>
            {o.id === current.id ? <Check className="text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OutletStatusControls({ outlet }: { outlet: Outlet }) {
  const router = useRouter();
  const [, start] = useTransition();
  const busy = outlet.busy_until && new Date(outlet.busy_until) > new Date();
  const [state, setOptimistic] = useOptimistic({ online: outlet.is_online, auto: outlet.auto_accept });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className={cn("flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold", state.online ? "border-success text-success" : "text-muted-foreground")}>
        <span className={cn("size-2.5 rounded-full", state.online && !busy ? "bg-success" : "bg-muted-foreground")} />
        {state.online ? (busy ? "Busy" : "Online") : "Offline"}
        <Switch
          checked={state.online}
          aria-label="Restaurant online"
          className="data-[state=checked]:bg-success"
          onCheckedChange={(v) =>
            start(async () => {
              setOptimistic((s) => ({ ...s, online: v }));
              const r = await setOutletOnline(outlet.id, v);
              if (!r.ok) toast.error(r.error);
              else toast.success(v ? "You're online and accepting orders" : "You're offline. Customers can't order right now.");
              router.refresh();
            })
          }
        />
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {busy ? `Busy until ${new Date(outlet.busy_until!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "Mark busy"} <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {[30, 60].map((m) => (
            <DropdownMenuItem
              key={m}
              onSelect={() =>
                start(async () => {
                  await setOutletBusy(outlet.id, m);
                  toast.success(`Paused new orders for ${m} minutes`);
                  router.refresh();
                })
              }
            >
              Busy for {m} minutes
            </DropdownMenuItem>
          ))}
          {busy ? (
            <DropdownMenuItem
              onSelect={() =>
                start(async () => {
                  await setOutletBusy(outlet.id, null);
                  toast.success("Taking orders again");
                  router.refresh();
                })
              }
            >
              I&apos;m back now
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="flex items-center gap-2 text-sm font-medium" title="Accepts new orders automatically with your usual prep time — handy when presenting alone">
        <Zap className="size-4 text-primary" /> Auto-accept
        <Switch
          checked={state.auto}
          aria-label="Auto-accept orders"
          onCheckedChange={(v) =>
            start(async () => {
              setOptimistic((s) => ({ ...s, auto: v }));
              const r = await setAutoAccept(outlet.id, v);
              if (!r.ok) toast.error(r.error);
              else toast.success(v ? "New orders will be accepted automatically" : "Auto-accept off");
              router.refresh();
            })
          }
        />
        <DemoBadge label="Demo helper" className="hidden md:inline-flex" />
      </label>
    </div>
  );
}
