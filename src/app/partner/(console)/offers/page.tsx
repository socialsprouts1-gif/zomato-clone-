import { Megaphone, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdsPanel } from "@/components/partner/offers/ads-panel";
import { OffersPanel } from "@/components/partner/offers/offers-panel";
import { OffersTabs } from "@/components/partner/offers/offers-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPartnerContext } from "@/lib/partner/context";
import { sponsoredUntil, syncCampaigns, loadOffers } from "./data";

export const metadata: Metadata = { title: "Offers & ads" };

export default async function PartnerOffersPage() {
  const { current } = await getPartnerContext("/partner/offers");
  if (!current) {
    return (
      <>
        <PageHeader title="Offers & ads" />
        <EmptyState
          icon={Store}
          title="No outlet yet"
          description="Register your restaurant to create offers and ad campaigns."
          action={
            <Button asChild>
              <Link href="/partner/onboarding">Register your restaurant</Link>
            </Button>
          }
        />
      </>
    );
  }
  if (current.status !== "approved") {
    return (
      <>
        <PageHeader title="Offers & ads" description={current.name} />
        <EmptyState icon={Megaphone} title="Available once you're live" description="Offers and ads unlock as soon as our team approves your restaurant." />
      </>
    );
  }
  // current comes from the signed-in user's own outlets, so ticking its campaigns is authorised.
  const [{ offers, stats, menu }, campaigns] = await Promise.all([loadOffers(current.id), syncCampaigns(current.id)]);
  return (
    <>
      <PageHeader title="Offers & ads" description={`${current.name} · discounts and promoted listings`} />
      <Suspense>
        <OffersTabs
          offers={<OffersPanel key={current.id} restaurantId={current.id} offers={offers} stats={stats} menu={menu} />}
          ads={<AdsPanel key={current.id} restaurantId={current.id} campaigns={campaigns} sponsoredUntil={sponsoredUntil(campaigns)} />}
        />
      </Suspense>
    </>
  );
}
