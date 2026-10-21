import type { Metadata } from "next";
import { WelcomeFlow } from "@/components/location/welcome-flow";
import { safeNext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <WelcomeFlow next={safeNext(next)} />;
}
