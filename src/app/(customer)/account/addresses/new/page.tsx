import type { Metadata } from "next";
import { AddressForm } from "@/components/account/address-form";
import { PageHeader } from "@/components/shared/page-header";
import { getPreferences } from "@/lib/preferences";
import { safeNext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add address" };

export default async function NewAddressPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ location }, { next }] = await Promise.all([getPreferences(), searchParams]);
  return (
    <>
      <PageHeader title="Add address" description="Drag the map so the pin sits on your door." />
      <AddressForm defaults={{ lat: location.lat, lng: location.lng }} redirectTo={safeNext(next, "/account/addresses")} />
    </>
  );
}
