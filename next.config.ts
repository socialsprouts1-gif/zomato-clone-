import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets several dev servers run side by side (e.g. NEXT_DIST_DIR=.next-menu).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
