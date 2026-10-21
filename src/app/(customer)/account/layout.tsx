import { requireUser } from "@/lib/auth/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/account");
  return <div className="mx-auto max-w-4xl">{children}</div>;
}
