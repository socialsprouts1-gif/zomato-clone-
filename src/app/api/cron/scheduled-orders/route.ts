import { NextResponse, type NextRequest } from "next/server";
import { promoteDueScheduledOrders } from "@/lib/checkout/finalize";

/** Vercel Cron (every 5 min, see vercel.json): SCHEDULED → PLACED at slot − 45 min. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ promoted: await promoteDueScheduledOrders() });
}
