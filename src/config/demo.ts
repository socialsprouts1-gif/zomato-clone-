import type { AppKey } from "@/config/brand";

/**
 * Demo personas shown in the Demo Switcher. The same emails are created by
 * the seed script (Phase 1) with password DEMO_PASSWORD.
 */
export const DEMO_PASSWORD = "Demo@1234";

export type DemoPersona = {
  id: string;
  label: string;
  description: string;
  email: string;
  app: AppKey;
  href: string;
};

export const demoPersonas: DemoPersona[] = [
  {
    id: "customer",
    label: "Customer",
    description: "Priya · Koregaon Park",
    email: "customer@demo.in",
    app: "customer",
    href: "/",
  },
  {
    id: "owner-1",
    label: "Restaurant owner",
    description: "Saffron Courtyard · Koregaon Park",
    email: "owner@demo.in",
    app: "partner",
    href: "/partner",
  },
  {
    id: "owner-2",
    label: "Restaurant owner",
    description: "Baner Biryani House · Baner",
    email: "owner2@demo.in",
    app: "partner",
    href: "/partner",
  },
  {
    id: "owner-3",
    label: "Restaurant owner",
    description: "Green Bowl Co. · Viman Nagar",
    email: "owner3@demo.in",
    app: "partner",
    href: "/partner",
  },
  {
    id: "rider",
    label: "Rider",
    description: "Arjun · Scooter",
    email: "rider@demo.in",
    app: "rider",
    href: "/rider",
  },
  {
    id: "admin",
    label: "Admin",
    description: "Platform operator",
    email: "admin@demo.in",
    app: "admin",
    href: "/admin",
  },
];
