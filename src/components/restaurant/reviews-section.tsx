"use client";

import { Camera, MessageSquareQuote, Sparkles, Star } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { RatingPill } from "@/components/catalog/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ReviewView = {
  id: string;
  kind: string;
  customer_name: string | null;
  food_rating: number;
  delivery_rating: number | null;
  food_tags: string[];
  comment: string | null;
  created_at: string;
  review_photos: { id: string; url: string }[];
  review_replies: { body: string; created_at: string } | null;
};

type Sort = "newest" | "highest" | "lowest";

export function ReviewsSection({
  reviews,
  summary,
  aiSummary,
  ratingDelivery,
  ratingDining,
  deliveryCount,
  diningCount,
}: {
  reviews: ReviewView[];
  summary: string;
  aiSummary: boolean;
  ratingDelivery: number;
  ratingDining: number;
  deliveryCount: number;
  diningCount: number;
}) {
  const [sort, setSort] = useState<Sort>("newest");
  const [filter, setFilter] = useState<"all" | "photos" | "5" | "4" | "low" | "dining">("all");
  const list = useMemo(() => {
    const f = reviews.filter((r) =>
      filter === "photos" ? r.review_photos.length > 0 : filter === "5" ? r.food_rating === 5 : filter === "4" ? r.food_rating === 4 : filter === "low" ? r.food_rating <= 3 : filter === "dining" ? r.kind === "dining" : true,
    );
    return f.sort((a, b) => (sort === "newest" ? b.created_at.localeCompare(a.created_at) : sort === "highest" ? b.food_rating - a.food_rating : a.food_rating - b.food_rating));
  }, [reviews, sort, filter]);
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.food_rating === s).length }));

  const chip = (on: boolean) => cn("shrink-0 rounded-full border bg-card px-3 py-1.5 text-sm font-medium", on && "border-primary bg-secondary text-secondary-foreground");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Card className="grid grid-cols-2 gap-4 p-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Delivery</p>
            <RatingPill rating={ratingDelivery} className="mt-1 text-base" />
            <p className="mt-1 text-xs text-muted-foreground">{deliveryCount.toLocaleString("en-IN")} ratings</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Dining</p>
            <RatingPill rating={ratingDining} kind="dining" className="mt-1 text-base" />
            <p className="mt-1 text-xs text-muted-foreground">{diningCount.toLocaleString("en-IN")} ratings</p>
          </div>
          <div className="col-span-2 space-y-1">
            {dist.map(({ s, n }) => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-3">{s}</span>
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-success" style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} />
                </span>
                <span className="w-6 text-right text-muted-foreground">{n}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-secondary to-card p-5">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-primary" /> {aiSummary ? "AI review summary" : "What people say"}
            {!aiSummary ? <DemoBadge label="Rule-based" /> : null}
          </p>
          <p className="mt-2 text-sm leading-relaxed" data-testid="review-summary">
            {summary}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {(
            [
              ["all", "All"],
              ["photos", "With photos"],
              ["5", "5★"],
              ["4", "4★"],
              ["low", "3★ & below"],
              ["dining", "Dining"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} className={chip(filter === k)} onClick={() => setFilter(k)}>
              {k === "photos" ? <Camera className="mr-1 inline size-3.5" /> : null}
              {l}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort reviews"
          className="ml-auto h-9 rounded-xl border bg-card px-3 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={MessageSquareQuote} title="No reviews here" description="Try another filter." />
      ) : (
        <ul className="grid gap-3">
          {list.map((r) => (
            <li key={r.id}>
              <Card className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                      {(r.customer_name ?? "?").slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{r.customer_name ?? "Thaali user"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {r.kind === "dining" ? "Dined in" : "Delivery"}
                      </p>
                    </div>
                  </div>
                  <RatingPill rating={r.food_rating} />
                </div>
                {r.comment ? <p className="text-sm">{r.comment}</p> : null}
                {r.food_tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {r.food_tags.map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                {r.review_photos.length ? (
                  <div className="flex gap-2">
                    {r.review_photos.map((p) => (
                      <div key={p.id} className="relative size-20 overflow-hidden rounded-xl bg-muted">
                        <Image src={p.url} alt="Photo from review" fill sizes="80px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
                {r.review_replies ? (
                  <div className="rounded-xl border-l-4 border-primary bg-secondary/50 p-3 text-sm">
                    <p className="text-xs font-bold text-secondary-foreground">Reply from the restaurant</p>
                    <p>{r.review_replies.body}</p>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
