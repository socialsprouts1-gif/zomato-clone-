import { Briefcase, Home, MapPin, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddressCardActions } from "@/components/account/address-card-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved addresses" };

export default async function AddressesPage() {
  await requireUser("/account/addresses");
  const supabase = await getSupabaseServerClient();
  const { data: addresses, error } = await supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Saved addresses"
        description="Home, work and other delivery locations."
        actions={
          <Button asChild>
            <Link href="/account/addresses/new">
              <Plus /> Add address
            </Link>
          </Button>
        }
      />
      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add an address with a map pin so riders find you faster."
          action={
            <Button asChild>
              <Link href="/account/addresses/new">Add your first address</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {addresses.map((a) => {
            const Icon = a.label === "Home" ? Home : a.label === "Work" ? Briefcase : MapPin;
            return (
              <li key={a.id}>
                <Card className="flex items-start gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {a.custom_label || a.label} {a.is_default ? <Badge variant="secondary">Default</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{[a.flat, a.line1, a.landmark && `Near ${a.landmark}`].filter(Boolean).join(", ")}</p>
                    {a.instructions ? <p className="mt-1 text-xs text-muted-foreground">“{a.instructions}”</p> : null}
                  </div>
                  <AddressCardActions id={a.id} isDefault={a.is_default} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
