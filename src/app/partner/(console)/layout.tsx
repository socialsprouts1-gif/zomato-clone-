import { SidebarShell } from "@/components/layout/sidebar-shell";
import { UserMenu } from "@/components/layout/user-menu";
import { OutletSwitcher } from "@/components/partner/outlet-controls";
import { getPartnerContext } from "@/lib/partner/context";

export default async function PartnerConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, outlets, current } = await getPartnerContext("/partner");
  return (
    <SidebarShell
      app="partner"
      suffix="Partner"
      headerSlot={
        <>
          <OutletSwitcher outlets={outlets} current={current} />
          <UserMenu name={user.profile.name ?? "Partner"} detail={user.email ?? undefined} links={[{ href: "/partner/settings", label: "Outlet settings" }]} />
        </>
      }
    >
      {children}
    </SidebarShell>
  );
}
