import "server-only";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export class AdminError extends Error {}

/** Throws unless the caller is a signed-in, unblocked admin. Use at the top of every admin server action. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.profile.is_blocked || user.profile.role !== "admin") throw new AdminError("Admins only");
  return user;
}

/** Records an admin action in the audit log (service role; the table is admin-read-only). */
export async function audit(adminId: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  await getSupabaseAdminClient()
    .from("admin_audit_log")
    .insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId, details: details as Json });
}

/**
 * Runs an admin action: checks the role, runs `fn`, writes the audit entry it returns (if any)
 * and revalidates the given paths. Errors come back as { ok: false, error }.
 */
export async function adminAction<T>(
  fn: (admin: SessionUser) => Promise<{ data?: T; audit?: { action: string; entityType: string; entityId: string | null; details?: Record<string, unknown> } } | void>,
  revalidate: string[] = [],
): Promise<AdminResult<T>> {
  try {
    const admin = await assertAdmin();
    const out = (await fn(admin)) ?? {};
    if (out.audit) await audit(admin.id, out.audit.action, out.audit.entityType, out.audit.entityId, out.audit.details);
    for (const p of revalidate) revalidatePath(p);
    return { ok: true, data: out.data };
  } catch (e) {
    if (e && typeof e === "object" && "issues" in e) return { ok: false, error: "Please check the form" };
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
