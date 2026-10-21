import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminNotificationsPage() {
  const user = await requireRole(["admin"], "/admin/notifications");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationList items={data ?? []} />
    </>
  );
}
