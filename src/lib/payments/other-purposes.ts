import "server-only";

import type { PaymentPurpose } from "./razorpay";

/** Gold, events, dining bills, wallet top-ups, healthy plans and ad budgets (filled in Phase 10). */
export async function onOtherPaymentSuccess(purpose: PaymentPurpose, referenceId: string, paymentId: string) {
  throw new Error(`No payment handler for ${purpose} (${referenceId}, ${paymentId})`);
}

export async function onOtherPaymentFailure(purpose: PaymentPurpose, referenceId: string, reason: string) {
  void purpose;
  void referenceId;
  void reason;
}
