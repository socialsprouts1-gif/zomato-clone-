"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; error: string };

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
  dietary_preference: z.enum(["none", "veg", "vegan", "eggetarian", "non_veg"]),
  avatar_url: z.string().url().nullable().optional(),
});
export type ProfileInput = z.input<typeof profileSchema>;

export async function updateProfile(input: ProfileInput): Promise<Result> {
  const user = await requireUser("/account/profile");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  const { email, ...rest } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...rest, email: email || null, veg_mode: rest.dietary_preference === "veg" || rest.dietary_preference === "vegan" ? true : undefined })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/account", "layout");
  return { ok: true };
}

const prefsSchema = z.object({ order_updates: z.boolean(), offers: z.boolean(), push: z.boolean() });

export async function updateNotificationPrefs(input: z.input<typeof prefsSchema>): Promise<Result> {
  const user = await requireUser("/account/settings");
  const prefs = prefsSchema.parse(input);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/account/settings");
  return { ok: true };
}

/** Anonymises the account (orders stay for restaurant records) and signs out. */
export async function deleteAccount(): Promise<Result> {
  const user = await requireUser("/account/settings");
  const admin = getSupabaseAdminClient();
  await admin
    .from("profiles")
    .update({ name: "Deleted user", email: null, phone: null, avatar_url: null, deleted_at: new Date().toISOString(), is_blocked: true })
    .eq("id", user.id);
  await admin.from("addresses").delete().eq("user_id", user.id);
  await admin.auth.admin.updateUserById(user.id, {
    email: `deleted-${user.id}@deleted.thaali.app`,
    phone: "",
    ban_duration: "876000h",
    user_metadata: { deleted: true },
  });
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/?account=deleted");
}

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.enum(["Home", "Work", "Other"]),
  custom_label: z.string().trim().max(30).optional().nullable(),
  line1: z.string().trim().min(3, "Enter the street / area").max(200),
  flat: z.string().trim().min(1, "Enter your flat, house or floor").max(120),
  landmark: z.string().trim().max(120).optional().nullable(),
  area: z.string().trim().max(80).optional().nullable(),
  pincode: z.string().trim().regex(/^\d{6}$/, "6-digit pincode").optional().or(z.literal("")).nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  instructions: z.string().trim().max(200).optional().nullable(),
  is_default: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressSchema>;

export async function saveAddress(input: AddressInput): Promise<Result> {
  const user = await requireUser("/account/addresses");
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address" };
  const { id, ...data } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true });
  const row = { ...data, pincode: data.pincode || null, user_id: user.id, is_default: data.is_default || (count ?? 0) === 0 };
  if (row.is_default) await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const res = id
    ? await supabase.from("addresses").update(row).eq("id", id).select("id").single()
    : await supabase.from("addresses").insert(row).select("id").single();
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/", "layout");
  return { ok: true, id: res.data.id };
}

export async function deleteAddress(id: string): Promise<Result> {
  await requireUser("/account/addresses");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setDefaultAddress(id: string): Promise<Result> {
  const user = await requireUser("/account/addresses");
  const supabase = await getSupabaseServerClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/account/addresses");
  return { ok: true };
}
