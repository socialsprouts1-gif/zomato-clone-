import "server-only";

import type { PaymentPurpose } from "./razorpay";

/**
 * Called once a payment is confirmed (checkout handler, webhook or demo checkout).
 * Each handler must be idempotent: the webhook and the client can both report the same payment.
 */
export async function onPaymentSuccess(purpose: PaymentPurpose, referenceId: string, paymentId: string) {
  switch (purpose) {
    case "order": {
      const { finalizePaidOrder } = await import("@/lib/checkout/finalize");
      return finalizePaidOrder(referenceId, paymentId);
    }
    default: {
      const { onOtherPaymentSuccess } = await import("./other-purposes");
      return onOtherPaymentSuccess(purpose, referenceId, paymentId);
    }
  }
}

export async function onPaymentFailure(purpose: PaymentPurpose, referenceId: string, reason: string) {
  switch (purpose) {
    case "order": {
      const { markOrderPaymentFailed } = await import("@/lib/checkout/finalize");
      return markOrderPaymentFailed(referenceId, reason);
    }
    default: {
      const { onOtherPaymentFailure } = await import("./other-purposes");
      return onOtherPaymentFailure(purpose, referenceId, reason);
    }
  }
}
