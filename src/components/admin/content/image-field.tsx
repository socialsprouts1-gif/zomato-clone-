"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FoodImage } from "@/components/shared/food-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const PLATFORM_BUCKET = "platform-media";

/** Image picker: upload to the public platform-media bucket, or paste an https link. */
export function ImageField({
  id,
  label,
  folder,
  value,
  onChange,
  error,
  previewName,
}: {
  id: string;
  label: string;
  folder: "banners" | "collections";
  value: string;
  onChange: (url: string) => void;
  error?: string;
  previewName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image");
    if (file.size > 5 * 1024 * 1024) return void toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(PLATFORM_BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      onChange(supabase.storage.from(PLATFORM_BUCKET).getPublicUrl(path).data.publicUrl);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-3">
        <FoodImage src={value || null} alt="" name={previewName || "Image"} sizes="96px" className="h-16 w-24 shrink-0 rounded-xl border" emojiClassName="text-2xl" />
        <div className="grid min-w-0 flex-1 gap-2">
          <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload" aria-invalid={Boolean(error)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Upload image
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <X /> Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Upload ${label.toLowerCase()}`}
        data-testid={`${id}-file`}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
