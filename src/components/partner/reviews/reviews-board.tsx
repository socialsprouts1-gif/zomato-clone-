"use client";

import { Camera, Loader2, MessageSquareQuote, MessageSquareReply, Pencil, Sparkles, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { RatingPill } from "@/components/catalog/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { replyToReview } from "@/lib/partner/reviews-actions";
import { cn } from "@/lib/utils";

export type PartnerReview = {
  id: string;
  kind: string;
  customerName: string | null;
  foodRating: number;
  deliveryRating: number | null;
  foodTags: string[];
  deliveryTags: string[];
  comment: string | null;
  createdAt: string;
  photos: { id: string; url: string }[];
  reply: { body: string; createdAt: string } | null;
  orderId: string | null;
  orderNumber: number | null;
};

type Filter = "all" | "needs_reply" | "low" | "photos";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["needs_reply", "Needs reply"],
  ["low", "1–2★"],
  ["photos", "With photos"],
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function ReviewsBoard({
  reviews,
  average,
  distribution,
  summary,
}: {
  reviews: PartnerReview[];
  average: number;
  distribution: { stars: number; count: number }[];
  summary: { text: string; ai: boolean };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(
    () => ({
      all: reviews.length,
      needs_reply: reviews.filter((r) => !r.reply).length,
      low: reviews.filter((r) => r.foodRating <= 2).length,
      photos: reviews.filter((r) => r.photos.length > 0).length,
    }),
    [reviews],
  );
  const list = reviews.filter((r) => (filter === "needs_reply" ? !r.reply : filter === "low" ? r.foodRating <= 2 : filter === "photos" ? r.photos.length > 0 : true));
  const chip = (on: boolean) => cn("shrink-0 rounded-full border bg-card px-3 py-1.5 text-sm font-medium", on && "border-primary bg-secondary text-secondary-foreground");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Card className="flex gap-5 p-5">
          <div className="shrink-0 text-center">
            <p className="font-display text-4xl font-bold" data-testid="reviews-average">
              {reviews.length ? average.toFixed(1) : "–"}
            </p>
            <p className="mt-1 flex justify-center gap-0.5" aria-label={`Average ${average.toFixed(1)} out of 5`}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={cn("size-3.5", s <= Math.round(average) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} aria-hidden />
              ))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{reviews.length.toLocaleString("en-IN")} reviews</p>
          </div>
          <ul className="flex-1 space-y-1.5" aria-label="Rating distribution">
            {distribution.map(({ stars, count }) => (
              <li key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-3">{stars}</span>
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className={cn("block h-full rounded-full", stars >= 4 ? "bg-success" : stars === 3 ? "bg-amber-400" : "bg-destructive")} style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} />
                </span>
                <span className="w-6 text-right text-muted-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="bg-gradient-to-br from-secondary to-card p-5">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-primary" aria-hidden /> <span data-testid="summary-label">{summary.ai ? "AI summary" : "Summary"}</span>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{summary.ai ? "AI" : "Rule-based"}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed" data-testid="partner-review-summary">
            {summary.text}
          </p>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Filter reviews">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} className={chip(filter === k)} onClick={() => setFilter(k)}>
            {k === "photos" ? <Camera className="mr-1 inline size-3.5" aria-hidden /> : null}
            {l} <span className="text-muted-foreground">({counts[k]})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title={reviews.length ? "Nothing here" : "No reviews yet"}
          description={reviews.length ? (filter === "needs_reply" ? "You've replied to every review. Nice work." : "Try another filter.") : "Reviews from delivered orders will show up here."}
        />
      ) : (
        <ul className="grid gap-3">
          {list.map((r) => (
            <li key={r.id}>
              <ReviewCard review={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ review: r }: { review: PartnerReview }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(r.reply?.body ?? "");
  const [pending, start] = useTransition();
  const tags = [...r.foodTags, ...r.deliveryTags];

  function save() {
    start(async () => {
      const res = await replyToReview(r.id, body);
      if (!res.ok) return void toast.error(res.error);
      toast.success(r.reply ? "Reply updated" : "Reply posted. The customer has been notified.");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3 p-4" data-testid="partner-review" data-review-id={r.id}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground" aria-hidden>
            {(r.customerName ?? "?").slice(0, 1)}
          </span>
          <div>
            <p className="text-sm font-semibold">{r.customerName ?? "Thaali user"}</p>
            <p className="text-xs text-muted-foreground">
              {fmtDate(r.createdAt)} · {r.kind === "dining" ? "Dined in" : "Delivery"}
              {r.orderNumber && r.orderId ? (
                <>
                  {" · "}
                  <Link href={`/partner/orders/${r.orderId}`} className="font-medium text-primary hover:underline">
                    Order #{r.orderNumber}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RatingPill rating={r.foodRating} />
          {r.deliveryRating ? <span className="text-[11px] text-muted-foreground">Delivery {r.deliveryRating}★</span> : null}
        </div>
      </div>
      {r.comment ? <p className="text-sm">{r.comment}</p> : <p className="text-sm text-muted-foreground italic">No written comment</p>}
      {tags.length ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {r.photos.length ? (
        <div className="flex gap-2 overflow-x-auto">
          {r.photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
              <Image src={p.url} alt={`Photo from ${r.customerName ?? "customer"}`} fill sizes="80px" className="object-cover" />
            </a>
          ))}
        </div>
      ) : null}

      {r.reply && !editing ? (
        <div className="rounded-xl border-l-4 border-primary bg-secondary/50 p-3 text-sm" data-testid="review-reply">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-secondary-foreground">Your reply · {fmtDate(r.reply.createdAt)}</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit reply to ${r.customerName ?? "customer"}`}>
              <Pencil /> Edit
            </Button>
          </div>
          <p className="whitespace-pre-line">{r.reply.body}</p>
        </div>
      ) : null}
      {!r.reply && !editing ? (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)} aria-label={`Reply to ${r.customerName ?? "customer"}`}>
          <MessageSquareReply /> Reply
        </Button>
      ) : null}
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Label htmlFor={`reply-${r.id}`} className="text-xs text-muted-foreground">
            {r.reply ? "Edit your public reply" : `Reply to ${r.customerName ?? "this customer"}`}
          </Label>
          <Textarea autoFocus id={`reply-${r.id}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} rows={3} placeholder="Thank them, or tell them what you're doing about it. Replies are public." />
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-muted-foreground">{body.trim().length}/600</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setBody(r.reply?.body ?? "");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || body.trim().length < 2}>
              {pending ? <Loader2 className="animate-spin" /> : <MessageSquareReply />}
              {r.reply ? "Save reply" : "Post reply"}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
