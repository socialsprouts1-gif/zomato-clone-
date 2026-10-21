import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddressForm } from "@/components/account/address-form";
import { PageHeader } from "@/components/shared/page-header";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit address" };

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: a } = await supabase.from("addresses").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const label = a.label === "Work" || a.label === "Other" ? a.label : "Home";
  return (
    <>
      <PageHeader title="Edit address" />
      <AddressForm
        defaults={{
          id: a.id, lat: a.lat, lng: a.lng, label, custom_label: a.custom_label ?? "", flat: a.flat ?? "", line1: a.line1,
          landmark: a.landmark ?? "", area: a.area ?? "", pincode: a.pincode ?? "", instructions: a.instructions ?? "", is_default: a.is_default,
        }}
      />
    </>
  );
}
