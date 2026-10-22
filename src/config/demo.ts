import type { AppKey } from "@/config/brand";

/**
 * Demo personas shown in the Demo Switcher. The same emails are created by
 * the seed script (Phase 1) with password DEMO_PASSWORD.
 */
export const DEMO_PASSWORD = "Demo@1234";
/** Phone OTP in demo mode (no SMS is sent). */
export const DEMO_OTP = "123456";

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

/** In demo mode, which persona opens each app without a login screen. */
export function personaForPath(path: string): DemoPersona {
  const id = path.startsWith("/admin") ? "admin" : path.startsWith("/partner") ? "owner-1" : path.startsWith("/rider") ? "rider" : "customer";
  return demoPersonas.find((p) => p.id === id)!;
}

/** Where to send a visitor who needs to be signed in: the login page, or (demo mode) an automatic demo sign-in. */
export function signInHref(next: string, demo: boolean): string {
  return demo ? `/demo/enter?as=${personaForPath(next).id}&next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`;
}
