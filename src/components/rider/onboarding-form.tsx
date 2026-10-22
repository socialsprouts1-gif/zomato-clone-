"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitRiderApplication } from "@/lib/rider/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().regex(/^\+?\d{10,13}$/, "Enter a valid phone number"),
  vehicle_type: z.enum(["bicycle", "scooter", "motorcycle", "ev_scooter"]),
  vehicle_number: z.string().trim().max(15).optional(),
  bank_account_name: z.string().trim().min(2, "Name on the account"),
  bank_account_number: z.string().trim().regex(/^\d{9,18}$/, "9–18 digit account number"),
  bank_ifsc: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, "Invalid IFSC, e.g. SBIN0001234"),
});

function FileField({ id, label, userId, onUploaded }: { id: string; label: string; userId: string; onUploaded: (url: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-card p-3 text-sm hover:border-primary">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4 text-primary" />}
        <span className="truncate">{name ?? "Upload photo or PDF (max 5 MB)"}</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 5 * 1024 * 1024) return void toast.error("File must be under 5 MB");
          setBusy(true);
          const supabase = getSupabaseBrowserClient();
          const path = `${userId}/${id}-${Date.now()}.${f.name.split(".").pop()}`;
          const { error } = await supabase.storage.from("rider-docs").upload(path, f, { upsert: true, contentType: f.type });
          setBusy(false);
          if (error) return void toast.error(error.message);
          setName(f.name);
          onUploaded(path); // private bucket: keep the path; admins view it through a signed URL
        }}
      />
    </div>
  );
}

export function RiderOnboardingForm({ userId, defaults }: { userId: string; defaults: { name: string; phone: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [docs, setDocs] = useState<{ dl?: string; rc?: string }>({});
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaults.name, phone: defaults.phone, vehicle_type: "scooter", vehicle_number: "", bank_account_name: defaults.name, bank_account_number: "", bank_ifsc: "" },
  });
  const err = form.formState.errors;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const res = await submitRiderApplication({ ...v, driving_license_url: docs.dl ?? null, vehicle_rc_url: docs.rc ?? null });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Application submitted. We'll review it shortly.");
          router.push("/rider");
          router.refresh();
        }),
      )}
    >
      <fieldset className="space-y-4">
        <legend className="font-display mb-2 text-lg font-bold">About you</legend>
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...form.register("name")} aria-invalid={Boolean(err.name)} />
          {err.name ? <p className="text-sm text-destructive">{err.name.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" inputMode="tel" {...form.register("phone")} aria-invalid={Boolean(err.phone)} />
          {err.phone ? <p className="text-sm text-destructive">{err.phone.message}</p> : null}
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="font-display mb-2 text-lg font-bold">Vehicle</legend>
        <Controller
          control={form.control}
          name="vehicle_type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Vehicle type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scooter">Scooter</SelectItem>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                <SelectItem value="ev_scooter">Electric scooter</SelectItem>
                <SelectItem value="bicycle">Bicycle</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <div className="space-y-2">
          <Label htmlFor="vehicle_number">Vehicle number</Label>
          <Input id="vehicle_number" placeholder="MH12AB1234" className="uppercase" {...form.register("vehicle_number")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FileField id="dl" label="Driving licence" userId={userId} onUploaded={(url) => setDocs((d) => ({ ...d, dl: url }))} />
          <FileField id="rc" label="Vehicle RC" userId={userId} onUploaded={(url) => setDocs((d) => ({ ...d, rc: url }))} />
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="font-display mb-2 text-lg font-bold">Bank account for payouts</legend>
        <div className="space-y-2">
          <Label htmlFor="ban">Account holder name</Label>
          <Input id="ban" {...form.register("bank_account_name")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="acc">Account number</Label>
            <Input id="acc" inputMode="numeric" type="password" autoComplete="off" {...form.register("bank_account_number")} aria-invalid={Boolean(err.bank_account_number)} />
            {err.bank_account_number ? <p className="text-sm text-destructive">{err.bank_account_number.message}</p> : <p className="text-xs text-muted-foreground">Stored masked. Only the last 4 digits are kept.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ifsc">IFSC</Label>
            <Input id="ifsc" className="uppercase" {...form.register("bank_ifsc")} aria-invalid={Boolean(err.bank_ifsc)} />
            {err.bank_ifsc ? <p className="text-sm text-destructive">{err.bank_ifsc.message}</p> : null}
          </div>
        </div>
      </fieldset>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null} Submit application
      </Button>
    </form>
  );
}
