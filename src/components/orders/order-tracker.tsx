"use client";

import { Bike, CheckCircle2, ChefHat, Circle, Clock, KeyRound, LifeBuoy, Loader2, MapPin, Package, Star, Store, XCircle } from "lucide-react";
import Link from "next/link";
import { ChatButton } from "@/components/chat/chat-sheet";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Map, type MapMarker } from "@/components/maps/map";
import { MaskedCallButton } from "@/components/shared/masked-call";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRealtime } from "@/hooks/use-realtime";
import { haversineKm } from "@/lib/geo";
import { cancelMyOrder } from "@/lib/orders/customer-actions";
import { statusMeta, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

export type TrackerOrder = {
  id: string;
  order_number: number;
  status: OrderStatus;
  delivery_otp: string;
  placed_at: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  rider_assigned_at: string | null;
  rider_at_restaurant_at: string | null;
  picked_up_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  scheduled_for: string | null;
  prep_minutes: number | null;
  eta_minutes: number | null;
  rider_id: string | null;
  updated_at: string;
  delivery_address: { lat: number; lng: number; label?: string; line1?: string };
  restaurant: { name: string; lat: number; lng: number; phone: string | null };
  rider: { name: string; photo_url: string | null; vehicle_type: string; vehicle_number: string | null; rating: number; current_lat: number | null; current_lng: number | null } | null;
};

const ACTIVE: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"];
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null);

export function OrderTracker({ order, cancellable, me }: { order: TrackerOrder; cancellable: boolean; me: string }) {
  const router = useRouter();
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number; heading?: number } | null>(
    order.rider?.current_lat ? { lat: order.rider.current_lat, lng: order.rider.current_lng! } : null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, startCancel] = useTransition();
  const active = ACTIVE.includes(order.status);
  const refresh = useCallback(() => router.refresh(), [router]);

  useRealtime(active ? `order:${order.id}` : null, [{ table: "orders", filter: `id=eq.${order.id}`, event: "UPDATE" }, { table: "order_events", filter: `order_id=eq.${order.id}`, event: "INSERT" }], refresh, 5000);
  useRealtime(active ? `order-loc:${order.id}` : null, [{ table: "rider_locations", filter: `order_id=eq.${order.id}`, event: "INSERT" }], (p) => {
    const row = p?.new as { lat?: number; lng?: number; heading?: number } | undefined;
    if (row?.lat !== undefined) setRiderPos({ lat: row.lat, lng: row.lng!, heading: row.heading });
  });

  // Drives dispatch and the simulated rider while this screen is open (demo).
  // Each tick also reports the order's updated_at, so a missed realtime event still refreshes the screen.
  useEffect(() => {
    if (!active) return;
    const tick = async () => {
      try {
        const res = await fetch(`/api/sim/tick?order=${order.id}`, { method: "POST" });
        const json = (await res.json()) as { updatedAt?: string | null };
        if (json.updatedAt && json.updatedAt !== order.updated_at) router.refresh();
      } catch {
        // offline: try again next tick
      }
    };
    void tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [active, order.id, order.updated_at, router]);

  // ETA countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const home = order.delivery_address;
  const remainingKm = riderPos && (order.status === "OUT_FOR_DELIVERY" || order.status === "PICKED_UP") ? haversineKm(riderPos.lat, riderPos.lng, home.lat, home.lng) : null;
  const arriving = order.status === "OUT_FOR_DELIVERY" && remainingKm !== null && remainingKm < 0.4;
  const etaAt =
    remainingKm !== null
      ? now + Math.max(1, remainingKm * 3.5) * 60000
      : new Date(order.placed_at ?? now).getTime() + (order.eta_minutes ?? 35) * 60000;
  const etaMins = Math.max(1, Math.round((etaAt - now) / 60000));

  const steps: { key: string; label: string; at: string | null; icon: typeof Circle }[] = [
    { key: "PLACED", label: "Order placed", at: order.placed_at, icon: Package },
    { key: "ACCEPTED", label: "Restaurant accepted", at: order.accepted_at, icon: Store },
    { key: "PREPARING", label: order.prep_minutes ? `Preparing · about ${order.prep_minutes} min` : "Preparing", at: order.accepted_at, icon: ChefHat },
    { key: "RIDER", label: "Rider assigned", at: order.rider_assigned_at, icon: Bike },
    { key: "ATREST", label: "Rider at restaurant", at: order.rider_at_restaurant_at, icon: Store },
    { key: "PICKED", label: "Picked up", at: order.picked_up_at, icon: Package },
    { key: "OTW", label: "On the way", at: order.out_for_delivery_at, icon: Bike },
    { key: "ARRIVING", label: "Arriving", at: arriving || order.delivered_at ? order.out_for_delivery_at : null, icon: MapPin },
    { key: "DELIVERED", label: "Delivered", at: order.delivered_at, icon: CheckCircle2 },
  ];
  const currentIdx = Math.max(-1, ...steps.map((s, i) => (s.at ? i : -1)));
  const bad = statusMeta[order.status].tone === "bad";

  const markers: MapMarker[] = [
    { id: "r", lat: order.restaurant.lat, lng: order.restaurant.lng, kind: "restaurant", label: order.restaurant.name },
    { id: "h", lat: home.lat, lng: home.lng, kind: "home", label: "You" },
    ...(riderPos && order.rider ? [{ id: "rider", lat: riderPos.lat, lng: riderPos.lng, kind: "rider" as const, label: order.rider.name, rotation: riderPos.heading }] : []),
  ];

  return (
    <div className="space-y-4" data-testid="order-tracker">
      {active ? (
        <Card className="overflow-hidden">
          <div className="bg-success p-5 text-white">
            <p className="text-sm text-white/85">{statusMeta[order.status].label}</p>
            <p className="font-display text-3xl font-extrabold" data-testid="eta">
              {arriving ? "Arriving now" : `Arriving in ${etaMins} min`}
            </p>
            <p className="text-sm text-white/85">{order.restaurant.name}</p>
          </div>
          <Map center={home} fit markers={markers} route={riderPos ? [riderPos, order.status === "OUT_FOR_DELIVERY" || order.status === "PICKED_UP" ? home : order.restaurant] : undefined} className="h-72 w-full rounded-none border-0" />
        </Card>
      ) : null}

      {active && (order.status === "OUT_FOR_DELIVERY" || order.status === "PICKED_UP" || order.rider_id) ? (
        <Card className="flex items-center justify-between gap-3 border-2 border-dashed border-primary p-4" data-testid="delivery-otp">
          <div className="flex items-center gap-3">
            <KeyRound className="size-6 text-primary" />
            <div>
              <p className="font-semibold">Delivery OTP</p>
              <p className="text-xs text-muted-foreground">Share this with your rider only at your door</p>
            </div>
          </div>
          <span className="font-mono text-2xl font-extrabold tracking-[0.3em]">{order.delivery_otp}</span>
        </Card>
      ) : null}

      {order.rider && active ? (
        <Card className="flex items-center gap-3 p-4" data-testid="rider-card">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-xl" aria-hidden>
            🛵
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{order.rider.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {order.rider.vehicle_type.replace("_", " ")} · {order.rider.vehicle_number} ·{" "}
              <span className="inline-flex items-center gap-0.5">
                {order.rider.rating} <Star className="size-3 fill-amber-400 text-amber-400" />
              </span>
            </p>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <ChatButton orderId={order.id} thread="customer_rider" as="customer" myId={me} title={`Chat with ${order.rider.name}`} />
            <MaskedCallButton who={order.rider.name} />
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="mb-4 font-semibold">{bad ? statusMeta[order.status].label : "Order status"}</h2>
        {bad ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="size-5" /> {statusMeta[order.status].label} at {fmt(order.cancelled_at)}
          </p>
        ) : order.status === "SCHEDULED" ? (
          <p className="flex items-center gap-2 text-sm">
            <Clock className="size-5 text-primary" /> Scheduled for {new Date(order.scheduled_for!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : (
          <ol className="relative space-y-4" aria-label="Order progress">
            {steps.map((s, i) => {
              const done = i <= currentIdx;
              const Icon = s.icon;
              return (
                <li key={s.key} className="relative flex gap-3" aria-current={i === currentIdx ? "step" : undefined}>
                  {i < steps.length - 1 ? <span className={cn("absolute top-7 left-3.5 h-[calc(100%-4px)] w-0.5", i < currentIdx ? "bg-success" : "bg-muted")} aria-hidden /> : null}
                  <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full", done ? "bg-success text-white" : "bg-muted text-muted-foreground", i === currentIdx && active && "ring-4 ring-success/25")}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="pt-0.5">
                    <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>{s.label}</p>
                    {s.at && done ? <p className="text-xs text-muted-foreground">{fmt(s.at)}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {active ? <ChatButton orderId={order.id} thread="customer_restaurant" as="customer" myId={me} title={`Chat with ${order.restaurant.name}`} label="Message restaurant" /> : null}
        <Button asChild variant="outline" size="sm">
          <Link href={`/help?order=${order.id}`}>
            <LifeBuoy /> Help with this order
          </Link>
        </Button>
        {cancellable ? (
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelOpen(true)}>
            <XCircle /> Cancel order
          </Button>
        ) : null}
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {order.status === "PLACED" || order.status === "SCHEDULED"
                ? "The restaurant hasn't started yet, so you'll get a full refund to your Thaali wallet."
                : "The restaurant has already started preparing your food, so this cancellation isn't refundable. The food will be offered nearby at a discount through Food Rescue so it doesn't go to waste."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startCancel(async () => {
                  const res = await cancelMyOrder(order.id, "Changed my mind");
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Order cancelled", { description: res.message });
                  router.refresh();
                })
              }
            >
              {cancelling ? <Loader2 className="animate-spin" /> : null} Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
