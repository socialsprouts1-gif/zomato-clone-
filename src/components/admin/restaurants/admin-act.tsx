"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Result = { ok: true } | { ok: false; error: string };

/** Runs an admin server action with a toast and a refresh; resolves to whether it succeeded. */
export function useAdminAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<Result>, success: string) =>
    new Promise<boolean>((resolve) => {
      start(async () => {
        const r = await fn();
        if (!r.ok) {
          toast.error(r.error);
          return resolve(false);
        }
        toast.success(success);
        router.refresh();
        resolve(true);
      });
    });
  return { pending, act };
}

/** Button that asks for confirmation before running an admin action. */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  success,
  run,
  variant = "default",
  icon,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  success: string;
  run: () => Promise<Result>;
  variant?: "default" | "outline" | "destructive";
  icon?: React.ReactNode;
}) {
  const { pending, act } = useAdminAct();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void act(run, success)}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
