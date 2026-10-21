"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useCart } from "@/components/cart/cart-store";
import { Button } from "@/components/ui/button";
import { buildReorder } from "@/lib/orders/post-order-actions";

export function ReorderButton({ orderId, size = "default", variant = "default" }: { orderId: string; size?: "default" | "sm"; variant?: "default" | "outline" }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const cart = useCart();
  return (
    <Button
      size={size}
      variant={variant}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await buildReorder(orderId);
          if (!res.ok) return void toast.error(res.error);
          cart.clear();
          for (const { qty, ...line } of res.lines) cart.add(res.restaurant, line, qty);
          if (res.skipped.length) toast.warning(`Not available right now: ${res.skipped.join(", ")}`);
          else toast.success("Added everything to your cart");
          router.push("/cart");
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reorder
    </Button>
  );
}
