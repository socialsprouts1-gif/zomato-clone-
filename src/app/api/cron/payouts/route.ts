import { NextResponse, type NextRequest } from "next/server";
import { generatePayouts } from "@/lib/payouts";
import { generateRiderPayouts } from "@/lib/payouts/riders";
import { isIsoDate, lastCompleteWeek, todayIst, weekOf } from "@/lib/payouts/dates";

/**
 * Weekly payouts (Vercel Cron, Monday 01:00 IST): generates last week's Mon–Sun statement
 * for every approved restaurant and rider. Idempotent. `?week=YYYY-MM-DD` regenerates the week containing that date.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const week = req.nextUrl.searchParams.get("week");
  if (week !== null && !isIsoDate(week)) return NextResponse.json({ error: "week must be YYYY-MM-DD" }, { status: 400 });
  const period = week ? weekOf(week) : lastCompleteWeek();
  if (period.end >= todayIst()) return NextResponse.json({ error: "That week hasn't finished yet" }, { status: 400 });
  const { payouts } = await generatePayouts(period);
  const riders = await generateRiderPayouts(period);
  return NextResponse.json({ ok: true, period, generated: payouts.length, riders: riders.payouts.length });
}
