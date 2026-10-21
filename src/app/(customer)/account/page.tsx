import { Bell, ChevronRight, Crown, LifeBuoy, LogOut, MapPin, Settings, ShoppingBag, UserRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@/components/account/sign-out-button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };

type MenuLink = { href: string; key: MessageKey; icon: LucideIcon; hint?: string };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const { t } = await getT();
  const supabase = await getSupabaseServerClient();
  const [{ data: wallet }, { count: orderCount }, { data: gold }] = await Promise.all([
    supabase.from("wallets").select("balance_paise").maybeSingle(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", user.id).eq("hidden_by_customer", false),
    supabase.from("gold_memberships").select("ends_at").eq("status", "active").gt("ends_at", new Date().toISOString()).order("ends_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const p = user.profile;

  const links: MenuLink[] = [
    { href: "/account/profile", key: "account.profile", icon: UserRound },
    { href: "/orders", key: "orders.title", icon: ShoppingBag, hint: orderCount ? `${orderCount}` : undefined },
    { href: "/account/addresses", key: "account.addresses", icon: MapPin },
    { href: "/notifications", key: "account.notifications", icon: Bell },
    { href: "/help", key: "account.help", icon: LifeBuoy },
    { href: "/account/settings", key: "account.settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <Card className="flex items-center gap-4 p-5">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-secondary">
          {p.avatar_url ? (
            <Image src={p.avatar_url} alt="" fill sizes="64px" className="object-cover" unoptimized />
          ) : (
            <span className="flex size-full items-center justify-center text-xl font-bold text-secondary-foreground">
              {(p.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-xl font-bold">{p.name || "Add your name"}</h1>
          <p className="truncate text-sm text-muted-foreground">{[p.phone, p.email].filter(Boolean).join(" · ") || user.email}</p>
          {gold ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-xs font-bold text-amber-950">
              <Crown className="size-3" /> Gold member till {new Date(gold.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          ) : null}
        </div>
        <Link href="/account/profile" className="text-sm font-semibold text-primary">
          Edit
        </Link>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("account.wallet")}</p>
          <p className="font-display text-xl font-bold">{formatPaise(wallet?.balance_paise ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Referral code</p>
          <p className="font-display text-xl font-bold tracking-wider">{p.referral_code ?? "—"}</p>
        </Card>
      </div>

      <Card className="divide-y overflow-hidden">
        {links.map(({ href, key, icon: Icon, hint }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-accent/50">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1 font-medium">{t(key)}</span>
            {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
        <SignOutButton className="flex w-full items-center gap-3 px-5 py-4 text-left font-medium text-destructive transition hover:bg-accent/50">
          <LogOut className="size-5" aria-hidden /> {t("common.signOut")}
        </SignOutButton>
      </Card>
    </div>
  );
}
