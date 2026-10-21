import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getSessionUser, homeForRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "No access" };

const help: Record<string, { title: string; body: string; cta?: { href: string; label: string } }> = {
  restaurant_owner: { title: "This is the restaurant partner app", body: "Register your restaurant to start receiving orders." },
  rider: { title: "This is the delivery partner app", body: "Sign up as a delivery partner to start earning.", cta: { href: "/rider/onboarding", label: "Become a delivery partner" } },
  admin: { title: "Admins only", body: "This console is for platform operators." },
};

export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const { need = "" } = await searchParams;
  const user = await getSessionUser();
  const key = need.split(",")[0] ?? "";
  const info = help[key] ?? help.admin!;
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <EmptyState
        icon={ShieldAlert}
        title={info.title}
        description={`${info.body} You're signed in as ${user?.profile.name ?? user?.email ?? "a customer"}.`}
        className="w-full"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {info.cta ? (
              <Button asChild>
                <Link href={info.cta.href}>{info.cta.label}</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={user ? homeForRole(user.profile.role) : "/"}>Go to your app</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
