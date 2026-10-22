import { CalendarHeart, MapPin, Ticket } from "lucide-react";
import { fmtDateTime } from "@/components/admin/restaurants/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";
import { EventFormDialog, type EventFormValue } from "./event-form-dialog";
import { DeleteEventButton, EventActiveSwitch } from "./event-row-actions";

type Tier = { id: string; name: string; price_paise: number; capacity: number };

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in India time, for <input type="datetime-local">. */
function toIstLocal(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}

export async function EventsPanel({ db }: { db: TypedSupabaseClient }) {
  const [{ data: events, error }, { data: tickets }] = await Promise.all([
    db.from("events").select("*").order("starts_at", { ascending: true }),
    db.from("event_tickets").select("event_id, tier_id, quantity, amount_paise, status").in("status", ["confirmed", "used"]),
  ]);
  if (error) throw new Error(error.message);
  const sold = new Map<string, { qty: number; revenue: number; byTier: Map<string, number> }>();
  for (const t of tickets ?? []) {
    const s = sold.get(t.event_id) ?? { qty: 0, revenue: 0, byTier: new Map() };
    s.qty += t.quantity;
    s.revenue += t.amount_paise;
    s.byTier.set(t.tier_id, (s.byTier.get(t.tier_id) ?? 0) + t.quantity);
    sold.set(t.event_id, s);
  }
  const now = Date.now();

  return (
    <section aria-labelledby="events-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="events-title" className="font-display text-lg font-semibold">
            Event listings
          </h2>
          <p className="text-sm text-muted-foreground">Concerts, comedy and food festivals sold through Thaali.</p>
        </div>
        <EventFormDialog />
      </div>
      {!events?.length ? (
        <EmptyState icon={CalendarHeart} title="No events yet" description="Create an event with one or more ticket tiers." />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label="Events">
          {events.map((e) => {
            const tiers = (Array.isArray(e.tiers) ? e.tiers : []) as unknown as Tier[];
            const s = sold.get(e.id);
            const capacity = tiers.reduce((a, t) => a + t.capacity, 0);
            const from = tiers.length ? Math.min(...tiers.map((t) => t.price_paise)) : 0;
            const past = Date.parse(e.starts_at) < now;
            const initial: EventFormValue = {
              id: e.id,
              title: e.title,
              description: e.description ?? "",
              category: e.category,
              venue: e.venue,
              city: e.city,
              startsAtLocal: toIstLocal(e.starts_at),
              imageUrl: e.image_url ?? "",
              isActive: e.is_active,
              tiers: tiers.map((t) => ({ ...t, sold: s?.byTier.get(t.id) ?? 0 })),
            };
            return (
              <li key={e.id}>
                <Card className="space-y-3 p-4" data-testid="event-row">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{e.title}</h3>
                        <Badge variant="outline">{e.category}</Badge>
                        {past ? <Badge variant="secondary">Past</Badge> : null}
                        {!e.is_active ? <Badge variant="destructive">Inactive</Badge> : null}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" aria-hidden /> {e.venue}, {e.city}
                      </p>
                      <p className="text-sm text-muted-foreground">{fmtDateTime(e.starts_at)} · from {formatPaise(from)}</p>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-2 text-xs">
                    {tiers.map((t) => (
                      <li key={t.id} className="rounded-lg bg-muted px-2 py-1 tabular-nums">
                        {t.name}: {formatPaise(t.price_paise)} · {s?.byTier.get(t.id) ?? 0}/{t.capacity}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <p className="flex items-center gap-1 text-sm" data-testid="event-sold">
                      <Ticket className="size-4 text-primary" aria-hidden />
                      <span className="font-semibold tabular-nums">
                        {s?.qty ?? 0}/{capacity}
                      </span>{" "}
                      sold{s?.revenue ? ` · ${formatPaise(s.revenue)}` : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <EventActiveSwitch id={e.id} title={e.title} active={e.is_active} />
                      <EventFormDialog initial={initial} />
                      {s?.qty ? null : <DeleteEventButton id={e.id} title={e.title} />}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
