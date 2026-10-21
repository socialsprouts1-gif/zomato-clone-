import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PayoutStatusBadge({ status }: { status: string }) {
  return status === "paid" ? (
    <Badge variant="success"><CheckCircle2 /> Paid</Badge>
  ) : (
    <Badge variant="secondary"><Clock /> Generated</Badge>
  );
}
