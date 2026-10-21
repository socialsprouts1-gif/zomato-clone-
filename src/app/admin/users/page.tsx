import { Users } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader title="Users" description="Customers, blocks and wallet credits." />
      <EmptyState icon={Users} title="No users yet" description="Customer accounts appear here." />
    </>
  );
}
