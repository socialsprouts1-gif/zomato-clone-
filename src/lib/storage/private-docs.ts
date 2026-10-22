import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type PrivateBucket = "rider-docs" | "restaurant-docs";

/**
 * Short-lived link to a document in a private bucket. Call only after checking the viewer may see it
 * (the owner, or an admin). Values saved before documents moved to private storage were full URLs; those pass through.
 */
export async function signedDocUrl(bucket: PrivateBucket, pathOrUrl: string | null | undefined, expiresIn = 600): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await getSupabaseAdminClient().storage.from(bucket).createSignedUrl(pathOrUrl, expiresIn);
  return error ? null : data.signedUrl;
}
