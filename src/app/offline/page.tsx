import { WifiOff } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <EmptyState icon={WifiOff} title="You're offline" description="Check your internet connection. Your cart is saved and will be here when you're back." className="w-full" />
    </main>
  );
}
