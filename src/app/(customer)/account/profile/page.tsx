import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const p = user.profile;
  return (
    <>
      <PageHeader title="Profile" description="How restaurants and riders see you." />
      <Card className="p-5">
        <ProfileForm
          userId={user.id}
          phone={p.phone}
          defaults={{ name: p.name ?? "", email: p.email ?? "", dietary_preference: p.dietary_preference, avatar_url: p.avatar_url }}
        />
      </Card>
    </>
  );
}
