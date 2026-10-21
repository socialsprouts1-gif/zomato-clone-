import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getServerEnv, publicEnv } from "@/lib/env";

export type PaymentPurpose = "order" | "gold" | "event" | "dining" | "wallet_topup" | "healthy" | "ad_budget";

/** Razorpay test mode when keys are set; otherwise a labelled demo checkout. */
export function paymentMode(): "razorpay" | "demo" {
  return publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID && getServerEnv().RAZORPAY_KEY_SECRET ? "razorpay" : "demo";
}

export type PaymentIntent = {
  mode: "razorpay" | "demo";
  purpose: PaymentPurpose;
  referenceId: string;
  providerOrderId: string;
  amountPaise: number;
  keyId?: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
  method?: "upi" | "card" | "netbanking" | "wallet";
};

export async function createProviderOrder(opts: { purpose: PaymentPurpose; referenceId: string; amountPaise: number; receipt: string }): Promise<string> {
  if (paymentMode() === "demo") return `order_demo_${randomBytes(8).toString("hex")}`;
  const { RAZORPAY_KEY_SECRET } = getServerEnv();
  const auth = Buffer.from(`${publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: opts.amountPaise,
      currency: "INR",
      receipt: opts.receipt.slice(0, 40),
      notes: { purpose: opts.purpose, reference_id: opts.referenceId },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return json.id;
}

function safeEqualHex(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Checkout handler signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(providerOrderId: string, paymentId: string, signature: string) {
  const secret = getServerEnv().RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${providerOrderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = getServerEnv().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
