"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, navByApp, type NavApp } from "@/config/navigation";
import { cn } from "@/lib/utils";

/** Native-app style tab bar, shown on phones only. */
export function BottomTabBar({ app }: { app: NavApp }) {
  const { items, rootHref } = navByApp[app];
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href, rootHref);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
