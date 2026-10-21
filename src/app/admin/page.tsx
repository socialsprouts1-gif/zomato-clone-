import { Bike, IndianRupee, ShoppingBag, Store } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatPaise } from "@/lib/utils";

// Live numbers come from the database in Phase 9; zeros until then.
const stats = [
  { label: "GMV today", value: formatPaise(0), icon: IndianRupee },
  { label: "Orders today", value: "0", icon: ShoppingBag },
  { label: "Active restaurants", value: "0", icon: Store },
  { label: "Riders online", value: "0", icon: Bike },
];

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Live view of the platform." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-display text-xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
