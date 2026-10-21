import type { Metadata } from "next";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: { default: brand.apps.admin.name, template: `%s · ${brand.apps.admin.name}` } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="admin">
      <SidebarShell app="admin" suffix="Admin">
        {children}
      </SidebarShell>
    </div>
  );
}
