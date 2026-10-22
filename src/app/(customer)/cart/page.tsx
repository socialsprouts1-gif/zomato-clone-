import type { Metadata } from "next";
import { Suspense } from "react";
import { CartView } from "@/components/cart/cart-view";
import { CouponFromLink } from "@/components/cart/coupon-from-link";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <>
      <Suspense>
        <CouponFromLink />
      </Suspense>
      <CartView />
    </>
  );
}
