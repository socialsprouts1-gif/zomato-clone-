"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LocationChooser } from "@/components/location/location-chooser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { attachOnboardingMedia, submitOnboarding } from "@/lib/partner/ops-actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const phone = z.string().trim().regex(/^\+?\d{10,13}$/, "Enter a valid phone number");
const schema = z.object({
  name: z.string().trim().min(2, "Enter the restaurant name").max(60),
  cuisines: z
    .string()
    .trim()
    .refine((s) => s.split(",").filter((c) => c.trim().length >= 2).length >= 1, "Add at least one cuisine")
    .refine((s) => s.split(",").filter((c) => c.trim()).length <= 6, "Up to 6 cuisines"),
  phone,
  description: z.string().trim().max(300, "Keep it under 300 characters"),
  cost_for_two_rupees: z.coerce.number({ error: "Enter an amount" }).int("Whole rupees only").min(100, "At least ₹100").max(10000, "At most ₹10,000"),
  is_pure_veg: z.boolean(),
  locality: z.string().trim().min(2, "Enter the locality").max(60),
  address: z.string().trim().min(8, "Enter the full address").max(200),
  lat: z.number({ error: "Pick the location on the map" }),
  lng: z.number(),
  fssai: z.string().trim().regex(/^\d{14}$/, "FSSAI licence number is 14 digits"),
  gst_number: z
    .string()
    .trim()
    .regex(/^(\d{2}[A-Za-z]{5}\d{4}[A-Za-z][A-Za-z\d][Zz][A-Za-z\d])?$/, "Invalid GSTIN, e.g. 27AAPFU0939F1ZV"),
  pan_number: z.string().trim().regex(/^[A-Za-z]{5}\d{4}[A-Za-z]$/, "Invalid PAN, e.g. ABCDE1234F"),
  bank_account_name: z.string().trim().min(2, "Name on the account"),
  bank_account_number: z.string().trim().regex(/^\d{9,18}$/, "9–18 digit account number"),
  bank_ifsc: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, "Invalid IFSC, e.g. SBIN0001234"),
  owner_name: z.string().trim().min(2, "Enter the owner's name"),
  owner_phone: phone,
  owner_email: z.string().trim().email("Enter a valid email"),
});
type Values = z.input<typeof schema>;

const STEPS: { title: string; fields: FieldPath<Values>[] }[] = [
  { title: "Restaurant", fields: ["name", "cuisines", "phone", "cost_for_two_rupees", "description"] },
  { title: "Location", fields: ["lat", "locality", "address"] },
  { title: "Legal & bank", fields: ["fssai", "gst_number", "pan_number", "bank_account_name", "bank_account_number", "bank_ifsc", "owner_name", "owner_phone", "owner_email"] },
  { title: "Photos & documents", fields: [] },
];

const UPLOADS = [
  { key: "cover", label: "Cover photo", accept: "image/*" },
  { key: "logo", label: "Logo", accept: "image/*" },
  { key: "fssai_licence", label: "FSSAI licence", accept: "image/*,application/pdf" },
  { key: "gst_certificate", label: "GST certificate", accept: "image/*,application/pdf" },
  { key: "cancelled_cheque", label: "Cancelled cheque", accept: "image/*,application/pdf" },
] as const;
type UploadKey = (typeof UPLOADS)[number]["key"];

const PUNE = { lat: 18.5204, lng: 73.8567 };

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function OnboardingForm({ defaults }: { defaults: { owner_name: string; owner_phone: string; owner_email: string } }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<Partial<Record<UploadKey, File>>>({});
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      cuisines: "",
      phone: defaults.owner_phone,
      description: "",
      cost_for_two_rupees: "",
      is_pure_veg: false,
      locality: "",
      address: "",
      fssai: "",
      gst_number: "",
      pan_number: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_ifsc: "",
      ...defaults,
    },
  });
  const err = form.formState.errors;
  const lat = form.watch("lat");
  const lng = form.watch("lng");
  const reg = form.register;

  async function next() {
    const ok = await form.trigger(STEPS[step]!.fields, { shouldFocus: true });
    if (!ok) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(v: Values) {
    start(async () => {
      setStatus("Creating your restaurant…");
      const res = await submitOnboarding({
        ...v,
        cuisines: v.cuisines
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c.length >= 2),
        lat: v.lat,
        lng: v.lng,
        gst_number: v.gst_number || undefined,
        description: v.description || undefined,
      });
      if (!res.ok || !res.data) {
        setStatus(null);
        return void toast.error(res.ok ? "Couldn't create the restaurant" : res.error);
      }
      const id = res.data.id;
      const picked = Object.entries(files) as [UploadKey, File][];
      if (picked.length) {
        setStatus("Uploading photos and documents…");
        const supabase = getSupabaseBrowserClient();
        const urls: Partial<Record<UploadKey, string>> = {};
        for (const [key, f] of picked) {
          // Photos are public; legal documents go to a private bucket and we keep only their path.
          const isPhoto = key === "cover" || key === "logo";
          const bucket = isPhoto ? "restaurant-media" : "restaurant-docs";
          const path = `${id}/onboarding/${key}-${crypto.randomUUID()}.${f.name.split(".").pop() ?? "bin"}`;
          const { error } = await supabase.storage.from(bucket).upload(path, f, { upsert: true, contentType: f.type });
          if (error) toast.error(`${UPLOADS.find((u) => u.key === key)?.label} didn't upload. You can send it to us later.`);
          else urls[key] = isPhoto ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : path;
        }
        const documents = Object.fromEntries(Object.entries(urls).filter(([k]) => k !== "cover" && k !== "logo"));
        await attachOnboardingMedia(id, { cover_image_url: urls.cover, logo_url: urls.logo, documents });
      }
      toast.success("Application submitted. We'll review it shortly.");
      router.push("/partner");
      router.refresh();
    });
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit, () => toast.error("Some details need fixing. Check the earlier steps."))} className="space-y-5">
      <ol className="grid grid-cols-4 gap-2" aria-label="Registration steps">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? "step" : undefined} className="space-y-1.5">
            <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>
              {i + 1}. {s.title}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm font-semibold text-muted-foreground sm:hidden">
        Step {step + 1} of {STEPS.length}: {STEPS[step]!.title}
      </p>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-xl font-bold">{STEPS[step]!.title}</h2>

        {step === 0 ? (
          <>
            <Field id="r-name" label="Restaurant name" error={err.name?.message}>
              <Input id="r-name" {...reg("name")} aria-invalid={Boolean(err.name)} />
            </Field>
            <Field id="r-cuisines" label="Cuisines" error={err.cuisines?.message} hint="Separate with commas, e.g. North Indian, Biryani">
              <Input id="r-cuisines" {...reg("cuisines")} aria-invalid={Boolean(err.cuisines)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="r-phone" label="Restaurant phone" error={err.phone?.message}>
                <Input id="r-phone" inputMode="tel" {...reg("phone")} aria-invalid={Boolean(err.phone)} />
              </Field>
              <Field id="r-cost" label="Cost for two (₹)" error={err.cost_for_two_rupees?.message}>
                <Input id="r-cost" type="number" inputMode="numeric" min={100} placeholder="500" {...reg("cost_for_two_rupees")} aria-invalid={Boolean(err.cost_for_two_rupees)} />
              </Field>
            </div>
            <Field id="r-desc" label="Short description (optional)" error={err.description?.message}>
              <Textarea id="r-desc" rows={2} maxLength={300} {...reg("description")} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={form.watch("is_pure_veg")} onCheckedChange={(v) => form.setValue("is_pure_veg", v === true)} aria-label="Pure veg restaurant" />
              Pure veg restaurant
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            {lat !== undefined && lng !== undefined ? (
              <div className="flex items-start justify-between gap-3 rounded-2xl border bg-secondary/40 p-3" data-testid="chosen-location">
                <p className="flex gap-2 text-sm">
                  <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block font-semibold">Pin placed</span>
                    <span className="text-xs text-muted-foreground">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </span>
                  </span>
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    form.resetField("lat");
                    form.resetField("lng");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Find your restaurant so riders and customers can reach you.</p>
                <LocationChooser
                  initialCenter={PUNE}
                  onChosen={(loc) => {
                    form.setValue("lat", loc.lat, { shouldValidate: true });
                    form.setValue("lng", loc.lng);
                    if (!form.getValues("locality")) form.setValue("locality", loc.label, { shouldValidate: true });
                    if (!form.getValues("address")) form.setValue("address", loc.line, { shouldValidate: true });
                  }}
                />
                {err.lat ? <p className="text-sm text-destructive">{err.lat.message}</p> : null}
              </>
            )}
            <Field id="r-locality" label="Locality" error={err.locality?.message}>
              <Input id="r-locality" {...reg("locality")} aria-invalid={Boolean(err.locality)} />
            </Field>
            <Field id="r-address" label="Full address" error={err.address?.message} hint="Shop number, building, street, area and pincode">
              <Textarea id="r-address" rows={2} {...reg("address")} aria-invalid={Boolean(err.address)} />
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="r-fssai" label="FSSAI licence number" error={err.fssai?.message}>
                <Input id="r-fssai" inputMode="numeric" maxLength={14} {...reg("fssai")} aria-invalid={Boolean(err.fssai)} />
              </Field>
              <Field id="r-gst" label="GSTIN (optional)" error={err.gst_number?.message}>
                <Input id="r-gst" className="uppercase" maxLength={15} {...reg("gst_number")} aria-invalid={Boolean(err.gst_number)} />
              </Field>
              <Field id="r-pan" label="PAN" error={err.pan_number?.message}>
                <Input id="r-pan" className="uppercase" maxLength={10} {...reg("pan_number")} aria-invalid={Boolean(err.pan_number)} />
              </Field>
            </div>
            <fieldset className="space-y-4">
              <legend className="font-display mb-2 font-bold">Bank account for payouts</legend>
              <Field id="r-ban" label="Account holder name" error={err.bank_account_name?.message}>
                <Input id="r-ban" {...reg("bank_account_name")} aria-invalid={Boolean(err.bank_account_name)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="r-acc" label="Account number" error={err.bank_account_number?.message} hint="Stored masked. Only the last 4 digits are kept.">
                  <Input id="r-acc" type="password" inputMode="numeric" autoComplete="off" {...reg("bank_account_number")} aria-invalid={Boolean(err.bank_account_number)} />
                </Field>
                <Field id="r-ifsc" label="IFSC" error={err.bank_ifsc?.message}>
                  <Input id="r-ifsc" className="uppercase" maxLength={11} {...reg("bank_ifsc")} aria-invalid={Boolean(err.bank_ifsc)} />
                </Field>
              </div>
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="font-display mb-2 font-bold">Owner details</legend>
              <Field id="r-owner" label="Owner name" error={err.owner_name?.message}>
                <Input id="r-owner" {...reg("owner_name")} aria-invalid={Boolean(err.owner_name)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="r-owner-phone" label="Owner phone" error={err.owner_phone?.message}>
                  <Input id="r-owner-phone" inputMode="tel" {...reg("owner_phone")} aria-invalid={Boolean(err.owner_phone)} />
                </Field>
                <Field id="r-owner-email" label="Owner email" error={err.owner_email?.message}>
                  <Input id="r-owner-email" type="email" {...reg("owner_email")} aria-invalid={Boolean(err.owner_email)} />
                </Field>
              </div>
            </fieldset>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-sm text-muted-foreground">Optional, but it speeds up verification. Images or PDFs up to 5 MB.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {UPLOADS.map((u) => {
                const f = files[u.key];
                return (
                  <div key={u.key} className="space-y-1.5">
                    <Label htmlFor={`up-${u.key}`}>{u.label}</Label>
                    <div className="flex items-center gap-2">
                      <label htmlFor={`up-${u.key}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-card p-3 text-sm hover:border-primary">
                        {f ? <Check className="size-4 shrink-0 text-success" /> : <FileUp className="size-4 shrink-0 text-primary" />}
                        <span className="truncate">{f?.name ?? "Choose file"}</span>
                      </label>
                      {f ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${u.label}`}
                          onClick={() =>
                            setFiles((s) => {
                              const n = { ...s };
                              delete n[u.key];
                              return n;
                            })
                          }
                        >
                          <X />
                        </Button>
                      ) : null}
                    </div>
                    <input
                      id={`up-${u.key}`}
                      type="file"
                      accept={u.accept}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) return void toast.error("File must be under 5 MB");
                        setFiles((s) => ({ ...s, [u.key]: file }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="rounded-2xl bg-muted p-3 text-sm">
              <p className="font-semibold">{form.getValues("name")}</p>
              <p className="text-muted-foreground">
                {form.getValues("cuisines")} · {form.getValues("locality")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">By submitting you confirm these details are correct. Your restaurant goes live after the Thaali team approves it.</p>
            </div>
          </>
        ) : null}
      </Card>

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            <ArrowLeft /> Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button key="next" type="button" onClick={() => void next()}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} {pending && status ? status : "Submit for review"}
          </Button>
        )}
      </div>
    </form>
  );
}
