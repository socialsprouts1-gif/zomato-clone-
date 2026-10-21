import { Hourglass } from "lucide-react";
import { redirect } from "next/navigation";
import { RiderHome } from "@/components/rider/rider-home";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { loadRiderHome } from "@/lib/rider/data";

export default async function RiderHomePage() {
  const user = await requireRole(["rider", "admin"], "/rider");
  const data = await loadRiderHome(user.id);
  if (!data.rider && user.profile.role === "admin")
    return (
      <>
        <PageHeader title="Rider app" />
        <EmptyState icon={Hourglass} title="You're signed in as an admin" description="Use the Demo Switcher to sign in as a rider and see the delivery flow." />
      </>
    );
  if (!data.rider) redirect("/rider/onboarding");
  if (data.rider.status !== "approved") {
    return (
      <>
        <PageHeader title={`Hi ${data.rider.name.split(" ")[0]}`} />
        <EmptyState
          icon={Hourglass}
          title={data.rider.status === "pending" ? "Your application is under review" : `Your account is ${data.rider.status}`}
          description={data.rider.status === "pending" ? "We're checking your documents. You'll be notified when you can start delivering." : "Please contact support."}
        />
      </>
    );
  }
  return (
    <>
      <PageHeader title={`Ready to ride, ${data.rider.name.split(" ")[0]}?`} description={`${data.rider.vehicle_type.replace("_", " ")} · ${data.rider.vehicle_number ?? ""} · ★ ${data.rider.rating}`} />
      <RiderHome data={data} demoMode={isDemoMode} />
    </>
  );
}
