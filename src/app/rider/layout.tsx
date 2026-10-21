import type { Metadata } from "next";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { TopNav } from "@/components/layout/top-nav";
import { Logo } from "@/components/shared/logo";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: { default: brand.apps.rider.name, template: `%s · ${brand.apps.rider.name}` } };

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col" data-app="rider">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <Logo href="/rider" suffix="Rider" />
          <div className="ml-auto">
            <TopNav app="rider" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28 md:pb-10">
        {children}
      </main>
      <BottomTabBar app="rider" />
    </div>
  );
}
