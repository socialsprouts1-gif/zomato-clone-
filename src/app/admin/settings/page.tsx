import type { Metadata } from "next";
import { FeeSlabsEditor, FeesForm, SurgeForm } from "@/components/admin/settings/pricing-forms";
import { ZonesManager } from "@/components/admin/settings/zones-manager";
import { PageHeader } from "@/components/shared/page-header";
import { assertAdmin } from "@/lib/admin/guard";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Zones & fees" };

const istHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(d)) % 24;

export default async function AdminSettingsPage() {
  await assertAdmin();
  const db = getSupabaseAdminClient();
  const [{ data: zones }, { data: slabs }, { data: s }] = await Promise.all([
    db.from("delivery_zones").select("*").order("created_at"),
    db.from("fee_slabs").select("min_km, max_km, fee_paise").order("min_km"),
    db.from("platform_settings").select("*").single(),
  ]);
  const h = istHour(new Date());

  return (
    <>
      <PageHeader title="Zones & fees" description="Where Thaali delivers and what customers pay on top of their food." />
      <div className="space-y-8">
        <ZonesManager zones={zones ?? []} />
        <section aria-labelledby="fees-title" className="space-y-3">
          <h2 id="fees-title" className="font-display text-lg font-semibold">
            Fees & surge
          </h2>
          {s ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FeeSlabsEditor key={(slabs ?? []).map((x) => `${x.min_km}-${x.max_km}-${x.fee_paise}`).join()} slabs={slabs ?? []} />
              <div className="space-y-4">
                <SurgeForm
                  key={`${s.surge_rain}-${s.surge_late_night}-${s.surge_fee_paise}`}
                  lateNightNow={h >= 23 || h < 6}
                  initial={{ surge_rain: s.surge_rain, surge_late_night: s.surge_late_night, surge_fee_rupees: String(s.surge_fee_paise / 100) }}
                />
                <FeesForm
                  key={`${s.platform_fee_paise}-${s.gst_pct}-${s.max_delivery_km}`}
                  initial={{ platform_fee_rupees: String(s.platform_fee_paise / 100), gst_pct: String(Number(s.gst_pct)), max_delivery_km: String(Number(s.max_delivery_km)) }}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
