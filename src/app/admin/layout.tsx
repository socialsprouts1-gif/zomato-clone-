import type { Metadata } from "next";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { brand } from "@/config/brand";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: brand.apps.admin.name, template: `%s · ${brand.apps.admin.name}` } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["admin"], "/admin");
  return (
    <div data-app="admin">
      <SidebarShell app="admin" suffix="Admin" headerSlot={
          <>
            <NotificationBell userId={user.id} href="/admin/notifications" />
            <UserMenu name={user.profile.name ?? "Admin"} detail={user.email ?? undefined} />
          </>
        }>
        {children}
      </SidebarShell>
    </div>
  );
}
