import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Profile" };

export default function RiderProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Vehicle, documents and bank details." />
      <EmptyState icon={UserRound} title="Profile not set up" description="Add your vehicle and documents to start receiving orders." />
    </>
  );
}
