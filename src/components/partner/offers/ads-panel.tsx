"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, IndianRupee, Loader2, Megaphone, MousePointerClick, Pause, Percent, Play, Plus, ShoppingBag, Square, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCampaign, setCampaignStatus } from "@/lib/partner/offers-actions";
import type { Tables } from "@/lib/supabase/database.types";
import { formatPaise } from "@/lib/utils";
import { istDate, shortDate } from "./offer-utils";
import { campaignFormSchema, type CampaignFormInput, type CampaignFormValues } from "./schemas";

export type Campaign = Tables<"ad_campaigns">;

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "–");

function metrics(list: Campaign[]) {
  const t = list.reduce((s, c) => ({ impressions: s.impressions + c.impressions, clicks: s.clicks + c.clicks, orders: s.orders + c.orders, spend: s.spend + Number(c.spend_paise) }), { impressions: 0, clicks: 0, orders: 0, spend: 0 });
  return [
    { label: "Impressions", value: t.impressions.toLocaleString("en-IN"), icon: Eye },
    { label: "Clicks", value: t.clicks.toLocaleString("en-IN"), icon: MousePointerClick },
    { label: "CTR", value: pct(t.clicks, t.impressions), icon: Percent },
    { label: "Orders", value: t.orders.toLocaleString("en-IN"), icon: ShoppingBag },
    { label: "Spend", value: formatPaise(t.spend), icon: IndianRupee },
    { label: "Cost per order", value: t.orders ? formatPaise(Math.round(t.spend / t.orders)) : "–", icon: Target },
  ];
}

const STATUS_CLASS: Record<string, string> = {
  active: "border-transparent bg-success text-white",
  paused: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  ended: "bg-muted text-muted-foreground",
};

export function AdsPanel({ restaurantId, campaigns, sponsoredUntil }: { restaurantId: string; campaigns: Campaign[]; sponsoredUntil: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = istDate(new Date());

  function change(c: Campaign, status: "active" | "paused" | "ended") {
    start(async () => {
      const res = await setCampaignStatus(restaurantId, c.id, status);
      if (!res.ok) return void toast.error(res.error);
      toast.success(status === "active" ? `${c.name} resumed` : status === "paused" ? `${c.name} paused` : `${c.name} ended`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" data-testid="sponsored-status">
          {sponsoredUntil ? (
            <>
              <Megaphone className="mr-1 inline size-4 text-primary" />
              Your outlet shows as <strong className="text-foreground">Promoted</strong> in discovery until {shortDate(sponsoredUntil)}.
            </>
          ) : (
            "Run a campaign to appear as Promoted and rank higher in search and on the home feed."
          )}
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus /> New campaign
        </Button>
      </div>

      <section aria-label="Campaign metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics(campaigns).map((m) => (
          <Card key={m.label} className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <m.icon className="size-3.5" aria-hidden /> {m.label}
            </p>
            <p className="mt-1 font-display text-xl font-bold" data-testid={`ad-metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>
              {m.value}
            </p>
          </Card>
        ))}
      </section>

      {campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" description="Set a daily budget and dates. You only pay while the campaign is running." action={<Button onClick={() => setOpen(true)}>Start a campaign</Button>} />
      ) : (
        <ul className="grid gap-3">
          {campaigns.map((c) => {
            const upcoming = c.status === "active" && c.starts_on > today;
            return (
              <li key={c.id}>
                <Card className="space-y-3 p-4" data-testid="ad-campaign" data-name={c.name} data-status={c.status}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{c.name}</p>
                        <Badge className={STATUS_CLASS[c.status]}>{upcoming ? "Scheduled" : c.status[0]!.toUpperCase() + c.status.slice(1)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatPaise(c.daily_budget_paise)}/day · {shortDate(c.starts_on)}
                        {c.ends_on ? ` – ${shortDate(c.ends_on)}` : ""}
                      </p>
                    </div>
                    {c.status !== "ended" ? (
                      <div className="flex gap-2">
                        {c.status === "active" ? (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => change(c, "paused")} aria-label={`Pause ${c.name}`}>
                            <Pause /> Pause
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => change(c, "active")} aria-label={`Resume ${c.name}`}>
                            <Play /> Resume
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => change(c, "ended")} aria-label={`End ${c.name}`}>
                          <Square /> End
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-2 text-center text-sm sm:grid-cols-6">
                    {metrics([c]).map((m) => (
                      <div key={m.label}>
                        <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
                        <dd className="font-semibold">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Demo simulation: while a campaign is active, spend accrues at its daily budget over time and impressions, clicks and orders follow fixed rates per campaign. Paused time isn&apos;t billed.
      </p>
      <CampaignDialog open={open} onOpenChange={setOpen} restaurantId={restaurantId} />
    </div>
  );
}

function CampaignDialog({ open, onOpenChange, restaurantId }: { open: boolean; onOpenChange: (v: boolean) => void; restaurantId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = istDate(new Date());
  const twoWeeks = istDate(new Date(Date.now() + 13 * 86_400_000));
  const form = useForm<CampaignFormInput, unknown, CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: { name: "", daily_budget_rupees: "500", starts_on: today, ends_on: twoWeeks },
  });
  const e = form.formState.errors;

  function submit(v: CampaignFormValues) {
    start(async () => {
      const res = await createCampaign(restaurantId, form.getValues());
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${v.name} is running`);
      form.reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  const field = (id: string, label: string, err: string | undefined, input: React.ReactNode) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {input}
      {err ? <p className="text-xs font-medium text-destructive">{err}</p> : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col">
        <DialogHeader>
          <DialogTitle>New ad campaign</DialogTitle>
          <DialogDescription>Promoted listings appear higher on the home feed and in search.</DialogDescription>
        </DialogHeader>
        <form id="campaign-form" onSubmit={form.handleSubmit(submit)} className="-mx-6 grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-1" noValidate>
          {field("ad-name", "Campaign name", e.name?.message, <Input id="ad-name" placeholder="Weekend dinner push" aria-invalid={Boolean(e.name)} {...form.register("name")} />)}
          {field(
            "ad-budget",
            "Daily budget (₹)",
            e.daily_budget_rupees?.message,
            <Input id="ad-budget" inputMode="numeric" aria-invalid={Boolean(e.daily_budget_rupees)} {...form.register("daily_budget_rupees")} />,
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("ad-start", "Start date", e.starts_on?.message, <Input id="ad-start" type="date" min={today} aria-invalid={Boolean(e.starts_on)} {...form.register("starts_on")} />)}
            {field("ad-end", "End date", e.ends_on?.message, <Input id="ad-end" type="date" min={today} aria-invalid={Boolean(e.ends_on)} {...form.register("ends_on")} />)}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="campaign-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Launch campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
