import { Bike } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingForm } from "@/components/partner/onboarding/onboarding-form";
import { PendingReview } from "@/components/partner/onboarding/pending-review";
import { EmptyState } from "@/components/shared/empty-state";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Register your restaurant" };

export default async function PartnerOnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser("/partner/onboarding");
  const { new: another } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const { data: owned } = await supabase.from("restaurants").select("id, name, locality, status").eq("owner_id", user.id).order("created_at", { ascending: false });
  const waiting = (owned ?? []).filter((o) => o.status !== "approved");
  const hasLive = (owned ?? []).some((o) => o.status === "approved");
  const blocked = user.profile.role === "rider" || user.profile.role === "restaurant_staff";

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-8">
      <Logo href={user.profile.role === "customer" ? "/" : "/partner"} suffix="Partner" />
      {blocked ? (
        <EmptyState
          className="mt-8"
          icon={Bike}
          title={user.profile.role === "rider" ? "You're signed in as a delivery partner" : "You're signed in as restaurant staff"}
          description="Restaurants are registered from their owner's account. Sign out and sign in with the owner's email or phone to continue."
          action={
            <Button asChild variant="outline">
              <Link href={user.profile.role === "rider" ? "/rider" : "/partner"}>Go to your app</Link>
            </Button>
          }
        />
      ) : waiting.length && !another ? (
        <>
          <h1 className="font-display mt-6 mb-6 text-3xl font-extrabold">Application status</h1>
          <PendingReview outlets={waiting} showRegisterAnother />
          {hasLive ? (
            <Button asChild className="mt-4">
              <Link href="/partner">Open partner console</Link>
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <h1 className="font-display mt-6 text-3xl font-extrabold">Partner with Thaali</h1>
          <p className="mt-2 mb-6 text-muted-foreground">Reach hungry customers across Pune. Register in about 10 minutes; we verify your details within a business day.</p>
          <OnboardingForm defaults={{ owner_name: user.profile.name ?? "", owner_phone: user.profile.phone ?? "", owner_email: user.profile.email ?? "" }} />
        </>
      )}
    </main>
  );
}
