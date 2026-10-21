"use client";

import { EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hideOrderFromHistory } from "@/lib/orders/customer-actions";

export function HideOrderButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label="Hide this order from history"
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await hideOrderFromHistory(orderId);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Order hidden from your history");
          router.refresh();
        });
      }}
    >
      <EyeOff /> Hide
    </Button>
  );
}
