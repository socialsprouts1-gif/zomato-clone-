"use client";

import { AlertOctagon, Bike, CheckCircle2, ExternalLink, IndianRupee, Loader2, MapPin, Navigation, Package, Power, Store, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChatButton } from "@/components/chat/chat-sheet";
import { Map } from "@/components/maps/map";
import { DemoBadge } from "@/components/shared/demo-badge";
import { MaskedCallButton } from "@/components/shared/masked-call";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useAlertSound } from "@/hooks/use-alert-sound";
import { useRealtime } from "@/hooks/use-realtime";
import {
  completeDelivery,
  confirmPickup,
  reachedRestaurant,
  respondToOffer,
  setRiderOnline,
  simulateRiderStep,
  startDelivery,
  triggerSos,
  updateRiderLocation,
} from "@/lib/rider/actions";
import type { RiderHome as RiderHomeData } from "@/lib/rider/data";
import { cn, formatPaise } from "@/lib/utils";

const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=two-wheeler`;

export function RiderHome({ data, demoMode }: { data: RiderHomeData; demoMode: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const rider = data.rider!;
  const [online, setOnline] = useState(rider.is_online);
  const [sosOpen, setSosOpen] = useState(false);
  const sound = useAlertSound();
  const refresh = useCallback(() => router.refresh(), [router]);

  useRealtime(`rider:${rider.id}`, [
    { table: "rider_offers", filter: `rider_id=eq.${rider.id}` },
    { table: "orders", filter: `rider_id=eq.${rider.id}` },
  ], refresh, 8000);

  // Ring for incoming requests.
  useEffect(() => {
    if (data.offers.length && sound.enabled) sound.start();
    else sound.stop();
  }, [data.offers.length, sound]);

  // Real GPS while online (unless simulating in demo mode).
  const [simulate, setSimulate] = useState(demoMode);
  const lastSent = useRef(0);
  useEffect(() => {
    if (!online || simulate || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - lastSent.current < 8000) return;
        lastSent.current = Date.now();
        void updateRiderLocation({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading ?? undefined }, data.active?.id ?? null);
      },
      () => setSimulate(true),
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [online, simulate, data.active?.id]);

  function toggleOnline(v: boolean) {
    setOnline(v);
    void sound.enable();
    start(async () => {
      const res = await setRiderOnline(v);
      if (!res.ok) {
        setOnline(!v);
        return void toast.error(res.error);
      }
      toast.success(v ? "You're online. Requests will appear here." : "You're offline");
      router.refresh();
    });
  }

  const progress = Math.min(100, (data.todayTrips / data.target.rider_daily_target_orders) * 100);

  return (
    <div className="space-y-4">
      <Card className={cn("flex items-center gap-4 p-4", online ? "border-success bg-success/5" : "")}>
        <span className={cn("flex size-12 items-center justify-center rounded-full", online ? "bg-success text-white" : "bg-muted text-muted-foreground")}>
          <Power className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold">{online ? "You're online" : "You're offline"}</p>
          <p className="text-sm text-muted-foreground">{online ? "Waiting for delivery requests near you" : "Go online to start receiving orders"}</p>
        </div>
        <Switch checked={online} onCheckedChange={toggleOnline} disabled={pending} aria-label="Go online" className="data-[state=checked]:bg-success scale-125" />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <IndianRupee className="size-3" /> Today&apos;s earnings
          </p>
          <p className="font-display text-xl font-bold">{formatPaise(data.todayEarnings)}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <IndianRupee className="size-3" /> Cash in hand
          </p>
          <p className="font-display text-xl font-bold">{formatPaise(rider.floating_cash_paise)}</p>
        </Card>
      </div>
      <Card className="space-y-2 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-primary" /> Complete {data.target.rider_daily_target_orders} orders today for {formatPaise(data.target.rider_daily_target_bonus_paise)} bonus
        </p>
        <Progress value={progress} aria-label="Daily target progress" />
        <p className="text-xs text-muted-foreground">
          {data.todayTrips} of {data.target.rider_daily_target_orders} done
        </p>
      </Card>

      {online && data.offers.length && !data.active ? <OfferCard offer={data.offers[0]!} onDone={refresh} /> : null}
      {data.active ? <DeliveryFlow order={data.active} me={rider.id} simulate={simulate} setSimulate={setSimulate} demoMode={demoMode} onChange={refresh} /> : null}
      {online && !data.active && !data.offers.length ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Bike className="size-10 animate-bounce text-primary" />
          <p className="font-semibold">Looking for orders near you…</p>
          <p className="text-sm text-muted-foreground">Stay in busy areas like Koregaon Park or Baner for more requests.</p>
        </Card>
      ) : null}

      <Button variant="destructive" className="w-full" onClick={() => setSosOpen(true)}>
        <AlertOctagon /> SOS · Emergency
      </Button>
      <Dialog open={sosOpen} onOpenChange={setSosOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emergency help</DialogTitle>
            <DialogDescription>We&apos;ll alert the Thaali safety team with your live location. In danger, call 112 now.</DialogDescription>
          </DialogHeader>
          <DemoBadge label="Demo: no real call is made" />
          <DialogFooter>
            <Button variant="outline" asChild>
              <a href="tel:112">Call 112</a>
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                start(async () => {
                  await triggerSos(data.active?.id ?? null);
                  setSosOpen(false);
                  toast.success("Safety team alerted. Someone will call you right away.");
                })
              }
            >
              Alert safety team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferCard({ offer, onDone }: { offer: RiderHomeData["offers"][number]; onDone: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 1000)));
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) onDone();
    }, 500);
    return () => clearInterval(t);
  }, [offer.expires_at, onDone]);

  function respond(accept: boolean) {
    start(async () => {
      const res = await respondToOffer(offer.id, accept);
      if (!res.ok) toast.error(res.error);
      else toast.success(accept ? "Order accepted. Head to the restaurant." : "Request declined");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 border-2 border-primary p-5 shadow-lg" data-testid="rider-offer" role="alertdialog" aria-label="New delivery request">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-bold">New delivery request</p>
        <span className="relative flex size-12 items-center justify-center">
          <svg className="absolute size-12 -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--muted)" strokeWidth="3" />
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray={`${(left / 30) * 100.5} 100.5`} />
          </svg>
          <span className="text-sm font-bold tabular-nums" aria-label={`${left} seconds left`}>
            {left}
          </span>
        </span>
      </div>
      <div className="flex items-start gap-3">
        <Store className="mt-0.5 size-5 text-primary" />
        <div>
          <p className="font-semibold">{offer.restaurant_name}</p>
          <p className="text-sm text-muted-foreground">{offer.restaurant_locality} · pickup {Number(offer.pickup_km).toFixed(1)} km away</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 size-5 text-primary" />
        <p className="text-sm">Drop {Number(offer.drop_km).toFixed(1)} km from restaurant</p>
      </div>
      <p className="rounded-xl bg-success/10 p-3 text-center text-lg font-bold text-success">Earn {formatPaise(offer.estimated_earning_paise)}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={pending} onClick={() => respond(false)}>
          Reject
        </Button>
        <Button disabled={pending} onClick={() => respond(true)}>
          {pending ? <Loader2 className="animate-spin" /> : null} Accept
        </Button>
      </div>
    </Card>
  );
}

function DeliveryFlow({
  order,
  me,
  simulate,
  setSimulate,
  demoMode,
  onChange,
}: {
  order: NonNullable<RiderHomeData["active"]>;
  me: string;
  simulate: boolean;
  setSimulate: (v: boolean) => void;
  demoMode: boolean;
  onChange: () => void;
}) {
  const [pending, start] = useTransition();
  const [orderId4, setOrderId4] = useState("");
  const [otp, setOtp] = useState("");
  const [cash, setCash] = useState(false);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const r = order.restaurants!;
  const home = order.delivery_address as { lat: number; lng: number; label?: string; line1?: string; landmark?: string };
  const instr = order.delivery_instructions as { avoidCalling?: boolean; leaveAtDoor?: boolean; directions?: string };
  const toCustomer = order.status === "PICKED_UP" || order.status === "OUT_FOR_DELIVERY";
  const atRestaurant = Boolean(order.rider_at_restaurant_at);
  const foodReady = order.status === "READY" || order.status === "RIDER_ASSIGNED";
  const cod = order.payment_method === "cod" && order.payable_paise > 0;

  useRealtime(`rider-loc:${order.id}`, [{ table: "rider_locations", filter: `order_id=eq.${order.id}`, event: "INSERT" }], (p) => {
    const row = p?.new as { lat?: number; lng?: number } | undefined;
    if (row?.lat) setRiderPos({ lat: row.lat, lng: row.lng! });
  });

  // Demo GPS: move toward the current target every 2 s.
  useEffect(() => {
    if (!simulate) return;
    const moving = (!atRestaurant && !toCustomer) || order.status === "OUT_FOR_DELIVERY";
    if (!moving) return;
    const t = setInterval(() => void simulateRiderStep(order.id), 2000);
    return () => clearInterval(t);
  }, [simulate, atRestaurant, toCustomer, order.status, order.id]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Couldn't update");
      toast.success(msg);
      onChange();
    });
  }

  const steps = ["To restaurant", "Pick up", "To customer", "Deliver"];
  const step = !atRestaurant && !toCustomer ? 0 : !toCustomer ? 1 : order.status === "PICKED_UP" ? 2 : 3;
  const target = toCustomer ? home : { lat: r.lat, lng: r.lng };

  return (
    <Card className="space-y-4 p-4" data-testid="active-delivery">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-bold">Order #{order.order_number}</p>
          <p className="text-xs text-muted-foreground">{order.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
        </div>
        {demoMode ? (
          <label className="flex items-center gap-2 text-xs font-medium">
            <Navigation className="size-3.5" /> Simulate GPS
            <Switch checked={simulate} onCheckedChange={setSimulate} aria-label="Simulate GPS" />
          </label>
        ) : null}
      </div>
      <ol className="flex gap-1" aria-label="Delivery steps">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <span className={cn("mt-1 block text-[10px] font-semibold", i === step ? "text-primary" : "text-muted-foreground")}>{s}</span>
          </li>
        ))}
      </ol>
      <Map
        center={target}
        fit
        className="h-56 w-full"
        markers={[
          { id: "r", lat: r.lat, lng: r.lng, kind: "restaurant", label: r.name },
          { id: "h", lat: home.lat, lng: home.lng, kind: "home", label: order.customer_name ?? "Customer" },
          ...(riderPos ? [{ id: "me", ...riderPos, kind: "rider" as const, label: "You" }] : []),
        ]}
      />
      <a href={mapsLink(target.lat, target.lng)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-secondary p-3 text-sm font-bold text-secondary-foreground">
        <ExternalLink className="size-4" /> Open in Google Maps
      </a>

      {!toCustomer ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-muted-foreground">{r.address}</p>
              <p className={cn("text-sm font-semibold", foodReady ? "text-success" : "text-amber-600")}>{foodReady ? "Food is ready for pickup" : "Food is being prepared"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <MaskedCallButton who={r.name} />
              <ChatButton orderId={order.id} thread="rider_restaurant" as="rider" myId={me} title={`Chat with ${r.name}`} />
            </div>
          </div>
          {!atRestaurant ? (
            <Button className="w-full" size="lg" disabled={pending} onClick={() => run(() => reachedRestaurant(order.id), "Marked as reached")}>
              <Store /> Reached restaurant
            </Button>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => confirmPickup(order.id, orderId4), "Picked up. Start the delivery when you're on the road.");
              }}
            >
              <Label htmlFor="orderid">Confirm the order ID on the bag (last 4 digits)</Label>
              <div className="flex gap-2">
                <Input id="orderid" inputMode="numeric" maxLength={6} value={orderId4} onChange={(e) => setOrderId4(e.target.value)} placeholder={`…${String(order.order_number).slice(-4)}`} />
                <Button type="submit" disabled={pending || !foodReady || orderId4.length < 3}>
                  <Package /> Picked up
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{order.customer_name ?? "Customer"}</p>
              <p className="text-sm text-muted-foreground">{home.line1}</p>
              {home.landmark ? <p className="text-xs text-muted-foreground">Near {home.landmark}</p> : null}
              {instr.directions || instr.leaveAtDoor || instr.avoidCalling ? (
                <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  {[instr.avoidCalling && "Avoid calling", instr.leaveAtDoor && "Leave at the door", instr.directions].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              {!instr.avoidCalling ? <MaskedCallButton who={order.customer_name ?? "customer"} /> : null}
              <ChatButton orderId={order.id} thread="customer_rider" as="rider" myId={me} title={`Chat with ${order.customer_name ?? "customer"}`} />
            </div>
          </div>
          {order.status === "PICKED_UP" ? (
            <Button className="w-full" size="lg" disabled={pending} onClick={() => run(() => startDelivery(order.id), "On the way to the customer")}>
              <Bike /> Start delivery
            </Button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => completeDelivery(order.id, otp, cash), "Delivered! Great job.");
              }}
            >
              {cod ? (
                <label className="flex items-center gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  <Checkbox checked={cash} onCheckedChange={(v) => setCash(v === true)} aria-label="Cash collected" /> Collect {formatPaise(order.payable_paise)} in cash
                </label>
              ) : (
                <p className="rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">Paid online. Don&apos;t collect cash.</p>
              )}
              <Label htmlFor="otp">Customer&apos;s delivery OTP</Label>
              <div className="flex gap-2">
                <Input id="otp" inputMode="numeric" maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="4-digit code" className="text-center text-lg tracking-[0.5em]" />
                <Button type="submit" disabled={pending || otp.length !== 4}>
                  <CheckCircle2 /> Delivered
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Earning {formatPaise(order.tip_paise)} tip on this order ·{" "}
        <Link href="/rider/earnings" className="font-semibold text-primary">
          Earnings
        </Link>
      </p>
    </Card>
  );
}
