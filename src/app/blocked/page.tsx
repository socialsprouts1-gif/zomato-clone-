import { Ban } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { brand } from "@/config/brand";

export default function BlockedPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <EmptyState
        icon={Ban}
        title="Your account is blocked"
        description={`Please contact ${brand.supportEmail} if you think this is a mistake.`}
        className="w-full"
      />
    </main>
  );
}
