import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/shared/page-header";
import { getPartnerContext } from "@/lib/partner/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function PartnerNotificationsPage() {
  const { user } = await getPartnerContext("/partner/notifications");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationList items={data ?? []} />
    </>
  );
}
