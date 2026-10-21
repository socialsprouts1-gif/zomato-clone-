import { SidebarShell } from "@/components/layout/sidebar-shell";
import { UserMenu } from "@/components/layout/user-menu";
import { requireRole } from "@/lib/auth/session";

export default async function PartnerConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["restaurant_owner", "restaurant_staff", "admin"], "/partner");
  return (
    <SidebarShell
      app="partner"
      suffix="Partner"
      headerSlot={<UserMenu name={user.profile.name ?? "Partner"} detail={user.email ?? undefined} links={[{ href: "/partner/settings", label: "Outlet settings" }]} />}
    >
      {children}
    </SidebarShell>
  );
}
