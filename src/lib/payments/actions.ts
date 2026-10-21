"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { onPaymentFailure, onPaymentSuccess } from "./handlers";
import { paymentMode, verifyPaymentSignature, type PaymentPurpose } from "./razorpay";

const purposeSchema = z.enum(["order", "gold", "event", "dining", "wallet_topup", "healthy", "ad_budget"]);

/** Razorpay checkout success callback: verify the signature on the server, then fulfil. */
export async function verifyRazorpayPayment(input: { purpose: PaymentPurpose; referenceId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  const purpose = purposeSchema.parse(input.purpose);
  if (!verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    await onPaymentFailure(purpose, input.referenceId, "Signature verification failed");
    return { ok: false as const, error: "We couldn't verify this payment. No order was placed." };
  }
  await onPaymentSuccess(purpose, input.referenceId, input.razorpayPaymentId);
  return { ok: true as const };
}

/** Demo checkout (no Razorpay keys): the presenter picks success or failure. */
export async function completeDemoPayment(input: { purpose: PaymentPurpose; referenceId: string; outcome: "success" | "failure"; method: string }) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in again." };
  if (paymentMode() !== "demo") return { ok: false as const, error: "Demo payments are disabled when Razorpay is configured." };
  const purpose = purposeSchema.parse(input.purpose);
  if (input.outcome === "failure") {
    await onPaymentFailure(purpose, input.referenceId, `Demo ${input.method} payment declined`);
    return { ok: false as const, error: "Payment failed. You haven't been charged." };
  }
  await onPaymentSuccess(purpose, input.referenceId, `pay_demo_${Date.now().toString(36)}`);
  return { ok: true as const };
}

export async function reportPaymentDismissed(input: { purpose: PaymentPurpose; referenceId: string }) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const };
  await onPaymentFailure(purposeSchema.parse(input.purpose), input.referenceId, "Payment cancelled");
  return { ok: true as const };
}
