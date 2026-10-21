"use client";

import { useEffect } from "react";

/** Registers the service worker (production only). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

/** Shows a system notification through the service worker (works when the tab is in the background). */
export async function showSystemNotification(title: string, body: string, url: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: "/icons/192", badge: "/icons/192", data: { url }, tag: url });
    else new Notification(title, { body, icon: "/icons/192" });
  } catch {
    // ignore: notifications are best-effort
  }
}
