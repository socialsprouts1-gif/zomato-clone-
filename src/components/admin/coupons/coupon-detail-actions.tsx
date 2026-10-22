"use client";

import { Pencil, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCouponActive } from "@/lib/admin/coupons-actions";
import { CouponDialog, type RestaurantOption } from "./coupon-dialog";
import type { Coupon } from "./schema";

export function CouponDetailActions({ coupon, restaurants }: { coupon: Coupon; restaurants: RestaurantOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setCouponActive(coupon.id, !coupon.is_active);
            if (!res.ok) return void toast.error(res.error);
            toast.success(coupon.is_active ? `${coupon.code} deactivated` : `${coupon.code} is active`);
            router.refresh();
          })
        }
      >
        <Power /> {coupon.is_active ? "Deactivate" : "Activate"}
      </Button>
      <Button onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <CouponDialog open={open} onOpenChange={setOpen} coupon={coupon} restaurants={restaurants} />
    </div>
  );
}
