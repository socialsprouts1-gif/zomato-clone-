"use client";

import { BellRing, Bike, CalendarClock, ChefHat, CircleCheck, ClipboardList, Clock, Loader2, Printer, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { VegDot } from "@/components/catalog/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { browserNotify, useAlertSound } from "@/hooks/use-alert-sound";
import { useRealtime } from "@/hooks/use-realtime";
import { fetchLiveOrders, partnerAccept, partnerHandOver, partnerMarkReady, partnerReject } from "@/lib/partner/actions";
import type { LiveOrder } from "@/lib/partner/orders";
import { cn, formatPaise } from "@/lib/utils";

type Tab = "new" | "preparing" | "ready" | "picked" | "past";
const TAB_STATUSES: Record<Tab, string[]> = {
  new: ["PLACED"],
  preparing: ["ACCEPTED", "PREPARING"],
  ready: ["READY", "RIDER_ASSIGNED"],
  picked: ["PICKED_UP", "OUT_FOR_DELIVERY"],
  past: ["DELIVERED", "REJECTED", "CANCELLED", "CANCELLED_BY_CUSTOMER", "SCHEDULED", "FAILED_PAYMENT"],
};
const TAB_LABEL: Record<Tab, string> = { new: "New", preparing: "Preparing", ready: "Ready", picked: "Picked up", past: "Past orders" };
const REJECT_REASONS = ["Items out of stock", "Kitchen too busy", "Closing soon", "Can't deliver to this area"];

function minsAgo(iso: string | null) {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : `${m} min ago`;
}

function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function LiveOrdersBoard({ restaurantId, restaurantName, initial }: { restaurantId: string; restaurantName: string; initial: LiveOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [tab, setTab] = useState<Tab>("new");
  const [rejecting, setRejecting] = useState<LiveOrder | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();
  const sound = useAlertSound();
  const known = useRef(new Set(initial.filter((o) => o.status === "PLACED").map((o) => o.id)));
  useTick();

  const refresh = useCallback(async () => {
    const list = await fetchLiveOrders(restaurantId);
    setOrders(list);
    const fresh = list.filter((o) => o.status === "PLACED" && !known.current.has(o.id));
    for (const o of fresh) {
      known.current.add(o.id);
      toast(`New order #${o.order_number}`, { description: `${o.customer_name ?? "Customer"} · ${formatPaise(o.total_paise)}`, icon: <BellRing className="size-4" /> });
      browserNotify(`New order #${o.order_number}`, `${restaurantName}: ${o.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}`, o.id);
    }
    if (fresh.length) setTab("new");
  }, [restaurantId, restaurantName]);

  const status = useRealtime(`partner-orders:${restaurantId}`, [{ table: "orders", filter: `restaurant_id=eq.${restaurantId}` }], () => void refresh(), 10000);

  const pending = orders.filter((o) => o.status === "PLACED").length;
  useEffect(() => {
    if (pending > 0 && sound.enabled) sound.start();
    else sound.stop();
  }, [pending, sound]);

  const counts = useMemo(() => Object.fromEntries((Object.keys(TAB_STATUSES) as Tab[]).map((t) => [t, orders.filter((o) => TAB_STATUSES[t].includes(o.status)).length])) as Record<Tab, number>, [orders]);
  const list = orders.filter((o) => TAB_STATUSES[tab].includes(o.status));

  function act(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusyId(id);
    start(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok) toast.error(res.error ?? "Couldn't update the order");
      else toast.success(success);
      await refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!sound.enabled ? (
        <button
          type="button"
          onClick={() => void sound.enable()}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary bg-secondary/60 p-3 text-left text-sm"
          data-testid="enable-alerts"
        >
          <Volume2 className="size-5 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">Turn on order alerts</span>
            <span className="text-muted-foreground">Plays a loud chime and shows a browser notification for every new order.</span>
          </span>
        </button>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Order status" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground",
                tab === t && "border-primary bg-primary text-primary-foreground",
                t === "new" && counts.new > 0 && tab !== t && "animate-pulse border-primary text-primary",
              )}
            >
              {TAB_LABEL[t]}
              <span className={cn("rounded-full px-1.5 text-xs", tab === t ? "bg-white/25" : "bg-muted")}>{counts[t]}</span>
            </button>
          ))}
        </div>
        <span className={cn("flex shrink-0 items-center gap-1.5 text-xs", status === "live" ? "text-success" : "text-muted-foreground")} aria-live="polite">
          <span className={cn("size-2 rounded-full", status === "live" ? "bg-success" : "bg-muted-foreground")} /> {status === "live" ? "Live" : "Reconnecting…"}
        </span>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === "new" ? "No new orders" : `Nothing in ${TAB_LABEL[tab].toLowerCase()}`}
          description={tab === "new" ? "You'll hear a chime when a customer places an order." : undefined}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {list.map((o) => (
            <li key={o.id}>
              <Card className={cn("space-y-3 p-4", o.status === "PLACED" && "border-primary ring-2 ring-primary/30")} data-testid="partner-order" data-order-number={o.order_number}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">#{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.customer_name ?? "Customer"} · {minsAgo(o.placed_at ?? o.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={o.payment_method === "cod" ? "secondary" : "success"}>{o.payment_method === "cod" ? "Cash" : "Paid"}</Badge>
                    {o.source === "group" ? <Badge variant="outline">Group order</Badge> : null}
                    {o.scheduled_for ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="size-3" /> {new Date(o.scheduled_for).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {o.order_items.map((i) => {
                    const addons = (i.addons as { name: string }[] | null) ?? [];
                    return (
                      <li key={i.id} className="flex gap-2">
                        <VegDot veg={i.is_veg} className="mt-0.5 size-3.5" />
                        <span>
                          <span className="font-semibold">{i.quantity} ×</span> {i.name}
                          {i.variant_name || addons.length ? <span className="block text-xs text-muted-foreground">{[i.variant_name, ...addons.map((a) => a.name)].filter(Boolean).join(", ")}</span> : null}
                          {i.added_by_name ? <span className="block text-xs text-muted-foreground">for {i.added_by_name}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {o.cooking_instructions || o.no_cutlery ? (
                  <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    {o.cooking_instructions ? <p>“{o.cooking_instructions}”</p> : null}
                    {o.no_cutlery ? <p className="font-semibold">No cutlery</p> : null}
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bill total</span>
                  <span className="font-bold">{formatPaise(o.total_paise)}</span>
                </div>
                {o.riders ? (
                  <p className="flex items-center gap-2 rounded-xl bg-muted p-2 text-xs">
                    <Bike className="size-4 text-success" /> {o.riders.name} · {o.riders.vehicle_number}
                    {o.rider_at_restaurant_at ? <span className="font-semibold text-success">· at your restaurant</span> : <span>· on the way</span>}
                  </p>
                ) : null}
                {o.status === "PREPARING" && o.accepted_at && o.prep_minutes ? (
                  <PrepTimer acceptedAt={o.accepted_at} prepMinutes={o.prep_minutes} />
                ) : null}
                {o.reject_reason ? <p className="text-xs text-destructive">Rejected: {o.reject_reason}</p> : null}

                <div className="flex flex-wrap gap-2">
                  {o.status === "PLACED" ? (
                    <>
                      {[10, 15, 20, 30].map((m) => (
                        <Button key={m} size="sm" disabled={busyId === o.id} onClick={() => act(o.id, () => partnerAccept(o.id, m), `Accepted #${o.order_number} · ${m} min`)} aria-label={`Accept with ${m} minute prep time`}>
                          {busyId === o.id ? <Loader2 className="animate-spin" /> : <ChefHat />} {m} min
                        </Button>
                      ))}
                      <Button size="sm" variant="outline" className="text-destructive" disabled={busyId === o.id} onClick={() => setRejecting(o)}>
                        <X /> Reject
                      </Button>
                    </>
                  ) : null}
                  {o.status === "PREPARING" || o.status === "ACCEPTED" ? (
                    <Button size="sm" disabled={busyId === o.id} onClick={() => act(o.id, () => partnerMarkReady(o.id), `#${o.order_number} marked ready`)}>
                      <CircleCheck /> Mark food ready
                    </Button>
                  ) : null}
                  {o.status === "READY" ? (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="size-4" /> Waiting for a delivery partner…
                    </span>
                  ) : null}
                  {o.status === "RIDER_ASSIGNED" ? (
                    <Button size="sm" disabled={busyId === o.id} onClick={() => act(o.id, () => partnerHandOver(o.id), `#${o.order_number} handed over`)}>
                      <Bike /> Handed over to rider
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/partner/orders/${o.id}/kot`} target="_blank">
                      <Printer /> KOT
                    </Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(rejecting)} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject order #{rejecting?.order_number}?</DialogTitle>
            <DialogDescription>The customer gets a full refund. Frequent rejections lower your ranking.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-3 py-1.5 text-sm", reason === r && "border-primary bg-secondary")}>
                {r}
              </button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const o = rejecting!;
                setRejecting(null);
                act(o.id, () => partnerReject(o.id, reason), `Rejected #${o.order_number}`);
              }}
            >
              Reject order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrepTimer({ acceptedAt, prepMinutes }: { acceptedAt: string; prepMinutes: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = new Date(acceptedAt).getTime() + prepMinutes * 60000 - now;
  const late = left < 0;
  const m = Math.floor(Math.abs(left) / 60000);
  const s = Math.floor((Math.abs(left) % 60000) / 1000);
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-semibold tabular-nums", late ? "text-destructive" : "text-primary")}>
      <Clock className="size-4" /> {late ? "Running late by" : "Ready in"} {m}:{String(s).padStart(2, "0")}
    </p>
  );
}
