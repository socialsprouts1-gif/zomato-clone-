"use client";

import { Loader2, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteAddress, setDefaultAddress } from "@/lib/account/actions";

export function AddressCardActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Address options">
          {pending ? <Loader2 className="animate-spin" /> : <MoreVertical />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/account/addresses/${id}`}>
            <Pencil /> Edit
          </Link>
        </DropdownMenuItem>
        {!isDefault ? (
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const r = await setDefaultAddress(id);
                if (!r.ok) toast.error(r.error);
                else toast.success("Default address updated");
                router.refresh();
              })
            }
          >
            <Star /> Make default
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() =>
            start(async () => {
              const r = await deleteAddress(id);
              if (!r.ok) toast.error(r.error);
              else toast.success("Address deleted");
              router.refresh();
            })
          }
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
