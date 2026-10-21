import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: { default: brand.apps.rider.name, template: `%s · ${brand.apps.rider.name}` } };

export default function RiderRootLayout({ children }: { children: React.ReactNode }) {
  return <div data-app="rider">{children}</div>;
}
