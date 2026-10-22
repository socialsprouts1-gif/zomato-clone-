"use server";

import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import type { Json } from "@/lib/supabase/database.types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PATHS = ["/admin/rescue", "/events"];

const tierSchema = z.object({
  id: z.string().trim().max(40).optional(),
  name: z.string().trim().min(2, "Name each tier").max(40),
  price_paise: z.number().int().min(0).max(10_000_000),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(100_000),
});

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, "Add a title").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  category: z.string().trim().min(2).max(40),
  venue: z.string().trim().min(2, "Add the venue").max(160),
  city: z.string().trim().min(2).max(60),
  // "YYYY-MM-DDTHH:mm" in India time (from <input type="datetime-local">)
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time"),
  imageUrl: z.union([z.literal(""), z.string().trim().url("Image must be a URL").max(500)]).optional().default(""),
  isActive: z.boolean(),
  tiers: z.array(tierSchema).min(1, "Add at least one ticket tier").max(8),
});
export type EventInput = z.input<typeof eventSchema>;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";

type Tier = { id: string; name: string; price_paise: number; capacity: number };

/** Tickets sold per tier (confirmed or used). */
async function soldByTier(eventId: string) {
  const { data } = await getSupabaseAdminClient().from("event_tickets").select("tier_id, quantity").eq("event_id", eventId).in("status", ["confirmed", "used"]);
  const sold = new Map<string, number>();
  for (const t of data ?? []) sold.set(t.tier_id, (sold.get(t.tier_id) ?? 0) + t.quantity);
  return sold;
}

export async function saveEvent(input: EventInput) {
  return adminAction(async () => {
    const v = eventSchema.parse(input);
    const startsAt = new Date(`${v.startsAtLocal}:00+05:30`);
    if (Number.isNaN(startsAt.getTime())) throw new Error("Pick a valid date and time");
    const db = getSupabaseAdminClient();

    // Tier ids stay stable across edits (tickets reference them); new tiers get a slug id.
    const used = new Set<string>();
    const tiers: Tier[] = v.tiers.map((t) => {
      let id = t.id && /^[a-z0-9-]{1,40}$/.test(t.id) ? t.id : slugify(t.name).slice(0, 30);
      for (let n = 2; used.has(id); n++) id = `${slugify(t.name).slice(0, 30)}-${n}`;
      used.add(id);
      return { id, name: t.name, price_paise: t.price_paise, capacity: t.capacity };
    });

    if (v.id) {
      const { data: before } = await db.from("events").select("id, slug, title, tiers, is_active, starts_at").eq("id", v.id).maybeSingle();
      if (!before) throw new Error("Event not found");
      const sold = await soldByTier(v.id);
      for (const [tierId, n] of sold) {
        const t = tiers.find((x) => x.id === tierId);
        if (!t) throw new Error("A tier with tickets sold can't be removed");
        if (t.capacity < n) throw new Error(`${t.name}: capacity can't go below the ${n} tickets already sold`);
      }
      const { error } = await db
        .from("events")
        .update({ title: v.title, description: v.description || null, category: v.category, venue: v.venue, city: v.city, starts_at: startsAt.toISOString(), image_url: v.imageUrl || null, is_active: v.isActive, tiers: tiers as unknown as Json })
        .eq("id", v.id);
      if (error) throw new Error(error.message);
      return {
        data: { id: v.id },
        audit: { action: "event.update", entityType: "event", entityId: v.id, details: { title: v.title, slug: before.slug, starts_at: startsAt.toISOString(), is_active: v.isActive, tiers: tiers.length } },
      };
    }

    let slug = slugify(v.title);
    const { data: clash } = await db.from("events").select("slug").like("slug", `${slug}%`);
    const taken = new Set((clash ?? []).map((c) => c.slug));
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(v.title)}-${n}`;
    const { data: row, error } = await db
      .from("events")
      .insert({ title: v.title, slug, description: v.description || null, category: v.category, venue: v.venue, city: v.city, starts_at: startsAt.toISOString(), image_url: v.imageUrl || null, is_active: v.isActive, tiers: tiers as unknown as Json })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create the event");
    return { data: { id: row.id }, audit: { action: "event.create", entityType: "event", entityId: row.id, details: { title: v.title, slug, starts_at: startsAt.toISOString(), tiers } } };
  }, PATHS);
}

export async function setEventActive(eventId: string, active: boolean) {
  return adminAction(async () => {
    const id = z.string().uuid().parse(eventId);
    const db = getSupabaseAdminClient();
    const { data: e, error } = await db.from("events").update({ is_active: z.boolean().parse(active) }).eq("id", id).select("title").maybeSingle();
    if (error || !e) throw new Error(error?.message ?? "Event not found");
    return { audit: { action: active ? "event.activate" : "event.deactivate", entityType: "event", entityId: id, details: { title: e.title } } };
  }, PATHS);
}

/** Deletes an event that has no sold tickets (otherwise deactivate it). */
export async function deleteEvent(eventId: string) {
  return adminAction(async () => {
    const id = z.string().uuid().parse(eventId);
    const db = getSupabaseAdminClient();
    const { count } = await db.from("event_tickets").select("id", { count: "exact", head: true }).eq("event_id", id);
    if (count) throw new Error("This event has bookings. Deactivate it instead.");
    const { data: e, error } = await db.from("events").delete().eq("id", id).select("title, slug").maybeSingle();
    if (error || !e) throw new Error(error?.message ?? "Event not found");
    return { audit: { action: "event.delete", entityType: "event", entityId: id, details: { title: e.title, slug: e.slug } } };
  }, PATHS);
}
