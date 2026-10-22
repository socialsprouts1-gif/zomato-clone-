"use server";

import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import { notify, notifyRestaurantTeam } from "@/lib/notifications";
import { generatePayouts } from "@/lib/payouts";
import { formatPeriod, isIsoDate, todayIst, weekOf } from "@/lib/payouts/dates";
import { generateRiderPayouts } from "@/lib/payouts/riders";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

const PATHS = ["/admin/payouts", "/partner/payouts"];

/**
 * Generates (or refreshes) the Mon–Sun statements for every approved restaurant and rider for the
 * week containing `weekDate`. Idempotent: unpaid statements are recomputed (adjustments kept), paid ones never change.
 */
export async function generateStatements(weekDate: string) {
  return adminAction(async () => {
    if (!isIsoDate(weekDate)) throw new Error("Pick a week");
    const period = weekOf(weekDate);
    if (period.end >= todayIst()) throw new Error("That week hasn't finished yet");
    const restaurants = await generatePayouts(period);
    const riders = await generateRiderPayouts(period);
    const all = [...restaurants.payouts, ...riders.payouts];
    return {
      data: { restaurants: restaurants.payouts.length, riders: riders.payouts.length },
      audit: {
        action: "payout.generate",
        entityType: "payout_week",
        entityId: period.start,
        details: {
          period,
          restaurants: restaurants.payouts.length,
          riders: riders.payouts.length,
          paid_untouched: all.filter((p) => p.status === "paid").length,
          total_net_paise: all.reduce((s, p) => s + p.net_paise, 0),
        },
      },
    };
  }, PATHS);
}

async function payoutWithPayee(id: string) {
  const { data: p } = await getSupabaseAdminClient().from("payouts").select("*, restaurants(name), riders(name)").eq("id", id).maybeSingle();
  if (!p) throw new Error("Statement not found");
  return { ...p, payee: p.payee_type === "rider" ? (p.riders?.name ?? "Rider") : (p.restaurants?.name ?? "Restaurant") };
}

export async function addPayoutAdjustment(payoutId: string, amountPaise: number, note: string) {
  return adminAction(async (admin) => {
    const id = z.string().uuid().parse(payoutId);
    const amount = z.number().int().refine((n) => n !== 0, "Enter a non-zero amount").refine((n) => Math.abs(n) <= 10_000_000, "That's too large").parse(amountPaise);
    const text = z.string().trim().min(3, "Add a note").max(300).parse(note);
    const before = await payoutWithPayee(id);
    if (before.status === "paid") throw new Error("Paid statements can't be changed");
    const { data: after, error } = await getSupabaseAdminClient().rpc("add_payout_adjustment", { p_payout: id, p_amount: amount, p_note: text, p_admin: admin.id });
    if (error || !after) throw new Error(error?.message ?? "Couldn't add the adjustment");
    return {
      audit: {
        action: "payout.adjust",
        entityType: before.payee_type,
        entityId: before.payee_type === "rider" ? before.rider_id : before.restaurant_id,
        details: { payout_id: id, payee: before.payee, period_start: before.period_start, amount_paise: amount, note: text, net_before_paise: before.net_paise, net_after_paise: after.net_paise },
      },
    };
  }, [...PATHS, `/admin/payouts/${payoutId}`]);
}

export async function markPayoutPaid(payoutId: string) {
  return adminAction(async () => {
    const id = z.string().uuid().parse(payoutId);
    const before = await payoutWithPayee(id);
    if (before.status === "paid") throw new Error("This statement is already paid");
    const { data: p, error } = await getSupabaseAdminClient().rpc("mark_payout_paid", { p_payout: id });
    if (error || !p) throw new Error(error?.message ?? "Couldn't mark it paid");
    const period = formatPeriod({ start: p.period_start, end: p.period_end });
    if (p.payee_type === "restaurant" && p.restaurant_id) {
      await notifyRestaurantTeam(p.restaurant_id, { title: "Payout sent", body: `${formatPaise(p.net_paise)} for ${period}`, link: `/partner/payouts/${p.id}`, type: "partner" });
    } else if (p.rider_id) {
      await notify(p.rider_id, { title: p.net_paise >= 0 ? "Payout sent" : "Weekly statement settled", body: `${formatPaise(p.net_paise)} for ${period}`, link: "/rider/earnings", type: "rider" });
    }
    return {
      audit: {
        action: "payout.mark_paid",
        entityType: p.payee_type,
        entityId: p.payee_type === "rider" ? p.rider_id : p.restaurant_id,
        details: { payout_id: id, payee: before.payee, period_start: p.period_start, period_end: p.period_end, net_paise: p.net_paise, cash_settled_paise: p.cash_held_paise },
      },
    };
  }, [...PATHS, `/admin/payouts/${payoutId}`, "/rider/earnings", "/rider/profile"]);
}
