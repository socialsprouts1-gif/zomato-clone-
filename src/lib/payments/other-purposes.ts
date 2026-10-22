import "server-only";

import type { PaymentPurpose } from "./razorpay";

/**
 * Non-order payments (Gold, events, dining bills, wallet top-ups, healthy plans).
 * Each purpose lives in ./purposes/<purpose>.ts and exports onSuccess / onFailure; both must be idempotent
 * because the client callback and the Razorpay webhook can both report the same payment.
 */
type PurposeModule = {
  onSuccess: (referenceId: string, paymentId: string) => Promise<void>;
  onFailure: (referenceId: string, reason: string) => Promise<void>;
};

async function load(purpose: PaymentPurpose): Promise<PurposeModule> {
  try {
    return (await import(`./purposes/${purpose}`)) as PurposeModule;
  } catch {
    throw new Error(`No payment handler for ${purpose}`);
  }
}

export async function onOtherPaymentSuccess(purpose: PaymentPurpose, referenceId: string, paymentId: string) {
  await (await load(purpose)).onSuccess(referenceId, paymentId);
}

export async function onOtherPaymentFailure(purpose: PaymentPurpose, referenceId: string, reason: string) {
  await (await load(purpose)).onFailure(referenceId, reason);
}
