import { CircleCheck, Clock, FileSearch, Rocket, ShieldX, Store } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PendingOutlet = { id: string; name: string; locality: string; status: string };

const STEPS = [
  { icon: CircleCheck, title: "Application submitted", body: "Restaurant details, licences and bank account received." },
  { icon: FileSearch, title: "Verification by the Thaali team", body: "We check your FSSAI licence, PAN/GST and bank details. This usually takes 1 business day." },
  { icon: Rocket, title: "Go live", body: "Once approved you can add your menu, take orders and bookings, and switch your outlet online." },
];

/** Status screen for outlets that aren't approved yet (pending / rejected / suspended). */
export function PendingReview({ outlets, showRegisterAnother = false }: { outlets: PendingOutlet[]; showRegisterAnother?: boolean }) {
  return (
    <div className="space-y-4" data-testid="pending-review">
      {outlets.map((o) => {
        const rejected = o.status === "rejected";
        const suspended = o.status === "suspended";
        return (
          <Card key={o.id} className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
                  <Store className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold">{o.name}</h2>
                  <p className="text-sm text-muted-foreground">{o.locality}</p>
                </div>
              </div>
              <Badge variant={rejected || suspended ? "destructive" : "secondary"} className="gap-1">
                {rejected || suspended ? <ShieldX className="size-3" /> : <Clock className="size-3" />}
                {rejected ? "Not approved" : suspended ? "Suspended" : "Under review"}
              </Badge>
            </div>
            {rejected || suspended ? (
              <p className="text-sm text-muted-foreground">
                {rejected
                  ? "Our team couldn't verify this application. Check your notifications for the reason, then register again with corrected details."
                  : "This outlet has been suspended by the Thaali team and is hidden from customers. Check your notifications for details."}
              </p>
            ) : (
              <>
                <h3 className="font-display text-xl font-extrabold">Your restaurant is under review</h3>
                <ol className="space-y-4">
                  {STEPS.map((s, i) => (
                    <li key={s.title} className="flex gap-3">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", i === 0 ? "bg-success text-white" : i === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        <s.icon className="size-4" aria-hidden />
                      </span>
                      <div>
                        <p className="font-semibold">
                          {s.title}
                          {i === 1 ? <span className="ml-2 text-xs font-medium text-primary">In progress</span> : null}
                        </p>
                        <p className="text-sm text-muted-foreground">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">An admin approves new restaurants from the Thaali admin console. You&apos;ll get a notification here as soon as you&apos;re live.</p>
              </>
            )}
          </Card>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/partner/settings">Review outlet settings</Link>
        </Button>
        {showRegisterAnother || outlets.some((o) => o.status === "rejected") ? (
          <Button asChild variant="ghost">
            <Link href="/partner/onboarding?new=1">Register another outlet</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
