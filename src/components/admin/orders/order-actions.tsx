"use client";

import { Ban, Bike, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { adminCancelOrder, adminReassignRider, adminRefundOrder, listRiderOptions, type RiderOption } from "@/lib/admin/orders-actions";
import { cn, formatPaise } from "@/lib/utils";

export type OrderActionState = {
  orderId: string;
  orderNumber: number;
  canCancel: boolean;
  canReassign: boolean;
  hasRider: boolean;
  /** Amount paid (online + wallet + collected cash) that could be refunded; 0 if already refunded. */
  refundablePaise: number;
  canRefund: boolean;
  onlinePaid: boolean;
  alreadyRefunded: boolean;
};

const CANCEL_REASONS = ["Customer asked support to cancel", "Restaurant can't fulfil the order", "No rider available", "Suspected fraud"];

function Destination({ value, onChange, onlinePaid, idPrefix }: { value: "wallet" | "original"; onChange: (v: "wallet" | "original") => void; onlinePaid: boolean; idPrefix: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Refund to</legend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as "wallet" | "original")}>
        <label htmlFor={`${idPrefix}-wallet`} className="flex items-center gap-3 rounded-xl border p-3 text-sm has-[[data-state=checked]]:border-primary">
          <RadioGroupItem id={`${idPrefix}-wallet`} value="wallet" aria-label="Thaali wallet" />
          <span>Thaali wallet <span className="block text-xs text-muted-foreground">Instant</span></span>
        </label>
        <label htmlFor={`${idPrefix}-original`} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm has-[[data-state=checked]]:border-primary", !onlinePaid && "opacity-50")}>
          <RadioGroupItem id={`${idPrefix}-original`} value="original" disabled={!onlinePaid} aria-label="Original payment method" />
          <span>
            Original payment method
            <span className="block text-xs text-muted-foreground">{onlinePaid ? "Razorpay refund, 5–7 working days. Wallet part goes back to the wallet." : "Only for orders paid online"}</span>
          </span>
        </label>
      </RadioGroup>
    </fieldset>
  );
}

export function OrderActions({ s }: { s: OrderActionState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Cancel
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]!);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelTo, setCancelTo] = useState<"wallet" | "original">("wallet");

  // Refund
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundRupees, setRefundRupees] = useState(String(s.refundablePaise / 100));
  const [refundReason, setRefundReason] = useState("");
  const [refundTo, setRefundTo] = useState<"wallet" | "original">("wallet");

  // Reassign
  const [riderOpen, setRiderOpen] = useState(false);
  const [riders, setRiders] = useState<RiderOption[] | null>(null);
  const [riderId, setRiderId] = useState("");

  async function cancel() {
    setBusy(true);
    const reason = cancelNote.trim() ? `${cancelReason}: ${cancelNote.trim()}` : cancelReason;
    const res = await adminCancelOrder({ orderId: s.orderId, reason, refundTo: cancelTo });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setCancelOpen(false);
    toast.success(res.data?.refunded ? `Order cancelled · ${formatPaise(res.data.refunded)} refunded` : "Order cancelled");
    router.refresh();
  }

  async function refund() {
    const paise = Math.round(Number(refundRupees) * 100);
    if (!Number.isFinite(paise) || paise <= 0) return void toast.error("Enter an amount");
    setBusy(true);
    const res = await adminRefundOrder({ orderId: s.orderId, amountPaise: paise, refundTo, reason: refundReason });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setRefundOpen(false);
    toast.success(`${formatPaise(paise)} refunded`);
    router.refresh();
  }

  async function openRiders() {
    setRiderOpen(true);
    setRiders(null);
    setRiderId("");
    try {
      setRiders(await listRiderOptions(s.orderId));
    } catch {
      setRiders([]);
      toast.error("Couldn't load riders");
    }
  }

  async function reassign() {
    if (!riderId) return void toast.error("Choose a rider");
    setBusy(true);
    const res = await adminReassignRider({ orderId: s.orderId, riderId });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setRiderOpen(false);
    toast.success(`Assigned to ${res.data?.riderName ?? "rider"}`);
    router.refresh();
  }

  const anything = s.canCancel || s.canReassign || s.canRefund;
  if (!anything) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {s.canReassign ? (
        <Button variant="outline" className="gap-2" onClick={() => void openRiders()}>
          <Bike className="size-4" aria-hidden /> {s.hasRider ? "Reassign rider" : "Assign rider"}
        </Button>
      ) : null}
      {s.canRefund ? (
        <Button variant="outline" className="gap-2" onClick={() => setRefundOpen(true)}>
          <Undo2 className="size-4" aria-hidden /> Refund
        </Button>
      ) : null}
      {s.canCancel ? (
        <Button variant="destructive" className="gap-2" onClick={() => setCancelOpen(true)}>
          <Ban className="size-4" aria-hidden /> Cancel order
        </Button>
      ) : null}

      <AlertDialog open={cancelOpen} onOpenChange={(o) => !busy && setCancelOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{s.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              The customer, restaurant and rider are notified.{" "}
              {s.alreadyRefunded ? "This order was already refunded, so no money moves again." : s.refundablePaise > 0 ? `${formatPaise(s.refundablePaise)} paid will be refunded.` : "Nothing was paid yet, so there's nothing to refund."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cancel-reason" className="mb-1.5">Reason</Label>
              <select id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm">
                {CANCEL_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cancel-note" className="mb-1.5">Note (optional)</Label>
              <Textarea id="cancel-note" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} maxLength={200} rows={2} />
            </div>
            {s.refundablePaise > 0 && !s.alreadyRefunded ? <Destination value={cancelTo} onChange={setCancelTo} onlinePaid={s.onlinePaid} idPrefix="cancel" /> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep order</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void cancel()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Cancel and refund
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={refundOpen} onOpenChange={(o) => !busy && setRefundOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund order #{s.orderNumber}</DialogTitle>
            <DialogDescription>Up to {formatPaise(s.refundablePaise)}. An order can be refunded once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="refund-amount" className="mb-1.5">Amount (₹)</Label>
              <Input id="refund-amount" type="number" inputMode="decimal" min={1} max={s.refundablePaise / 100} step="0.01" value={refundRupees} onChange={(e) => setRefundRupees(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="refund-reason" className="mb-1.5">Reason</Label>
              <Textarea id="refund-reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} maxLength={300} rows={2} placeholder="e.g. Items missing from the delivery" />
            </div>
            <Destination value={refundTo} onChange={setRefundTo} onlinePaid={s.onlinePaid} idPrefix="refund" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={busy}>Close</Button>
            <Button onClick={() => void refund()} disabled={busy || refundReason.trim().length < 3}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={riderOpen} onOpenChange={(o) => !busy && setRiderOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s.hasRider ? "Reassign rider" : "Assign rider"}</DialogTitle>
            <DialogDescription>Online riders without a delivery, nearest to the restaurant first.</DialogDescription>
          </DialogHeader>
          {riders === null ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Finding riders…</p>
          ) : riders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No free riders are online right now.</p>
          ) : (
            <RadioGroup value={riderId} onValueChange={setRiderId} aria-label="Riders" className="max-h-80 overflow-y-auto">
              {riders.map((r) => (
                <label key={r.id} htmlFor={`rider-${r.id}`} className="flex items-center gap-3 rounded-xl border p-3 text-sm has-[[data-state=checked]]:border-primary">
                  <RadioGroupItem id={`rider-${r.id}`} value={r.id} aria-label={r.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.name}</span>
                    <span className="block text-xs text-muted-foreground capitalize">{r.vehicle}{r.simulated ? " · simulated" : ""}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{r.distanceKm !== null ? `${r.distanceKm} km` : "location unknown"}</span>
                </label>
              ))}
            </RadioGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiderOpen(false)} disabled={busy}>Close</Button>
            <Button onClick={() => void reassign()} disabled={busy || !riderId}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
