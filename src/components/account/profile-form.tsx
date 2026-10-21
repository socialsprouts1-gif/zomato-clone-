"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfile } from "@/lib/account/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
  dietary_preference: z.enum(["none", "veg", "vegan", "eggetarian", "non_veg"]),
});

const diets = [
  ["none", "No preference"],
  ["veg", "Vegetarian"],
  ["vegan", "Vegan"],
  ["eggetarian", "Eggetarian"],
  ["non_veg", "Non-vegetarian"],
] as const;

export function ProfileForm({
  userId,
  defaults,
  phone,
}: {
  userId: string;
  defaults: { name: string; email: string; dietary_preference: z.infer<typeof schema>["dietary_preference"]; avatar_url: string | null };
  phone: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [avatar, setAvatar] = useState(defaults.avatar_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: defaults });

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image");
    if (file.size > 3 * 1024 * 1024) return void toast.error("Image must be under 3 MB");
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      setAvatar(url);
      const res = await updateProfile({ ...form.getValues(), avatar_url: url });
      if (!res.ok) throw new Error(res.error);
      toast.success("Photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function submit(values: z.infer<typeof schema>) {
    start(async () => {
      const res = await updateProfile({ ...values, avatar_url: avatar });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Profile saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative size-20 overflow-hidden rounded-full bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Change profile photo"
        >
          {avatar ? (
            <Image src={avatar} alt="" fill sizes="80px" className="object-cover" unoptimized />
          ) : (
            <span className="flex size-full items-center justify-center text-2xl font-bold text-secondary-foreground">
              {(defaults.name || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          </span>
        </button>
        <div className="text-sm">
          <p className="font-semibold">Profile photo</p>
          <p className="text-muted-foreground">JPG or PNG, up to 3 MB.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
        {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email ? <p className="text-sm text-destructive">{form.formState.errors.email.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Mobile number</Label>
        <Input id="phone" value={phone ?? "Not added"} disabled readOnly />
        <p className="text-xs text-muted-foreground">Verified with OTP when you sign in by phone.</p>
      </div>
      <div className="space-y-2">
        <Label>Dietary preference</Label>
        <Controller
          control={form.control}
          name="dietary_preference"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Dietary preference">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {diets.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">Vegetarian or vegan turns on Veg Mode.</p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null} Save profile
      </Button>
    </form>
  );
}
