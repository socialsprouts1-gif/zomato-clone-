"use client";

import { Ban, CheckCircle2, MapPinOff, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfirmAction, useAdminAct } from "@/components/admin/restaurants/admin-act";
import { ReasonDialog } from "@/components/admin/restaurants/reason-dialog";
import { Map } from "@/components/maps/map";
import { Button } from "@/components/ui/button";
import { approveRider, fetchRiderPosition, rejectRider, suspendRider, unsuspendRider, type RiderLivePosition } from "@/lib/admin/riders-actions";

export function RiderStatusActions({ id, name, status }: { id: string; name: string; status: string }) {
  const { pending, act } = useAdminAct();
  if (status === "pending" || status === "rejected") {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfirmAction
          label="Approve"
          icon={<CheckCircle2 aria-hidden />}
          title={`Approve ${name}?`}
          description="They can go online and receive delivery offers straight away. We'll notify them."
          confirmLabel="Approve rider"
          success={`${name} is approved`}
          run={() => approveRider(id)}
        />
        {status === "pending" ? (
          <ReasonDialog
            trigger={
              <Button variant="outline">
                <XCircle aria-hidden /> Reject
              </Button>
            }
            title={`Reject ${name}?`}
            description="The applicant sees this reason in their notifications."
            confirmLabel="Reject application"
            presets={["Driving licence is unreadable", "Vehicle RC doesn't match", "Bank details are invalid"]}
            pending={pending}
            onConfirm={(reason) => act(() => rejectRider(id, reason), "Application rejected")}
          />
        ) : null}
      </div>
    );
  }
  if (status === "approved") {
    return (
      <ReasonDialog
        trigger={
          <Button variant="destructive">
            <Ban aria-hidden /> Suspend
          </Button>
        }
        title={`Suspend ${name}?`}
        description="They go offline at once and stop receiving offers until you lift the suspension."
        confirmLabel="Suspend rider"
        presets={["Repeated late deliveries", "Customer safety complaint", "Cash not deposited"]}
        pending={pending}
        onConfirm={(reason) => act(() => suspendRider(id, reason), `${name} is suspended`)}
      />
    );
  }
  return (
    <ConfirmAction
      label="Lift suspension"
      icon={<RotateCcw aria-hidden />}
      title={`Lift the suspension on ${name}?`}
      description="They can go online and take deliveries again."
      confirmLabel="Lift suspension"
      success={`${name} is active again`}
      run={() => unsuspendRider(id)}
    />
  );
}

const ago = (iso: string | null) => {
  if (!iso) return "time unknown";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
};

/** Latest rider position, refreshed every 10 seconds while the page is open. */
export function RiderLiveMap({ riderId, initial }: { riderId: string; initial: RiderLivePosition }) {
  const [pos, setPos] = useState(initial);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        setPos(await fetchRiderPosition(riderId));
      } catch {
        // keep the last known position on a transient error
      }
      tick((n) => n + 1);
    }, 10_000);
    return () => clearInterval(t);
  }, [riderId]);

  if (!pos) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground">
        <MapPinOff className="size-6" aria-hidden /> No location shared yet
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="rider-live-map">
      <Map center={pos} zoom={15} markers={[{ id: "rider", kind: "rider", lat: pos.lat, lng: pos.lng, label: "Rider" }]} className="h-56 w-full" />
      <p className="text-xs text-muted-foreground">
        {pos.isOnline ? "Online" : "Offline"} · last seen {ago(pos.at)} · {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
        {pos.currentOrderId ? (
          <>
            {" · "}
            <Link href={`/admin/orders/${pos.currentOrderId}`} className="font-semibold text-primary underline">
              Current order
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
