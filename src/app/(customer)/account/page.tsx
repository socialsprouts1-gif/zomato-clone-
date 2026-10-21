import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Profile, addresses, wallet and settings." />
      <EmptyState icon={UserRound} title="You're not signed in" description="Sign in to see your profile, saved addresses and wallet." />
    </>
  );
}
