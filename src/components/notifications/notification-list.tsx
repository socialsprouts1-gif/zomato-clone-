"use client";

import { Bell, CheckCheck, Gift, LifeBuoy, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markNotificationsRead } from "@/lib/support/actions";
import { cn } from "@/lib/utils";

type N = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
const ICON = { order: ShoppingBag, offer: Gift, support: LifeBuoy } as Record<string, typeof Bell>;

export function NotificationList({ items }: { items: N[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!items.length) return <EmptyState icon={Bell} title="No notifications yet" description="Order updates and offers will show up here." />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || items.every((i) => i.read_at)}
          onClick={() =>
            start(async () => {
              await markNotificationsRead();
              window.dispatchEvent(new Event("thaali:notifications-read"));
              router.refresh();
            })
          }
        >
          <CheckCheck /> Mark all as read
        </Button>
      </div>
      <Card className="divide-y">
        {items.map((n) => {
          const Icon = ICON[n.type] ?? Bell;
          const inner = (
            <div className={cn("flex gap-3 p-4", !n.read_at && "bg-secondary/40")}>
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</p>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              {!n.read_at ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
            </div>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} className="block hover:bg-accent/40" onClick={() => void markNotificationsRead([n.id]).then(() => window.dispatchEvent(new Event("thaali:notifications-read")))}>
              {inner}
            </Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </Card>
    </div>
  );
}
