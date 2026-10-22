"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useCheckout } from "./checkout-store";

/** Applies ?coupon=CODE (e.g. from a home banner) to the checkout, then tidies the URL. */
export function CouponFromLink() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCheckout((s) => s.set);
  const code = sp.get("coupon");
  useEffect(() => {
    if (!code || !/^[A-Za-z0-9]{3,20}$/.test(code)) return;
    set({ couponCode: code.toUpperCase() });
    router.replace(pathname, { scroll: false });
  }, [code, set, router, pathname]);
  return null;
}
