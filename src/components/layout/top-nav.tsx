"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, navByApp, type NavApp } from "@/config/navigation";
import { cn } from "@/lib/utils";

/** Horizontal nav for tablet/desktop; the bottom tab bar takes over on phones. */
export function TopNav({ app }: { app: NavApp }) {
  const { items, rootHref } = navByApp[app];
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href, rootHref);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
                  active && "bg-secondary text-secondary-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
