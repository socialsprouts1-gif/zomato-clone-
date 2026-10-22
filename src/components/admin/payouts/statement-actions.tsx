"use client";

import { BadgeCheck, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { addPayoutAdjustment, markPayoutPaid } from "@/lib/admin/payouts-actions";

export function AddAdjustmentDialog({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setAmount("");
          setNote("");
          setDirection("credit");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Add adjustment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add adjustment</DialogTitle>
          <DialogDescription>Moves the net payout. Kept when the statement is regenerated.</DialogDescription>
        </DialogHeader>
        <form
          id="adjustment-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const rupees = Number(amount);
            if (!Number.isFinite(rupees) || rupees <= 0) return void toast.error("Enter an amount");
            const paise = Math.round(rupees * 100) * (direction === "debit" ? -1 : 1);
            start(async () => {
              const r = await addPayoutAdjustment(payoutId, paise, note);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Adjustment added");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <RadioGroup value={direction} onValueChange={(v) => setDirection(v as "credit" | "debit")} className="grid grid-cols-2 gap-2" aria-label="Adjustment type">
            <Label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-normal">
              <RadioGroupItem value="credit" /> Credit (+)
            </Label>
            <Label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-normal">
              <RadioGroupItem value="debit" /> Deduction (−)
            </Label>
          </RadioGroup>
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">Amount (₹)</Label>
            <Input id="adj-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Note</Label>
            <Textarea id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} maxLength={300} rows={2} placeholder="Why this changes the payout" />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="adjustment-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MarkPaidButton({ payoutId, label }: { payoutId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Mark as paid
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark this statement paid?</AlertDialogTitle>
          <AlertDialogDescription>{label} Paid statements are locked and can&apos;t be adjusted or regenerated.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const r = await markPayoutPaid(payoutId);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Marked as paid");
                router.refresh();
              })
            }
          >
            Mark paid
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
