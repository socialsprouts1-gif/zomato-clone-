import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Saved addresses" };

export default function AccountAddressesPage() {
  return (
    <>
      <PageHeader title="Saved addresses" description="Home, work and other delivery locations." />
      <EmptyState icon={MapPin} title="No saved addresses" description="Add an address with a map pin so riders find you faster." />
    </>
  );
}
