"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Images, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { FoodImage } from "@/components/shared/food-image";
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
import { deleteBanner, moveBanner, setBannerActive } from "@/lib/admin/content-actions";
import { cn } from "@/lib/utils";
import { shortDate } from "../coupons/form-helpers";
import { BannerDialog, type LinkOptions } from "./banner-dialog";
import { bannerStatus, describeLink, type Banner, type BannerStatus } from "./schema";

const THEME_CLASS: Record<string, string> = {
  saffron: "from-orange-600 to-amber-500",
  gold: "from-amber-700 to-yellow-500",
  green: "from-emerald-700 to-lime-500",
  plum: "from-fuchsia-800 to-rose-500",
  night: "from-slate-900 to-indigo-700",
};
const STATUS: Record<BannerStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "border-transparent bg-success text-white" },
  scheduled: { label: "Scheduled", className: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" },
  ended: { label: "Ended", className: "bg-muted text-muted-foreground" },
  hidden: { label: "Hidden", className: "bg-muted text-muted-foreground" },
};

export function BannersManager({ banners, options }: { banners: Banner[]; options: LinkOptions }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Banner | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Banner | null>(null);
  const [pending, start] = useTransition();
  const names = useMemo(
    () => ({ restaurants: new Map(options.restaurants.map((r) => [r.slug, r.name])), collections: new Map(options.collections.map((c) => [c.slug, c.title])) }),
    [options],
  );

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Something went wrong");
      toast.success(success);
      router.refresh();
    });
  }
  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Live banners show in this order. Scheduled banners appear automatically on their start date.</p>
        <Button onClick={openNew}>
          <Plus /> New banner
        </Button>
      </div>
      {banners.length === 0 ? (
        <EmptyState icon={Images} title="No banners yet" description="Add a banner to promote an offer, a restaurant or a collection on the home page." action={<Button onClick={openNew}>Add a banner</Button>} />
      ) : (
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {banners.map((b, i) => {
            const st = bannerStatus(b);
            return (
              <li key={b.id} className="min-w-0">
                <Card className={cn("flex gap-3 p-3", st !== "live" && "opacity-80")} data-testid="admin-banner" data-title={b.title}>
                  <div className={cn("relative flex h-20 w-28 shrink-0 sm:h-24 overflow-hidden rounded-xl bg-gradient-to-r text-white sm:w-44", THEME_CLASS[b.theme] ?? THEME_CLASS.saffron)}>
                    <p className="relative z-10 line-clamp-3 w-2/3 p-2 text-xs leading-tight font-bold">{b.title}</p>
                    <FoodImage src={b.image_url} alt="" name={b.title} sizes="80px" className="absolute inset-y-0 right-0 w-1/2 [mask-image:linear-gradient(to_right,transparent,black_40%)]" emojiClassName="text-2xl" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{b.title}</p>
                        {b.subtitle ? <p className="truncate text-xs text-muted-foreground">{b.subtitle}</p> : null}
                      </div>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for banner ${b.title}`} disabled={pending}>
                            <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(b);
                              setOpen(true);
                            }}
                          >
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => act(() => setBannerActive(b.id, !b.is_active), b.is_active ? "Banner hidden" : "Banner is showing")}>
                            {b.is_active ? <EyeOff /> : <Eye />} {b.is_active ? "Hide" : "Show"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm(b)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">Opens {describeLink(b.link_url, names)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={STATUS[st].className}>{STATUS[st].label}</Badge>
                      {b.starts_at || b.ends_at ? (
                        <span className="text-[11px] text-muted-foreground">
                          {b.starts_at ? shortDate(b.starts_at) : "Now"} – {b.ends_at ? shortDate(b.ends_at) : "no end"}
                        </span>
                      ) : null}
                      <span className="ml-auto flex gap-1">
                        <Button variant="outline" size="icon" className="size-8" aria-label={`Move ${b.title} up`} disabled={pending || i === 0} onClick={() => act(() => moveBanner(b.id, "up"), "Order updated")}>
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label={`Move ${b.title} down`}
                          disabled={pending || i === banners.length - 1}
                          onClick={() => act(() => moveBanner(b.id, "down"), "Order updated")}
                        >
                          <ArrowDown />
                        </Button>
                      </span>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <BannerDialog open={open} onOpenChange={setOpen} banner={editing} options={options} />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this banner?</AlertDialogTitle>
            <AlertDialogDescription>“{confirm?.title}” will be removed from the home carousel permanently. Hide it instead if you may need it again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const b = confirm;
                setConfirm(null);
                if (b) act(() => deleteBanner(b.id), "Banner deleted");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
