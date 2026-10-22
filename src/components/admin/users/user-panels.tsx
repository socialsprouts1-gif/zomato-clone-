"use client";

import { Ban, Loader2, ShieldCheck, WalletCards } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmAction, useAdminAct } from "@/components/admin/restaurants/admin-act";
import { ReasonDialog } from "@/components/admin/restaurants/reason-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creditWallet, setUserBlocked } from "@/lib/admin/users-actions";

export function BlockControls({ id, name, blocked }: { id: string; name: string; blocked: boolean }) {
  const { pending, act } = useAdminAct();
  if (blocked) {
    return (
      <ConfirmAction
        label="Unblock"
        icon={<ShieldCheck aria-hidden />}
        variant="outline"
        title={`Unblock ${name}?`}
        description="They can sign in and order again. We'll let them know."
        confirmLabel="Unblock user"
        success={`${name} is unblocked`}
        run={() => setUserBlocked(id, false)}
      />
    );
  }
  return (
    <ReasonDialog
      trigger={
        <Button variant="destructive">
          <Ban aria-hidden /> Block
        </Button>
      }
      title={`Block ${name}?`}
      description="They lose access to their account and apps on their next page load and can't place orders. The reason is kept in the audit log."
      confirmLabel="Block user"
      presets={["Repeated fake orders", "Abusive behaviour with riders", "Payment fraud suspected"]}
      pending={pending}
      onConfirm={(reason) => act(() => setUserBlocked(id, true, reason), `${name} is blocked`)}
    />
  );
}

export function CreditWalletDialog({ id, name }: { id: string; name: string }) {
  const { pending, act } = useAdminAct();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const ids = { amount: useId(), note: useId() };
  const rupees = Number(amount);
  const valid = Number.isInteger(rupees) && rupees >= 1 && rupees <= 10000 && note.trim().length >= 3;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setAmount("");
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <WalletCards aria-hidden /> Add credits
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            if (await act(() => creditWallet(id, { rupees, note: note.trim() }), `₹${rupees} added to ${name}'s wallet`)) setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Add Thaali Money</DialogTitle>
            <DialogDescription>Credited instantly to {name}&apos;s wallet. They get a notification with your note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={ids.amount}>Amount (₹)</Label>
            <Input id={ids.amount} type="number" inputMode="numeric" min={1} max={10000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.note}>Note</Label>
            <Input id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. Sorry about the late delivery" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Credit wallet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
