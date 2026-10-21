"use client";

import { Banknote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { depositCash } from "@/lib/rider/actions";
import { formatPaise } from "@/lib/utils";

export function DepositCash({ amountPaise }: { amountPaise: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      disabled={pending || amountPaise <= 0}
      onClick={() =>
        start(async () => {
          const r = await depositCash(amountPaise);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`Deposited ${formatPaise(amountPaise)}`, { description: "Simulated UPI deposit to Thaali" });
          router.refresh();
        })
      }
    >
      <Banknote /> Deposit {formatPaise(amountPaise)}
    </Button>
  );
}
