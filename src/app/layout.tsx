import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { DemoSwitcher } from "@/components/demo/demo-switcher";
import { brand } from "@/config/brand";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { I18nProvider } from "@/lib/i18n/client";
import { getPreferences } from "@/lib/preferences";
import { Providers } from "./providers";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans-app", display: "swap" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display-app",
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${brand.name} · ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: brand.colors.primary,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [prefs, user] = await Promise.all([getPreferences(), getSessionUser()]);
  return (
    <html lang={prefs.locale} suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded-xl bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <Providers>
          <I18nProvider locale={prefs.locale}>
            {children}
            {isDemoMode ? <DemoSwitcher currentEmail={user?.email ?? null} /> : null}
          </I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
