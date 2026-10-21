import {
  BarChart3,
  Bike,
  CalendarCheck,
  ClipboardList,
  Compass,
  History,
  Home,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Ticket,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { MessageKey } from "@/lib/i18n/dictionaries";

export type NavItem = { href: string; label: string; icon: LucideIcon; i18nKey?: MessageKey };

export const customerNav: NavItem[] = [
  { href: "/", label: "Delivery", icon: Home, i18nKey: "nav.delivery" },
  { href: "/dining", label: "Dining", icon: UtensilsCrossed, i18nKey: "nav.dining" },
  { href: "/search", label: "Search", icon: Search, i18nKey: "nav.search" },
  { href: "/orders", label: "Orders", icon: ShoppingBag, i18nKey: "nav.orders" },
  { href: "/account", label: "Account", icon: UserRound, i18nKey: "nav.account" },
];

export const riderNav: NavItem[] = [
  { href: "/rider", label: "Home", icon: Bike },
  { href: "/rider/earnings", label: "Earnings", icon: Wallet },
  { href: "/rider/history", label: "Trips", icon: History },
  { href: "/rider/profile", label: "Profile", icon: UserRound },
];

export const partnerNav: NavItem[] = [
  { href: "/partner", label: "Live orders", icon: ClipboardList },
  { href: "/partner/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/partner/bookings", label: "Table bookings", icon: CalendarCheck },
  { href: "/partner/offers", label: "Offers & ads", icon: Megaphone },
  { href: "/partner/reports", label: "Reports", icon: BarChart3 },
  { href: "/partner/payouts", label: "Payouts", icon: Wallet },
  { href: "/partner/settings", label: "Settings", icon: Settings },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ListChecks },
  { href: "/admin/restaurants", label: "Restaurants", icon: Store },
  { href: "/admin/riders", label: "Riders", icon: Bike },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/coupons", label: "Coupons & banners", icon: Ticket },
  { href: "/admin/settings", label: "Zones & fees", icon: Compass },
];

/** Root paths match exactly; others also match their sub-pages. */
export function isNavActive(pathname: string, href: string, rootHref: string) {
  if (href === rootHref) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavApp = "customer" | "rider" | "partner" | "admin";

/** Server layouts pass an app key; client nav components look up items here (icons can't cross the server/client boundary). */
export const navByApp: Record<NavApp, { items: NavItem[]; rootHref: string }> = {
  customer: { items: customerNav, rootHref: "/" },
  rider: { items: riderNav, rootHref: "/rider" },
  partner: { items: partnerNav, rootHref: "/partner" },
  admin: { items: adminNav, rootHref: "/admin" },
};
