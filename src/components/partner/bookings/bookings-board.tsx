"use client";

import { CalendarCheck, CalendarClock, Check, Loader2, MessageSquareText, Phone, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRealtime } from "@/hooks/use-realtime";
import { completeBooking, confirmBooking, declineBooking } from "@/lib/partner/ops-actions";
import { cn } from "@/lib/utils";
import { formatBookingDate, formatSlot } from "./format";
import type { TableView } from "./tables-manager";

export type BookingView = {
  id: string;
  booking_code: string;
  booking_date: string;
  time_slot: string;
  guests: number;
  status: "pending" | "confirmed" | "declined" | "cancelled" | "completed";
  special_request: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  decline_reason: string | null;
  table_id: string | null;
};

type Tab = "upcoming" | "today" | "past";
const TAB_LABEL: Record<Tab, string> = { today: "Today", upcoming: "Upcoming", past: "Past" };
const DECLINE_REASONS = ["Fully booked for this slot", "Closed for a private event", "Can't seat a group this large", "Kitchen closed at this time"];
const STATUS_BADGE: Record<BookingView["status"], { label: string; variant: "default" | "secondary" | "outline" | "success" | "destructive" }> = {
  pending: { label: "Awaiting confirmation", variant: "default" },
  confirmed: { label: "Confirmed", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
  cancelled: { label: "Cancelled by guest", variant: "outline" },
  completed: { label: "Visited", variant: "secondary" },
};
const NO_TABLE = "none";

export function BookingsBoard({ restaurantId, today, bookings, tables }: { restaurantId: string; today: string; bookings: BookingView[]; tables: TableView[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => (bookings.some((b) => b.booking_date === today) ? "today" : "upcoming"));
  const [confirming, setConfirming] = useState<BookingView | null>(null);
  const [tableId, setTableId] = useState(NO_TABLE);
  const [declining, setDeclining] = useState<BookingView | null>(null);
  const [reason, setReason] = useState(DECLINE_REASONS[0]!);
  const [pending, start] = useTransition();

  useRealtime(`partner-bookings:${restaurantId}`, [{ table: "table_bookings", filter: `restaurant_id=eq.${restaurantId}` }], () => router.refresh(), 30000);

  const groups = useMemo(() => {
    const g: Record<Tab, BookingView[]> = { today: [], upcoming: [], past: [] };
    for (const b of bookings) g[b.booking_date === today ? "today" : b.booking_date > today ? "upcoming" : "past"].push(b);
    g.past.reverse();
    return g;
  }, [bookings, today]);
  const pendingCount = (t: Tab) => groups[t].filter((b) => b.status === "pending").length;
  const tableLabel = (id: string | null) => tables.find((t) => t.id === id)?.label;
  const freeTables = (b: BookingView) =>
    tables.filter((t) => t.is_active && t.seats >= b.guests && !bookings.some((o) => o.id !== b.id && o.table_id === t.id && o.status === "confirmed" && o.booking_date === b.booking_date && o.time_slot === b.time_slot));

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, done: () => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Couldn't update the booking");
      toast.success(success);
      done();
      router.refresh();
    });
  }

  const list = groups[tab];
  return (
    <section aria-labelledby="bookings-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="bookings-heading" className="font-display text-lg font-bold">
          Bookings
        </h2>
        <div role="tablist" aria-label="Booking date" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {(["today", "upcoming", "past"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground", tab === t && "border-primary bg-primary text-primary-foreground")}
            >
              {TAB_LABEL[t]}
              <span className={cn("rounded-full px-1.5 text-xs", tab === t ? "bg-white/25" : "bg-muted")}>{groups[t].length}</span>
              {t !== "past" && pendingCount(t) > 0 ? <span className="sr-only">, {pendingCount(t)} awaiting confirmation</span> : null}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={tab === "past" ? "No past bookings" : tab === "today" ? "No bookings today" : "No upcoming bookings"}
          description={tab === "past" ? "Bookings from the last 30 days show up here." : "When guests book a table, you'll confirm or decline it here."}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const badge = STATUS_BADGE[b.status];
            const label = tableLabel(b.table_id);
            const isPast = b.booking_date < today;
            return (
              <li key={b.id}>
                <Card className={cn("flex h-full flex-col gap-3 p-4", b.status === "pending" && !isPast && "border-primary ring-2 ring-primary/20")} data-testid="booking-card" data-code={b.booking_code}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display truncate text-lg font-bold">{b.customer_name ?? "Guest"}</p>
                      <p className="font-mono text-xs text-muted-foreground">{b.booking_code}</p>
                    </div>
                    <Badge variant={isPast && b.status === "pending" ? "outline" : badge.variant}>{isPast && b.status === "pending" ? "Expired" : badge.label}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-primary" aria-hidden />
                      <dt className="sr-only">When</dt>
                      <dd>
                        {formatBookingDate(b.booking_date)}, {formatSlot(b.time_slot)}
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-primary" aria-hidden />
                      <dt className="sr-only">Guests</dt>
                      <dd>
                        {b.guests} {b.guests === 1 ? "guest" : "guests"}
                        {label ? ` · Table ${label}` : ""}
                      </dd>
                    </div>
                    {b.customer_phone ? (
                      <div className="col-span-2 flex items-center gap-2">
                        <Phone className="size-4 text-primary" aria-hidden />
                        <dt className="sr-only">Phone</dt>
                        <dd>
                          <a href={`tel:${b.customer_phone}`} className="hover:underline">
                            {b.customer_phone}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {b.special_request ? (
                    <p className="flex gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      <MessageSquareText className="size-4 shrink-0" aria-hidden /> “{b.special_request}”
                    </p>
                  ) : null}
                  {b.decline_reason && b.status === "declined" ? <p className="text-xs text-destructive">Declined: {b.decline_reason}</p> : null}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {b.status === "pending" && !isPast ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setTableId(freeTables(b)[0]?.id ?? NO_TABLE);
                            setConfirming(b);
                          }}
                        >
                          <Check /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeclining(b)}>
                          <X /> Decline
                        </Button>
                      </>
                    ) : null}
                    {b.status === "confirmed" && b.booking_date <= today ? (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => completeBooking(b.id), "Marked as visited", () => {})}>
                        Mark as visited
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(confirming)} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm booking {confirming?.booking_code}</DialogTitle>
            <DialogDescription>
              {confirming ? `${confirming.customer_name ?? "Guest"} · ${confirming.guests} guests · ${formatBookingDate(confirming.booking_date)}, ${formatSlot(confirming.time_slot)}` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="assign-table">Assign a table (optional)</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger id="assign-table" aria-label="Assign a table">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TABLE}>Decide when they arrive</SelectItem>
                {confirming
                  ? freeTables(confirming).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} · {t.section} · {t.seats} seats
                      </SelectItem>
                    ))
                  : null}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only active tables with enough seats that are free at this slot are listed.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => confirming && act(() => confirmBooking(confirming.id, tableId === NO_TABLE ? null : tableId), "Booking confirmed. The guest has been notified.", () => setConfirming(null))}
            >
              {pending ? <Loader2 className="animate-spin" /> : null} Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(declining)} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline booking {declining?.booking_code}?</DialogTitle>
            <DialogDescription>The guest is notified with your reason.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Common reasons">
            {DECLINE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reason === r}
                onClick={() => setReason(r)}
                className={cn("rounded-full border px-3 py-1 text-sm", reason === r ? "border-primary bg-secondary font-semibold text-primary" : "text-muted-foreground")}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason</Label>
            <Textarea id="decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>
              Keep booking
            </Button>
            <Button variant="destructive" disabled={pending || reason.trim().length < 2} onClick={() => declining && act(() => declineBooking(declining.id, reason), "Booking declined. The guest has been notified.", () => setDeclining(null))}>
              {pending ? <Loader2 className="animate-spin" /> : null} Decline booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
