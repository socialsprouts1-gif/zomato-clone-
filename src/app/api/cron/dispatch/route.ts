import { NextResponse, type NextRequest } from "next/server";
import { tickOrders } from "@/lib/orders/simulation";

/** Safety net (Vercel Cron, every minute): dispatch and advance deliveries even with no screen open. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tickOrders();
  return NextResponse.json({ ok: true });
}
