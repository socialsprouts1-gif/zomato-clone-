/**
 * Single source of truth for the product brand.
 * Rename the product here; every screen reads from this file.
 */
export const brand = {
  name: "Thaali",
  tagline: "Good food, delivered warm.",
  description:
    "Order food from the best restaurants near you, book a table, and discover what's good in your city.",
  city: "Pune",
  supportEmail: "support@thaali.demo",
  colors: {
    primary: "#F97316",
    primaryDark: "#C2410C",
    charcoal: "#1F2937",
    offWhite: "#FAF7F2",
  },
  apps: {
    customer: { name: "Thaali", path: "/" },
    partner: { name: "Thaali Partner", path: "/partner" },
    rider: { name: "Thaali Rider", path: "/rider" },
    admin: { name: "Thaali Admin", path: "/admin" },
  },
} as const;

export type AppKey = keyof typeof brand.apps;
