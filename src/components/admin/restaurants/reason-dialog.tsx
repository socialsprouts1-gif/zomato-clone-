"use client";

import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Destructive action that needs a written reason (reject, suspend, block). The reason is sent to the affected user. */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  presets = [],
  pending,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  presets?: string[];
  pending: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const fieldId = useId();
  const valid = reason.trim().length >= 3;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setReason("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {presets.length ? (
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p} type="button" size="sm" variant={reason === p ? "default" : "outline"} onClick={() => setReason(p)}>
                {p}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor={fieldId}>Reason</Label>
          <Textarea id={fieldId} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} placeholder="Shared with the user in their notification" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!valid || pending}
            onClick={async () => {
              if (await onConfirm(reason.trim())) setOpen(false);
            }}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
