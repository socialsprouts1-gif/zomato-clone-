import { FileCheck, Landmark, Star } from "lucide-react";
import type { Metadata } from "next";
import { DepositCash } from "@/components/rider/deposit-cash";
import { DemoBadge } from "@/components/shared/demo-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile" };

export default async function RiderProfilePage() {
  const user = await requireRole(["rider", "admin"], "/rider/profile");
  const supabase = await getSupabaseServerClient();
  const [{ data: r }, { data: p }, { data: deposits }] = await Promise.all([
    supabase.from("riders").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("rider_private").select("*").eq("rider_id", user.id).maybeSingle(),
    supabase.from("rider_cash_deposits").select("*").eq("rider_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  return (
    <>
      <PageHeader title="Profile" />
      <div className="space-y-4">
        <Card className="space-y-1 p-5">
          <p className="font-display text-xl font-bold">{r?.name}</p>
          <p className="text-sm text-muted-foreground">{r?.phone}</p>
          <p className="text-sm capitalize">
            {r?.vehicle_type.replace("_", " ")} · {r?.vehicle_number}
          </p>
          <p className="flex items-center gap-1 text-sm font-semibold">
            <Star className="size-4 fill-amber-400 text-amber-400" /> {r?.rating} from {r?.rating_count} ratings
          </p>
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Cash in hand (COD)</p>
            <DemoBadge />
          </div>
          <p className="font-display text-2xl font-bold">{formatPaise(r?.floating_cash_paise ?? 0)}</p>
          <DepositCash amountPaise={r?.floating_cash_paise ?? 0} />
          {deposits?.length ? (
            <ul className="text-xs text-muted-foreground">
              {deposits.map((d) => (
                <li key={d.id}>
                  {d.reference} · {formatPaise(d.amount_paise)} · {new Date(d.created_at).toLocaleDateString("en-IN")}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
        <Card className="space-y-2 p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Landmark className="size-4 text-primary" /> Bank account
          </p>
          <p>
            {p?.bank_account_name} · {p?.bank_account_number_masked} · {p?.bank_ifsc}
          </p>
          <p className="flex items-center gap-2 pt-2 font-semibold">
            <FileCheck className="size-4 text-primary" /> Documents
          </p>
          <p className="text-muted-foreground">Driving licence: {p?.driving_license_url ? "uploaded" : "verified offline"} · Vehicle RC: {p?.vehicle_rc_url ? "uploaded" : "verified offline"}</p>
        </Card>
      </div>
    </>
  );
}
