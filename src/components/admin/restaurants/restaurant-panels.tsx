"use client";

import { Ban, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  approveRestaurant,
  rejectRestaurant,
  setCollectionMembership,
  setRestaurantCommission,
  suspendRestaurant,
  unsuspendRestaurant,
  updateRestaurantCore,
  type RestaurantCoreInput,
} from "@/lib/admin/restaurants-actions";
import { ConfirmAction, useAdminAct } from "./admin-act";
import { ReasonDialog } from "./reason-dialog";

export function RestaurantStatusActions({ id, name, status }: { id: string; name: string; status: string }) {
  const { pending, act } = useAdminAct();
  if (status === "pending" || status === "rejected") {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfirmAction
          label="Approve"
          icon={<CheckCircle2 aria-hidden />}
          title={`Approve ${name}?`}
          description="The outlet goes live for customers and the owner is notified."
          confirmLabel="Approve restaurant"
          success={`${name} is approved`}
          run={() => approveRestaurant(id)}
        />
        {status === "pending" ? (
          <ReasonDialog
            trigger={
              <Button variant="outline">
                <XCircle aria-hidden /> Reject
              </Button>
            }
            title={`Reject ${name}?`}
            description="The owner sees this reason in their notifications and can apply again."
            confirmLabel="Reject application"
            presets={["FSSAI licence couldn't be verified", "GST / PAN details don't match", "Bank account details are invalid", "Outside our delivery zones"]}
            pending={pending}
            onConfirm={(reason) => act(() => rejectRestaurant(id, reason), "Application rejected")}
          />
        ) : null}
      </div>
    );
  }
  if (status === "approved") {
    return (
      <ReasonDialog
        trigger={
          <Button variant="destructive">
            <Ban aria-hidden /> Suspend
          </Button>
        }
        title={`Suspend ${name}?`}
        description="The outlet is hidden from customers and goes offline until you lift the suspension."
        confirmLabel="Suspend restaurant"
        presets={["Repeated food safety complaints", "Hygiene audit failed", "Payment dispute under review"]}
        pending={pending}
        onConfirm={(reason) => act(() => suspendRestaurant(id, reason), `${name} is suspended`)}
      />
    );
  }
  return (
    <ConfirmAction
      label="Lift suspension"
      icon={<RotateCcw aria-hidden />}
      title={`Lift the suspension on ${name}?`}
      description="The outlet becomes visible to customers again. The owner switches it online."
      confirmLabel="Lift suspension"
      success={`${name} is live again`}
      run={() => unsuspendRestaurant(id)}
    />
  );
}

export function CommissionForm({ id, pct }: { id: string; pct: number }) {
  const { pending, act } = useAdminAct();
  const [value, setValue] = useState(String(pct));
  const fieldId = useId();
  const n = Number(value);
  const valid = value !== "" && Number.isFinite(n) && n >= 0 && n <= 50 && n !== pct;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void act(() => setRestaurantCommission(id, Math.round(n * 100) / 100), `Commission set to ${n}%`);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>Commission %</Label>
        <Input id={fieldId} type="number" inputMode="decimal" min={0} max={50} step={0.5} value={value} onChange={(e) => setValue(e.target.value)} className="w-32" />
      </div>
      <Button type="submit" disabled={!valid || pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save commission
      </Button>
      <p className="w-full text-xs text-muted-foreground">Applies to orders placed from now on. Between 0 and 50%.</p>
    </form>
  );
}

const FLAGS: { key: "is_pure_veg" | "is_featured" | "gold_partner" | "dining_enabled"; label: string; hint: string }[] = [
  { key: "is_pure_veg", label: "Pure veg", hint: "Shows the pure veg badge and passes the veg-mode filter." },
  { key: "is_featured", label: "Featured", hint: "Small boost in the home feed ranking." },
  { key: "gold_partner", label: "Gold partner", hint: "Gold members get free delivery and extra discounts here." },
  { key: "dining_enabled", label: "Dining enabled", hint: "Listed in Dining with table booking." },
];

export function RestaurantCoreForm({ id, defaults }: { id: string; defaults: RestaurantCoreInput }) {
  const { pending, act } = useAdminAct();
  const [v, setV] = useState({ ...defaults, cuisinesText: defaults.cuisines.join(", "), cost: String(defaults.cost_for_two_paise / 100) });
  const ids = { name: useId(), cuisines: useId(), locality: useId(), cost: useId() };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const input: RestaurantCoreInput = {
          name: v.name,
          locality: v.locality,
          cuisines: v.cuisinesText.split(",").map((c) => c.trim()).filter(Boolean),
          cost_for_two_paise: Math.round(Number(v.cost) * 100),
          is_pure_veg: v.is_pure_veg,
          is_featured: v.is_featured,
          gold_partner: v.gold_partner,
          dining_enabled: v.dining_enabled,
        };
        void act(() => updateRestaurantCore(id, input), "Restaurant updated");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={ids.name}>Name</Label>
          <Input id={ids.name} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required minLength={2} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.locality}>Locality</Label>
          <Input id={ids.locality} value={v.locality} onChange={(e) => setV({ ...v, locality: e.target.value })} required minLength={2} maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.cuisines}>Cuisines</Label>
          <Input id={ids.cuisines} value={v.cuisinesText} onChange={(e) => setV({ ...v, cuisinesText: e.target.value })} required aria-describedby={`${ids.cuisines}-hint`} />
          <p id={`${ids.cuisines}-hint`} className="text-xs text-muted-foreground">Comma separated, up to 8.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.cost}>Cost for two (₹)</Label>
          <Input id={ids.cost} type="number" inputMode="numeric" min={50} max={10000} step={10} value={v.cost} onChange={(e) => setV({ ...v, cost: e.target.value })} required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FLAGS.map((f) => (
          <label key={f.key} className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3">
            <span>
              <span className="block text-sm font-semibold">{f.label}</span>
              <span className="block text-xs text-muted-foreground">{f.hint}</span>
            </span>
            <Switch checked={v[f.key]} onCheckedChange={(c) => setV({ ...v, [f.key]: c })} aria-label={f.label} />
          </label>
        ))}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save changes
      </Button>
    </form>
  );
}

export function CollectionsMembership({ id, collections }: { id: string; collections: { id: string; title: string; member: boolean; count: number }[] }) {
  const { pending, act } = useAdminAct();
  const [state, setState] = useState(() => Object.fromEntries(collections.map((c) => [c.id, c.member])));
  return (
    <ul className="divide-y rounded-xl border">
      {collections.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span>
            <span className="block text-sm font-semibold">{c.title}</span>
            <span className="block text-xs text-muted-foreground">{c.count} places</span>
          </span>
          <Switch
            checked={state[c.id]}
            disabled={pending}
            aria-label={`In ${c.title}`}
            onCheckedChange={async (on) => {
              setState((s) => ({ ...s, [c.id]: on }));
              const ok = await act(() => setCollectionMembership(id, c.id, on), on ? `Added to ${c.title}` : `Removed from ${c.title}`);
              if (!ok) setState((s) => ({ ...s, [c.id]: !on }));
            }}
          />
        </li>
      ))}
    </ul>
  );
}
