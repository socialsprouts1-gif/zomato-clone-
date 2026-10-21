"use client";

import { BadgePercent, MoreVertical, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteOffer, setOfferActive } from "@/lib/partner/offers-actions";
import { cn, formatPaise } from "@/lib/utils";
import { OfferDialog, type MenuOption } from "./offer-dialog";
import { offerStatus, offerSummary, shortDate, type Offer, type OfferStatus } from "./offer-utils";

export type OfferStats = { orders: number; discountPaise: number; revenuePaise: number };

const STATUS: Record<OfferStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "border-transparent bg-success text-white" },
  scheduled: { label: "Scheduled", className: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" },
  paused: { label: "Paused", className: "bg-muted text-muted-foreground" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
};
const ORDER: OfferStatus[] = ["active", "scheduled", "paused", "expired"];

export function OffersPanel({ restaurantId, offers, stats, menu }: { restaurantId: string; offers: Offer[]; stats: Record<string, OfferStats>; menu: MenuOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Offer | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Offer | null>(null);
  const [pending, start] = useTransition();
  const dish = (id: string | null) => menu.find((m) => m.id === id)?.name;
  const sorted = useMemo(() => [...offers].sort((a, b) => ORDER.indexOf(offerStatus(a)) - ORDER.indexOf(offerStatus(b))), [offers]);
  const totals = Object.values(stats).reduce((s, x) => ({ orders: s.orders + x.orders, discount: s.discount + x.discountPaise, revenue: s.revenue + x.revenuePaise }), { orders: 0, discount: 0, revenue: 0 });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function toggle(o: Offer) {
    start(async () => {
      const res = await setOfferActive(restaurantId, o.id, !o.is_active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(o.is_active ? `${o.code} paused` : `${o.code} is live again`);
      router.refresh();
    });
  }

  function remove(o: Offer) {
    start(async () => {
      const res = await deleteOffer(restaurantId, o.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${o.code} deleted`);
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="grid flex-1 grid-cols-3 gap-2 sm:max-w-md">
          {[
            ["Orders with offers", totals.orders.toLocaleString("en-IN")],
            ["Discount given", formatPaise(totals.discount)],
            ["Revenue", formatPaise(totals.revenue)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border bg-card px-3 py-2">
              <dt className="text-[11px] font-medium text-muted-foreground">{k}</dt>
              <dd className="font-display text-base font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <Button onClick={openNew}>
          <Plus /> Create offer
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title="No offers yet"
          description="Offers show on your restaurant page and at checkout. Start with a flat discount or free delivery."
          action={<Button onClick={openNew}>Create your first offer</Button>}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {sorted.map((o) => {
            const st = offerStatus(o);
            const s = stats[o.id] ?? { orders: 0, discountPaise: 0, revenuePaise: 0 };
            return (
              <li key={o.id}>
                <Card className={cn("space-y-3 p-4", st === "expired" && "opacity-75")} data-testid="partner-offer" data-code={o.code}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-dashed border-primary px-2 py-0.5 font-mono text-sm font-bold text-primary">{o.code}</span>
                        <Badge className={STATUS[st].className}>{STATUS[st].label}</Badge>
                      </div>
                      <p className="font-semibold">{o.title}</p>
                      <p className="text-sm text-muted-foreground">{offerSummary(o, dish)}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.applies_to === "both" ? "Delivery & dining" : o.applies_to === "dining" ? "Dining" : "Delivery"}
                        {o.target === "new_users" ? " · new customers" : o.target === "gold" ? " · Gold members" : ""} · {st === "scheduled" ? "starts" : "from"} {shortDate(o.valid_from)}
                        {o.valid_until ? ` to ${shortDate(o.valid_until)}` : ""}
                      </p>
                    </div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${o.code}`} disabled={pending}>
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(o);
                            setOpen(true);
                          }}
                        >
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        {st !== "expired" ? (
                          <DropdownMenuItem onSelect={() => toggle(o)}>
                            <Power /> {o.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmDelete(o)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-2 text-center" aria-label={`Performance of ${o.code}`}>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Orders</dt>
                      <dd className="font-semibold" data-testid="offer-orders">
                        {s.orders}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Discount given</dt>
                      <dd className="font-semibold" data-testid="offer-discount">
                        {formatPaise(s.discountPaise)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Revenue</dt>
                      <dd className="font-semibold">{formatPaise(s.revenuePaise)}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Revenue is food sales after discount on orders that used the offer. Cancelled and rejected orders are excluded.</p>

      <OfferDialog open={open} onOpenChange={setOpen} restaurantId={restaurantId} offer={editing} menu={menu} />
      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.code}?</AlertDialogTitle>
            <AlertDialogDescription>Customers can no longer use this code. Past orders keep their discount, but this offer&apos;s stats will no longer be shown.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) remove(confirmDelete);
              }}
              disabled={pending}
            >
              Delete offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
