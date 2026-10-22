"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Crown, Loader2, MoreVertical, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm, type FieldError } from "react-hook-form";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteGoldPlan, saveGoldPlan, setGoldPlanActive } from "@/lib/admin/gold-actions";
import { cn, formatPaise } from "@/lib/utils";
import { paiseToRupees } from "../coupons/form-helpers";
import { goldPlanSchema, type GoldPlan, type GoldPlanInput, type GoldPlanValues } from "./schema";

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

function defaults(p: GoldPlan | null): GoldPlanInput {
  return p
    ? { name: p.name, duration_months: String(p.duration_months), price_rupees: paiseToRupees(p.price_paise), original_price_rupees: paiseToRupees(p.original_price_paise), sort: String(p.sort), is_active: p.is_active }
    : { name: "", duration_months: "3", price_rupees: "", original_price_rupees: "", sort: "", is_active: true };
}

function PlanDialog({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (v: boolean) => void; plan: GoldPlan | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<GoldPlanInput, unknown, GoldPlanValues>({ resolver: zodResolver(goldPlanSchema), defaultValues: defaults(plan) });
  const { register, formState, reset } = form;
  const errors = formState.errors;
  useEffect(() => {
    if (open) reset(defaults(plan));
  }, [open, plan, reset]);

  function submit(v: GoldPlanValues) {
    start(async () => {
      const res = await saveGoldPlan(plan?.id ?? null, form.getValues());
      if (!res.ok) return void toast.error(res.error);
      toast.success(plan ? `${v.name} saved` : `${v.name} created`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "New Gold plan"}</DialogTitle>
          <DialogDescription>Price changes apply to new purchases; existing members keep their plan until it ends.</DialogDescription>
        </DialogHeader>
        <form id="plan-form" onSubmit={form.handleSubmit(submit)} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="plan-name">Plan name</Label>
              <Input id="plan-name" placeholder="Gold · 3 months" aria-invalid={Boolean(errors.name)} {...register("name")} />
              <Err e={errors.name} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-duration">Duration (months)</Label>
              <Input id="plan-duration" inputMode="numeric" aria-invalid={Boolean(errors.duration_months)} {...register("duration_months")} />
              <Err e={errors.duration_months} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="plan-price">Price (₹)</Label>
              <Input id="plan-price" inputMode="decimal" aria-invalid={Boolean(errors.price_rupees)} {...register("price_rupees")} />
              <Err e={errors.price_rupees} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-original">Original price (₹)</Label>
              <Input id="plan-original" inputMode="decimal" placeholder="Optional" aria-invalid={Boolean(errors.original_price_rupees)} {...register("original_price_rupees")} />
              <Err e={errors.original_price_rupees} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-sort">Position</Label>
              <Input id="plan-sort" inputMode="numeric" placeholder="Last" aria-invalid={Boolean(errors.sort)} {...register("sort")} />
              <Err e={errors.sort} />
            </div>
          </div>
          <label htmlFor="plan-active" className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-sm font-semibold">
            <input id="plan-active" type="checkbox" className="size-5 accent-primary" {...register("is_active")} /> Available to buy
          </label>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {plan ? "Save plan" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlansManager({ plans, members }: { plans: GoldPlan[]; members: Record<string, { active: number; total: number }> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<GoldPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<GoldPlan | null>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Something went wrong");
      toast.success(msg);
      router.refresh();
    });
  }
  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <section aria-labelledby="plans-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="plans-title" className="font-display text-lg font-semibold">
          Plans
        </h2>
        <Button variant="outline" onClick={openNew}>
          <Plus /> New plan
        </Button>
      </div>
      {plans.length === 0 ? (
        <EmptyState icon={Crown} title="No Gold plans" description="Create a plan so customers can join Gold." action={<Button onClick={openNew}>Create a plan</Button>} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const m = members[p.id] ?? { active: 0, total: 0 };
            const perMonth = Math.round(p.price_paise / p.duration_months);
            return (
              <li key={p.id} className="min-w-0">
                <Card className={cn("space-y-3 p-4", !p.is_active && "opacity-75")} data-testid="gold-plan" data-name={p.name}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 font-semibold">
                        <Crown className="size-4 text-amber-500" aria-hidden /> {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.duration_months} {p.duration_months === 1 ? "month" : "months"} · {formatPaise(perMonth)}/month
                      </p>
                    </div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`} disabled={pending}>
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          <Pencil /> Edit pricing
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => act(() => setGoldPlanActive(p.id, !p.is_active), p.is_active ? `${p.name} deactivated` : `${p.name} is on sale`)}>
                          <Power /> {p.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        {m.total === 0 ? (
                          <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm(p)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold" data-testid="gold-plan-price">
                      {formatPaise(p.price_paise)}
                    </span>
                    {p.original_price_paise ? <span className="text-sm text-muted-foreground line-through">{formatPaise(p.original_price_paise)}</span> : null}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {m.active} active · {m.total} all time
                    </span>
                    <Badge className={p.is_active ? "border-transparent bg-success text-white" : "bg-muted text-muted-foreground"}>{p.is_active ? "On sale" : "Inactive"}</Badge>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} />
      <AlertDialog open={Boolean(confirm)} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Nobody has bought this plan yet, so it can be removed permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const p = confirm;
                setConfirm(null);
                if (p) act(() => deleteGoldPlan(p.id), `${p.name} deleted`);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
