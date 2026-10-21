"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FoodImage } from "@/components/shared/food-image";
import { cn } from "@/lib/utils";

type Banner = { id: string; title: string; subtitle: string | null; image_url: string | null; cta_label: string | null; link_url: string; theme: string };

const themes: Record<string, string> = {
  saffron: "from-orange-600 to-amber-500",
  gold: "from-amber-700 to-yellow-500",
  green: "from-emerald-700 to-lime-500",
  plum: "from-fuchsia-800 to-rose-500",
  night: "from-slate-900 to-indigo-700",
};

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [paused, banners.length]);
  if (!banners.length) return null;
  const b = banners[i]!;
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Offers"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative h-44 overflow-hidden rounded-3xl md:h-56">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={b.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            <Link href={b.link_url} className={cn("flex size-full items-stretch bg-gradient-to-r text-white", themes[b.theme] ?? themes.saffron)}>
              <div className="relative z-10 flex flex-1 flex-col justify-center gap-2 p-6 md:p-10">
                <h2 className="font-display text-2xl leading-tight font-extrabold md:text-4xl">{b.title}</h2>
                {b.subtitle ? <p className="text-sm text-white/85 md:text-base">{b.subtitle}</p> : null}
                {b.cta_label ? (
                  <span className="mt-1 w-fit rounded-full bg-white px-4 py-1.5 text-sm font-bold text-foreground">{b.cta_label}</span>
                ) : null}
              </div>
              <FoodImage
                src={b.image_url}
                alt=""
                name={b.title}
                sizes="40vw"
                className="hidden w-2/5 [mask-image:linear-gradient(to_right,transparent,black_35%)] sm:block"
                emojiClassName="text-7xl"
              />
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {banners.map((x, idx) => (
          <button
            key={x.id}
            type="button"
            aria-label={`Show offer ${idx + 1}: ${x.title}`}
            aria-current={idx === i}
            onClick={() => setI(idx)}
            className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30")}
          />
        ))}
      </div>
    </section>
  );
}
