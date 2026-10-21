"use client";

import { useTransition } from "react";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} disabled={pending} onClick={() => start(() => signOut())}>
      {children}
    </button>
  );
}
