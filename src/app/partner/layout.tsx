import type { Metadata } from "next";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: { default: brand.apps.partner.name, template: `%s · ${brand.apps.partner.name}` } };

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="partner">
      <SidebarShell app="partner" suffix="Partner">
        {children}
      </SidebarShell>
    </div>
  );
}
