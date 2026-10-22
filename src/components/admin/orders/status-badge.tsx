import { Badge } from "@/components/ui/badge";
import { statusMeta, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

const TONE: Record<(typeof statusMeta)[OrderStatus]["tone"], string> = {
  live: "border-transparent bg-primary/12 text-primary dark:bg-primary/20",
  done: "border-transparent bg-success/12 text-success dark:bg-success/20",
  bad: "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
  wait: "border-transparent bg-muted text-muted-foreground",
};

/** Admin label: support cancellations are distinguished from customer ones. */
export function adminStatusLabel(status: OrderStatus) {
  if (status === "CANCELLED") return "Cancelled by support";
  if (status === "CANCELLED_BY_CUSTOMER") return "Cancelled by customer";
  return statusMeta[status].label;
}

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(TONE[statusMeta[status].tone], className)} data-status={status}>
      {adminStatusLabel(status)}
    </Badge>
  );
}
