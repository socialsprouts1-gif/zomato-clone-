"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data?: T } | { ok: false; error: string };

/** Runs a menu server action, toasts the outcome and refreshes the server-rendered menu. */
export function useMenuAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(action: () => Promise<Result<T>>, success?: string, onDone?: (data: T | undefined) => void) =>
      new Promise<boolean>((resolve) => {
        start(async () => {
          const res = await action();
          if (!res.ok) {
            toast.error(res.error);
            resolve(false);
            return;
          }
          if (success) toast.success(success);
          onDone?.(res.data);
          router.refresh();
          resolve(true);
        });
      }),
    [router],
  );
  return { run, pending };
}
