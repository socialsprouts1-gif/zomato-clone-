import { ChevronDown, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { TopNav } from "@/components/layout/top-nav";
import { Logo } from "@/components/shared/logo";
import { brand } from "@/config/brand";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col" data-app="customer">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Logo className="hidden md:flex" />
          {/* Location picker is wired up in Phase 2. */}
          <Link
            href="/account/addresses"
            className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 hover:bg-accent md:ml-2"
          >
            <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="flex items-center gap-0.5 text-sm font-bold">
                Home <ChevronDown className="size-4" aria-hidden />
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Koregaon Park, {brand.city}
              </span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <TopNav app="customer" />
            <Link
              href="/account"
              aria-label="Your account"
              className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary md:hidden"
            >
              <UserRound className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pb-10">
        {children}
      </main>
      <BottomTabBar app="customer" />
    </div>
  );
}
