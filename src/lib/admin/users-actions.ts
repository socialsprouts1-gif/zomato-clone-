"use server";

import { z } from "zod";
import { adminAction, AdminError } from "@/lib/admin/guard";
import { notify } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

const id = z.string().uuid();
const paths = (uid: string) => ["/admin/users", `/admin/users/${uid}`];

async function load(userId: string) {
  const { data, error } = await getSupabaseAdminClient().from("profiles").select("id, name, email, phone, role, is_blocked").eq("id", id.parse(userId)).maybeSingle();
  if (error) throw new AdminError(error.message);
  if (!data) throw new AdminError("User not found");
  return data;
}

export async function setUserBlocked(userId: string, blocked: boolean, reason?: string) {
  return adminAction(async (admin) => {
    const u = await load(userId);
    if (u.id === admin.id) throw new AdminError("You can't block your own account");
    if (u.role === "admin" && blocked) throw new AdminError("Admins can't be blocked here");
    const why = blocked ? z.string().trim().min(3, "Give a reason").max(300).parse(reason ?? "") : undefined;
    const db = getSupabaseAdminClient();
    const { error } = await db.from("profiles").update({ is_blocked: blocked }).eq("id", u.id);
    if (error) throw new AdminError(error.message);
    // A blocked rider shouldn't keep receiving offers.
    if (blocked && u.role === "rider") await db.from("riders").update({ is_online: false }).eq("id", u.id);
    if (!blocked) await notify(u.id, { title: "Your account is active again", body: "You can order on Thaali again.", link: "/", type: "info" });
    return {
      audit: {
        action: blocked ? "user.block" : "user.unblock",
        entityType: "user",
        entityId: u.id,
        details: { name: u.name, email: u.email, ...(why ? { reason: why } : {}) },
      },
    };
  }, paths(userId));
}

const creditSchema = z.object({
  rupees: z.number().int("Whole rupees only").min(1, "At least ₹1").max(10000, "At most ₹10,000 per credit"),
  note: z.string().trim().min(3, "Add a note").max(140),
});

/** Adds Thaali Money to a user's wallet (wallet_apply, type admin_credit) and notifies them. */
export async function creditWallet(userId: string, input: z.input<typeof creditSchema>) {
  return adminAction(async () => {
    const u = await load(userId);
    const v = creditSchema.parse(input);
    const paise = v.rupees * 100;
    const { data: balance, error } = await getSupabaseAdminClient().rpc("wallet_apply", { p_user: u.id, p_amount: paise, p_type: "admin_credit", p_description: v.note });
    if (error) throw new AdminError(error.message);
    await notify(u.id, { title: `${formatPaise(paise)} added to your Thaali Money`, body: v.note, link: "/account", type: "offer" });
    return {
      data: { balance: Number(balance) },
      audit: { action: "wallet.credit", entityType: "user", entityId: u.id, details: { name: u.name, email: u.email, amount_paise: paise, note: v.note, balance_after_paise: Number(balance) } },
    };
  }, paths(userId));
}
