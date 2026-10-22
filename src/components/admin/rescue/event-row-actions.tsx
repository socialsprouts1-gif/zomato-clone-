"use client";

import { Loader2, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { deleteEvent, setEventActive } from "@/lib/admin/rescue-actions";

export function EventActiveSwitch({ id, title, active }: { id: string; title: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Switch
        checked={active}
        disabled={pending}
        aria-label={`${title} listed`}
        onCheckedChange={(c) =>
          start(async () => {
            const r = await setEventActive(id, c);
            if (!r.ok) return void toast.error(r.error);
            toast.success(c ? "Event listed" : "Event deactivated");
            router.refresh();
          })
        }
      />
      <span className="text-xs text-muted-foreground">{active ? "Listed" : "Hidden"}</span>
    </span>
  );
}

export function DeleteEventButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete ${title}`} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
          <AlertDialogDescription>This removes the event for good. Events with bookings can only be deactivated.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const r = await deleteEvent(id);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Event deleted");
                router.refresh();
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
