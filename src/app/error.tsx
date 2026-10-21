"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-lg items-center px-4">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="Please try again. If it keeps happening, contact support."
        action={<Button onClick={reset}>Try again</Button>}
        className="w-full"
      />
    </main>
  );
}
