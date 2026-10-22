"use client";

import { MoreVertical, Pencil, Plus, Power, Ticket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { deleteCoupon, setCouponActive } from "@/lib/admin/coupons-actions";
import { cn, formatPaise } from "@/lib/utils";
import { CouponDialog, type RestaurantOption } from "./coupon-dialog";
import { shortDate } from "./form-helpers";
import { couponRules, couponStatus, couponSummary, STATUS_LABEL, type Coupon, type CouponStatus } from "./schema";

export type CouponUsage = { orders: number; discountPaise: number };

const STATUS_CLASS: Record<CouponStatus, string> = {
  active: "border-transparent bg-success text-white",
  scheduled: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  inactive: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  exhausted: "bg-muted text-muted-foreground",
};

export function StatusBadge({ c }: { c: Coupon }) {
  const st = couponStatus(c);
  return <Badge className={STATUS_CLASS[st]}>{STATUS_LABEL[st]}</Badge>;
}

function validity(c: Coupon) {
  return `${shortDate(c.valid_from)}${c.valid_until ? ` – ${shortDate(c.valid_until)}` : " onwards"}`;
}

export function CouponsManager({
  coupons,
  usage,
  restaurants,
  hasFilters,
}: {
  coupons: Coupon[];
  usage: Record<string, CouponUsage>;
  restaurants: RestaurantOption[];
  hasFilters: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Coupon | null>(null);
  const [pending, start] = useTransition();
  const restaurantName = (id: string | null) => (id ? (restaurants.find((r) => r.id === id)?.name ?? "one restaurant") : null);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function edit(c: Coupon) {
    setEditing(c);
    setOpen(true);
  }
  function toggle(c: Coupon) {
    start(async () => {
      const res = await setCouponActive(c.id, !c.is_active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(c.is_active ? `${c.code} deactivated` : `${c.code} is active`);
      router.refresh();
    });
  }
  function remove(c: Coupon) {
    start(async () => {
      const res = await deleteCoupon(c.id);
      setConfirm(null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data?.deactivated ? `${c.code} has been used, so it was deactivated instead` : `${c.code} deleted`);
      router.refresh();
    });
  }

  const actions = (c: Coupon) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${c.code}`} disabled={pending}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => edit(c)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggle(c)}>
          <Power /> {c.is_active ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm(c)}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const confirmUsed = confirm ? (usage[confirm.id]?.orders ?? 0) > 0 || confirm.used_count > 0 : false;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> New coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={hasFilters ? "No coupons match" : "No coupons yet"}
          description={hasFilters ? "Try a different code or status." : "Create a platform coupon that customers can apply at checkout."}
          action={hasFilters ? undefined : <Button onClick={openNew}>Create a coupon</Button>}
        />
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="grid grid-cols-1 gap-3 md:hidden">
            {coupons.map((c) => {
              const u = usage[c.id] ?? { orders: 0, discountPaise: 0 };
              return (
                <li key={c.id} className="min-w-0">
                  <Card className="space-y-2 p-4" data-testid="admin-coupon" data-code={c.code}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/coupons/${c.id}`} className="rounded-md border border-dashed border-primary px-2 py-0.5 font-mono text-sm font-bold text-primary">
                            {c.code}
                          </Link>
                          <StatusBadge c={c} />
                        </div>
                        <p className="font-semibold">{c.title}</p>
                        <p className="text-sm text-muted-foreground">{couponSummary(c)}</p>
                        <p className="text-xs text-muted-foreground">{couponRules(c, restaurantName(c.restaurant_id)).join(" · ")}</p>
                        <p className="text-xs text-muted-foreground">{validity(c)}</p>
                      </div>
                      {actions(c)}
                    </div>
                    <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs">
                      <span className="font-semibold">{u.orders}</span> orders · {formatPaise(u.discountPaise)} given · {c.used_count.toLocaleString("en-IN")}
                      {c.total_limit !== null ? ` / ${c.total_limit.toLocaleString("en-IN")}` : ""} uses
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Offer</th>
                  <th className="px-4 py-3 font-medium">Rules</th>
                  <th className="px-4 py-3 font-medium">Valid</th>
                  <th className="px-4 py-3 text-right font-medium">Usage</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-2 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const u = usage[c.id] ?? { orders: 0, discountPaise: 0 };
                  return (
                    <tr key={c.id} className={cn("border-b last:border-0", couponStatus(c) !== "active" && "text-muted-foreground")} data-testid="admin-coupon" data-code={c.code}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/coupons/${c.id}`} className="font-mono font-bold text-primary hover:underline">
                          {c.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{c.title}</p>
                        <p className="text-xs">{couponSummary(c)}</p>
                      </td>
                      <td className="max-w-56 px-4 py-3 text-xs">{couponRules(c, restaurantName(c.restaurant_id)).join(" · ")}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{validity(c)}</td>
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                        <p>
                          <span className="font-semibold text-foreground" data-testid="coupon-orders">
                            {u.orders}
                          </span>{" "}
                          orders · {formatPaise(u.discountPaise)}
                        </p>
                        <p>
                          {c.used_count.toLocaleString("en-IN")}
                          {c.total_limit !== null ? ` / ${c.total_limit.toLocaleString("en-IN")}` : ""} uses
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge c={c} />
                      </td>
                      <td className="px-2 py-3 text-right">{actions(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CouponDialog open={open} onOpenChange={setOpen} coupon={editing} restaurants={restaurants} />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmUsed ? `Deactivate ${confirm?.code}?` : `Delete ${confirm?.code}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUsed
                ? "This coupon has already been used on orders, so it can't be deleted. It will be deactivated instead and stop working at checkout."
                : "The coupon will be removed permanently. Customers won't be able to apply it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirm) remove(confirm);
              }}
            >
              {confirmUsed ? "Deactivate" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
