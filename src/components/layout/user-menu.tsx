"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

export function UserMenu({ name, detail, links = [] }: { name: string; detail?: string; links?: { href: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
            {initials || <UserRound className="size-4" />}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate text-sm text-foreground">{name}</span>
          {detail ? <span className="block truncate font-normal">{detail}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((l) => (
          <DropdownMenuItem key={l.href} asChild>
            <Link href={l.href}>{l.label}</Link>
          </DropdownMenuItem>
        ))}
        {links.length ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem disabled={pending} onSelect={() => start(() => signOut())}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
