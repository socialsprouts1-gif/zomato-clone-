import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <EmptyState
        icon={SearchX}
        title="This page went cold"
        description="We couldn't find what you were looking for."
        action={
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        }
        className="w-full"
      />
    </main>
  );
}
