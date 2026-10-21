import { Search } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <>
      <PageHeader title="Search" description="Restaurants, dishes and cuisines." />
      <EmptyState icon={Search} title="Search for something tasty" description="Try “biryani”, “pizza” or a restaurant name." />
    </>
  );
}
