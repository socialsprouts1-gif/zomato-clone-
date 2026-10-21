import { Crown, Leaf, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingPill({ rating, count, className, kind = "delivery" }: { rating: number; count?: number; className?: string; kind?: "delivery" | "dining" }) {
  if (!rating) return <span className={cn("rounded-lg bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground", className)}>New</span>;
  const tone = rating >= 4 ? "bg-success" : rating >= 3.5 ? "bg-lime-600" : rating >= 3 ? "bg-amber-500" : "bg-destructive";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)} aria-label={`${kind === "dining" ? "Dining" : "Delivery"} rating ${rating.toFixed(1)}${count ? ` from ${count} ratings` : ""}`}>
      <span className={cn("inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 font-bold text-white", tone)}>
        {rating.toFixed(1)} <Star className="size-3 fill-current" aria-hidden />
      </span>
      {count !== undefined ? <span className="text-muted-foreground">{count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}</span> : null}
    </span>
  );
}

export function VegDot({ veg, className }: { veg: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2", veg ? "border-veg" : "border-nonveg", className)}
    >
      {veg ? <span className="size-2 rounded-full bg-veg" /> : <span className="size-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-nonveg" />}
    </span>
  );
}

export function GoldBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-400 to-yellow-300 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-950 uppercase", className)}>
      <Crown className="size-3" aria-hidden /> Gold
    </span>
  );
}

export function PureVegTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", className)}>
      <Leaf className="size-3" aria-hidden /> Pure veg
    </span>
  );
}
