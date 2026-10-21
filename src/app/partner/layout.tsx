import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: { default: brand.apps.partner.name, template: `%s · ${brand.apps.partner.name}` } };

export default function PartnerRootLayout({ children }: { children: React.ReactNode }) {
  return <div data-app="partner">{children}</div>;
}
