"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { formatPaise } from "@/lib/utils";
import { cartTotals, useCart, useCartHydrated } from "./cart-store";

const HIDDEN_ON = ["/cart", "/checkout", "/login", "/welcome"];

/** Floating "View cart" bar above the tab bar. */
export function CartBar() {
  const hydrated = useCartHydrated();
  const { lines, restaurant } = useCart();
  const pathname = usePathname();
  const { t } = useT();
  const { count, subtotal } = cartTotals(lines);
  const show = hydrated && count > 0 && !HIDDEN_ON.some((p) => pathname.startsWith(p)) && !pathname.startsWith("/orders/");
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-0 bottom-[4.25rem] z-30 px-3 md:bottom-4"
        >
          <Link
            href="/cart"
            data-testid="cart-bar"
            className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-success px-4 py-3 text-white shadow-xl transition hover:brightness-110"
          >
            <ShoppingBag className="size-5" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {t("cart.items", { count })} | {formatPaise(subtotal)}
              </span>
              <span className="block truncate text-xs text-white/85">From {restaurant?.name}</span>
            </span>
            <span className="flex items-center text-sm font-bold">
              {t("cart.view")} <ChevronRight className="size-4" />
            </span>
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
