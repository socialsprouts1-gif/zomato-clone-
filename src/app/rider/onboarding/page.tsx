import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RiderOnboardingForm } from "@/components/rider/onboarding-form";
import { Logo } from "@/components/shared/logo";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Become a delivery partner" };

export default async function RiderOnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/rider/onboarding");
  const supabase = await getSupabaseServerClient();
  const { data: rider } = await supabase.from("riders").select("id").eq("id", user.id).maybeSingle();
  if (rider) redirect("/rider");
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-8">
      <Logo href="/rider" suffix="Rider" />
      <h1 className="font-display mt-6 text-3xl font-extrabold">Earn on your own schedule</h1>
      <p className="mt-2 mb-6 text-muted-foreground">Deliver food across Pune. Weekly payouts, daily incentives, insurance on every trip.</p>
      <Card className="p-5">
        <RiderOnboardingForm userId={user.id} defaults={{ name: user.profile.name ?? "", phone: user.profile.phone ?? "" }} />
      </Card>
    </main>
  );
}
