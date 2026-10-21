import { Star, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReviewsBoard } from "@/components/partner/reviews/reviews-board";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPartnerContext } from "@/lib/partner/context";
import { loadPartnerReviews } from "./data";

export const metadata: Metadata = { title: "Reviews" };

export default async function PartnerReviewsPage() {
  const { current } = await getPartnerContext("/partner/reviews");
  if (!current) {
    return (
      <>
        <PageHeader title="Reviews" />
        <EmptyState
          icon={Store}
          title="No outlet yet"
          description="Register your restaurant to start collecting reviews."
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
        <PageHeader title="Reviews" description={current.name} />
        <EmptyState icon={Star} title="No reviews yet" description="Customers can review you once your restaurant is live and their order is delivered." />
      </>
    );
  }
  const { reviews, summary, average, distribution } = await loadPartnerReviews(current.id);
  return (
    <>
      <PageHeader
        title="Reviews"
        description={`${current.name} · reply to customers publicly`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/restaurant/${current.slug}`}>View public page</Link>
          </Button>
        }
      />
      <ReviewsBoard key={current.id} reviews={reviews} summary={summary} average={average} distribution={distribution} />
    </>
  );
}
