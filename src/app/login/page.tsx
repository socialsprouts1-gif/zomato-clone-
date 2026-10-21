import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/shared/logo";
import { brand } from "@/config/brand";
import { getSessionUser, homeForRole, safeNext } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeNext(next, homeForRole(user.profile.role)));

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-primary to-orange-700 p-10 text-primary-foreground lg:flex">
        <Logo className="[&_span]:text-primary-foreground" />
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">{brand.tagline}</h2>
          <p className="mt-3 max-w-md text-primary-foreground/85">{brand.description}</p>
        </div>
        <p className="text-sm text-primary-foreground/70">Delivering across {brand.city}</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-2xl font-bold">Sign in or create an account</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Use your mobile number, email or Google.</p>
          <LoginForm next={next} initialError={error} demoMode={isDemoMode} />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our terms and privacy policy.
          </p>
        </div>
      </section>
    </main>
  );
}
