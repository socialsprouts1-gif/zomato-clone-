"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isNavActive, navByApp, type NavApp, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

function SidebarLinks({
  items,
  rootHref,
  onNavigate,
}: {
  items: NavItem[];
  rootHref: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isNavActive(pathname, href, rootHref);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
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
  );
}

/** Dashboard shell for the partner and admin consoles: fixed sidebar on desktop, drawer on phones. */
export function SidebarShell({
  app,
  suffix,
  headerSlot,
  children,
}: {
  app: NavApp;
  suffix: string;
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { items, rootHref } = navByApp[app];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card p-4 lg:flex">
        <Logo href={rootHref} suffix={suffix} />
        <nav aria-label={`${suffix} navigation`}>
          <SidebarLinks items={items} rootHref={rootHref} />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-4">
              <SheetTitle className="sr-only">{suffix} navigation</SheetTitle>
              <Logo href={rootHref} suffix={suffix} />
              <nav aria-label={`${suffix} navigation`}>
                <SidebarLinks items={items} rootHref={rootHref} onNavigate={() => setOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
          {/* Phones: just the mark, so the header actions fit without horizontal scroll. */}
          <div className="lg:hidden max-sm:[&_a>span]:sr-only">
            <Logo href={rootHref} suffix={suffix} />
          </div>
          <div className="ml-auto flex items-center gap-2">{headerSlot}</div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
