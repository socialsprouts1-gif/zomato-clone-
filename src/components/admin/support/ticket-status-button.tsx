"use client";

import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setTicketStatus } from "@/lib/admin/support-actions";

/** Resolve an open ticket, or reopen a resolved one (the inbox shows it only for resolved tickets; the chat has its own resolve button). */
export function TicketStatusButton({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const resolved = status === "resolved";
  return (
    <Button
      variant={resolved ? "outline" : "default"}
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setTicketStatus(ticketId, resolved ? "open" : "resolved");
          if (!r.ok) return void toast.error(r.error);
          toast.success(resolved ? "Ticket reopened" : "Ticket resolved");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : resolved ? <RotateCcw /> : <CheckCircle2 />}
      {resolved ? "Reopen ticket" : "Resolve ticket"}
    </Button>
  );
}
