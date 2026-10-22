"use client";

import { Loader2, Mail, UserPlus, UserX, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changeStaffRole, inviteStaff, removeStaff } from "@/lib/partner/ops-actions";

export type StaffView = { id: string; email: string; role: string; status: string; name: string | null };

const ROLE_LABEL: Record<string, string> = { manager: "Manager", order_taker: "Order taker" };
const ROLE_HELP = "Managers can edit menu, settings and tables. Order takers handle orders and bookings.";

export function StaffSection({ restaurantId, staff, ownerName, canManage }: { restaurantId: string; staff: StaffView[]; ownerName: string; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("order_taker");
  const [removing, setRemoving] = useState<StaffView | null>(null);
  const visible = staff.filter((s) => s.status !== "removed");

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Couldn't update staff");
      toast.success(success);
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-2xl border" aria-label="Staff">
        <li className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{ownerName}</p>
            <p className="text-xs text-muted-foreground">Owner · full access</p>
          </div>
          <Badge variant="secondary">Owner</Badge>
        </li>
        {visible.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3" data-testid="staff-row" data-email={s.email}>
            <div className="min-w-0">
              <p className="truncate font-semibold">{s.name ?? s.email}</p>
              <p className="truncate text-xs text-muted-foreground">{s.name ? s.email : s.status === "invited" ? "Joins when they sign in with this email" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={s.status === "active" ? "success" : "outline"}>{s.status === "active" ? "Active" : "Invited"}</Badge>
              {canManage ? (
                <>
                  <Select value={s.role} onValueChange={(v) => act(() => changeStaffRole(s.id, v), `${s.email} is now ${ROLE_LABEL[v]?.toLowerCase()}`)}>
                    <SelectTrigger className="h-9 w-36" aria-label={`Role for ${s.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="order_taker">Order taker</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${s.email}`} onClick={() => setRemoving(s)}>
                    <UserX className="text-destructive" />
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{ROLE_LABEL[s.role]}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {visible.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden /> No staff yet. {canManage ? "Invite your manager or the person who takes orders." : ""}
        </p>
      ) : null}

      {canManage ? (
        <form
          className="space-y-3 rounded-2xl border border-dashed p-4"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => inviteStaff(restaurantId, email, role), `Invited ${email.trim()}`, () => setEmail(""));
          }}
        >
          <p className="flex items-center gap-2 font-semibold">
            <UserPlus className="size-4 text-primary" aria-hidden /> Invite staff
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="staff-role" aria-label="Staff role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="order_taker">Order taker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : null} Send invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{ROLE_HELP} They get access as soon as they sign in to Thaali with this email.</p>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Only the outlet owner can invite or remove staff. {ROLE_HELP}</p>
      )}

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription>They immediately lose access to this outlet in the partner app.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && act(() => removeStaff(removing.id), `${removing.email} removed`, () => setRemoving(null))}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
