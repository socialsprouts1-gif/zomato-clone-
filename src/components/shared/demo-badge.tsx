import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small label marking anything simulated for the demo (OTP, riders, payouts…). */
export function DemoBadge({ label = "Demo mode", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-primary/60 bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </span>
  );
}
