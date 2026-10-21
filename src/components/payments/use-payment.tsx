"use client";

import { Building2, CreditCard, Loader2, Smartphone, Wallet } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { completeDemoPayment, reportPaymentDismissed, verifyRazorpayPayment } from "@/lib/payments/actions";
import type { PaymentIntent } from "@/lib/payments/razorpay";
import { cn, formatPaise } from "@/lib/utils";

type Outcome = { ok: true } | { ok: false; error: string };

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
type RazorpayCtor = new (opts: Record<string, unknown>) => RazorpayInstance;

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => reject(new Error("Couldn't reach Razorpay. Check your connection."));
    document.body.appendChild(s);
  });
}

const DEMO_METHODS = [
  { id: "upi", label: "UPI (any app)", icon: Smartphone, hint: "success@razorpay" },
  { id: "card", label: "Card", icon: CreditCard, hint: "4111 1111 1111 1111" },
  { id: "netbanking", label: "Netbanking", icon: Building2, hint: "Test bank" },
  { id: "wallet", label: "Wallets", icon: Wallet, hint: "Test wallet" },
] as const;

/**
 * Opens Razorpay test checkout, or the demo checkout when keys aren't configured.
 * Resolves after the server has verified (or rejected) the payment.
 */
export function usePayment() {
  const [demo, setDemo] = useState<PaymentIntent | null>(null);
  const [method, setMethod] = useState<string>("upi");
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((o: Outcome) => void) | null>(null);

  const pay = useCallback(async (intent: PaymentIntent): Promise<Outcome> => {
    if (intent.mode === "demo") {
      setMethod(intent.method ?? "upi");
      setDemo(intent);
      return new Promise<Outcome>((resolve) => {
        resolver.current = resolve;
      });
    }
    const Razorpay = await loadRazorpay();
    return new Promise<Outcome>((resolve) => {
      let settled = false;
      const rzp = new Razorpay({
        key: intent.keyId,
        order_id: intent.providerOrderId,
        amount: intent.amountPaise,
        currency: "INR",
        name: "Thaali",
        description: intent.description,
        prefill: intent.prefill,
        theme: { color: "#F97316" },
        ...(intent.method ? { config: { display: { preferences: { show_default_blocks: true }, sequence: [`block.${intent.method}`], blocks: { [intent.method]: { name: "Pay", instruments: [{ method: intent.method }] } } } } } : {}),
        handler: async (r: RazorpayResponse) => {
          settled = true;
          const res = await verifyRazorpayPayment({ purpose: intent.purpose, referenceId: intent.referenceId, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature });
          resolve(res.ok ? { ok: true } : { ok: false, error: res.error });
        },
        modal: {
          ondismiss: async () => {
            if (settled) return;
            settled = true;
            await reportPaymentDismissed({ purpose: intent.purpose, referenceId: intent.referenceId });
            resolve({ ok: false, error: "Payment cancelled" });
          },
        },
      });
      rzp.on("payment.failed", (r) => {
        if (settled) return;
        settled = true;
        void reportPaymentDismissed({ purpose: intent.purpose, referenceId: intent.referenceId });
        resolve({ ok: false, error: r.error?.description ?? "Payment failed" });
      });
      rzp.open();
    });
  }, []);

  async function finishDemo(outcome: "success" | "failure") {
    if (!demo) return;
    setBusy(true);
    const res = await completeDemoPayment({ purpose: demo.purpose, referenceId: demo.referenceId, outcome, method });
    setBusy(false);
    setDemo(null);
    resolver.current?.(res.ok ? { ok: true } : { ok: false, error: res.error });
    resolver.current = null;
  }

  const ui = (
    <Sheet
      open={Boolean(demo)}
      onOpenChange={(o) => {
        if (!o && demo && !busy) void finishDemo("failure");
      }}
    >
      <SheetContent side="bottom" className="mx-auto max-w-md pb-6" data-testid="demo-payment">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>Pay {demo ? formatPaise(demo.amountPaise) : ""}</SheetTitle>
            <DemoBadge label="Demo payment" />
          </div>
          <SheetDescription>
            {demo?.description}. Razorpay keys aren&apos;t configured, so this simulates the Razorpay test checkout. No money moves.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 px-5">
          {DEMO_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              aria-pressed={method === m.id}
              className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3 text-left", method === m.id && "border-primary bg-secondary")}
            >
              <m.icon className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 px-5">
          <Button variant="outline" disabled={busy} onClick={() => finishDemo("failure")}>
            Simulate failure
          </Button>
          <Button disabled={busy} onClick={() => finishDemo("success")}>
            {busy ? <Loader2 className="animate-spin" /> : null} Pay now
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return { pay, ui };
}
