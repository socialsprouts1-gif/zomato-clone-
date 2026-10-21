import type { Metadata } from "next";
import { SettingsForm } from "@/components/account/settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "Settings" };

type Prefs = { order_updates: boolean; offers: boolean; push: boolean };

export default async function SettingsPage() {
  const [user, prefs] = await Promise.all([requireUser("/account/settings"), getPreferences()]);
  const raw = (user.profile.notification_prefs ?? {}) as Partial<Prefs>;
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm
        vegMode={prefs.vegMode}
        healthyMode={prefs.healthyMode}
        locale={prefs.locale}
        prefs={{ order_updates: raw.order_updates ?? true, offers: raw.offers ?? true, push: raw.push ?? false }}
      />
    </>
  );
}
