"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Celebration shown right after checkout (?placed=1). */
export function PlacedOverlay({ scheduled }: { scheduled: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(params.get("placed") === "1");
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      setShow(false);
      router.replace(pathname, { scroll: false });
    }, 2600);
    return () => clearTimeout(t);
  }, [show, router, pathname]);
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-success text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShow(false)}
        >
          <motion.div
            className="flex size-28 items-center justify-center rounded-full bg-white text-success"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.1 }}
          >
            <motion.span initial={{ pathLength: 0, opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <Check className="size-16" strokeWidth={3} />
            </motion.span>
          </motion.div>
          <motion.p className="font-display text-3xl font-extrabold" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
            {scheduled ? "Order scheduled!" : "Order placed!"}
          </motion.p>
          <motion.p className="text-white/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            {scheduled ? "We'll send it to the kitchen ahead of your slot." : "Sending it to the restaurant…"}
          </motion.p>
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute size-2.5 rounded-sm"
              style={{ background: ["#fde68a", "#fff", "#fdba74", "#bbf7d0"][i % 4], left: "50%", top: "42%" }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: Math.cos((i / 14) * Math.PI * 2) * 180, y: Math.sin((i / 14) * Math.PI * 2) * 180 + 60, opacity: 0, rotate: 270 }}
              transition={{ duration: 1.4, delay: 0.25, ease: "easeOut" }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
