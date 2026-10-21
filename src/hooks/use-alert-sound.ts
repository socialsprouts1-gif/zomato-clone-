"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loud, repeating two-tone chime made with WebAudio (no audio file needed).
 * Browsers only allow sound after a user gesture, so `enable()` must be called from a click once.
 */
export function useAlertSound() {
  const ctx = useRef<AudioContext | null>(null);
  const loop = useRef<ReturnType<typeof setInterval> | null>(null);
  const [enabled, setEnabled] = useState(false);

  const chime = useCallback(() => {
    const ac = ctx.current;
    if (!ac || ac.state !== "running") return;
    const now = ac.currentTime;
    [880, 1175, 880, 1175].forEach((f, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.17);
    });
  }, []);

  const enable = useCallback(async () => {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return;
    ctx.current ??= new Ctor();
    await ctx.current.resume();
    setEnabled(ctx.current.state === "running");
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  }, []);

  const start = useCallback(() => {
    if (loop.current) return;
    chime();
    loop.current = setInterval(chime, 2500);
  }, [chime]);

  const stop = useCallback(() => {
    if (loop.current) clearInterval(loop.current);
    loop.current = null;
  }, []);

  useEffect(() => stop, [stop]);
  return { enabled, enable, start, stop, chime };
}

export function browserNotify(title: string, body: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag, icon: "/icons/192", requireInteraction: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // some browsers only allow notifications from a service worker
  }
}
