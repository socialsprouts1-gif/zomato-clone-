import { NextResponse, type NextRequest } from "next/server";
import { onPaymentFailure, onPaymentSuccess } from "@/lib/payments/handlers";
import { verifyWebhookSignature, type PaymentPurpose } from "@/lib/payments/razorpay";

type Entity = { id: string; order_id: string; notes?: { purpose?: PaymentPurpose; reference_id?: string }; error_description?: string };

/** Razorpay webhook: payment.captured / payment.failed. Configure the URL and secret in the Razorpay dashboard. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  const body = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: Entity } } };
  const p = body.payload?.payment?.entity;
  const purpose = p?.notes?.purpose;
  const ref = p?.notes?.reference_id;
  if (!p || !purpose || !ref) return NextResponse.json({ ok: true, ignored: true });
  if (body.event === "payment.captured") await onPaymentSuccess(purpose, ref, p.id);
  else if (body.event === "payment.failed") await onPaymentFailure(purpose, ref, p.error_description ?? "Payment failed");
  return NextResponse.json({ ok: true });
}
