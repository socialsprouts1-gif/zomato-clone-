import { Bike, Power } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function RiderHomePage() {
  return (
    <>
      <PageHeader title="Ready to ride?" description="Go online to start receiving delivery requests nearby." />
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 p-5">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Power className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">You&apos;re offline</p>
            <p className="text-sm text-muted-foreground">The online toggle and live location go live in Phase 6.</p>
          </div>
        </CardContent>
      </Card>
      <EmptyState icon={Bike} title="No active delivery" description="New order requests appear here with a 30-second timer." />
    </>
  );
}
