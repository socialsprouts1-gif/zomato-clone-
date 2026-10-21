"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { getUnreadCount } from "@/lib/notifications-actions";
import { showSystemNotification } from "./sw-register";

/** Header bell: unread count, live toasts and (if allowed) system notifications. */
export function NotificationBell({ userId, href = "/notifications", pushEnabled = true }: { userId: string; href?: string; pushEnabled?: boolean }) {
  const [count, setCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    void getUnreadCount().then(setCount);
    const onRead = () => void getUnreadCount().then(setCount);
    window.addEventListener("thaali:notifications-read", onRead);
    return () => window.removeEventListener("thaali:notifications-read", onRead);
  }, [pathname]);
  useRealtime(`notifications:${userId}`, [{ table: "notifications", filter: `user_id=eq.${userId}`, event: "INSERT" }], (p) => {
    void getUnreadCount().then(setCount);
    const n = p?.new as { title?: string; body?: string | null; link?: string | null } | undefined;
    if (!n?.title) return;
    toast(n.title, { description: n.body ?? undefined, action: n.link ? { label: "View", onClick: () => router.push(n.link!) } : undefined });
    if (pushEnabled && document.hidden) void showSystemNotification(n.title, n.body ?? "", n.link ?? "/");
  }, 30000);
  return (
    <Link href={href} aria-label={`Notifications${count ? `, ${count} unread` : ""}`} className="relative flex size-10 items-center justify-center rounded-full hover:bg-accent" data-testid="notification-bell">
      <Bell className="size-5" />
      {count ? (
        <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" data-testid="unread-count">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
