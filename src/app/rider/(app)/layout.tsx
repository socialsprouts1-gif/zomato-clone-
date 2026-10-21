import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { TopNav } from "@/components/layout/top-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Logo } from "@/components/shared/logo";
import { requireRole } from "@/lib/auth/session";

export default async function RiderAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["rider", "admin"], "/rider");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <Logo href="/rider" suffix="Rider" />
          <div className="ml-auto flex items-center gap-2">
            <TopNav app="rider" />
            <NotificationBell userId={user.id} href="/rider/notifications" />
            <UserMenu name={user.profile.name ?? "Rider"} detail={user.email ?? undefined} />
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
