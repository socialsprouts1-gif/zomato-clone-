"use client";

import { Camera, Loader2, Star, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/lib/orders/post-order-actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const FOOD_GOOD = ["Tasty", "Good quantity", "Well packed", "Fresh", "Value for money", "Hot food"];
const FOOD_BAD = ["Cold food", "Small portion", "Too oily", "Missing item", "Too spicy"];
const DELIVERY_GOOD = ["On time", "Polite rider", "Careful handling", "Followed instructions"];
const DELIVERY_BAD = ["Late delivery", "Rude behaviour", "Spilled food", "Didn't follow instructions"];
const WORDS = ["", "Terrible", "Bad", "Okay", "Good", "Loved it"];

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className="p-1">
          <Star className={cn("size-9 transition", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function Tags({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => (
        <button key={t} type="button" aria-pressed={value.includes(t)} onClick={() => onToggle(t)} className={cn("rounded-full border bg-card px-3 py-1.5 text-sm", value.includes(t) && "border-primary bg-secondary text-secondary-foreground")}>
          {t}
        </button>
      ))}
    </div>
  );
}

export function RateOrderForm({ orderId, userId, restaurantName, riderName }: { orderId: string; userId: string; restaurantName: string; riderName: string | null }) {
  const router = useRouter();
  const [food, setFood] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [foodTags, setFoodTags] = useState<string[]>([]);
  const [deliveryTags, setDeliveryTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const toggle = (set: typeof setFoodTags) => (t: string) => set((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

  async function addPhoto(f: File) {
    if (photos.length >= 4) return void toast.error("Up to 4 photos");
    if (!f.type.startsWith("image/")) return void toast.error("Please choose an image");
    setUploading(true);
    const supabase = getSupabaseBrowserClient();
    const path = `${userId}/${orderId}-${Date.now()}.${f.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("review-photos").upload(path, f, { contentType: f.type });
    setUploading(false);
    if (error) return void toast.error(error.message);
    setPhotos((p) => [...p, supabase.storage.from("review-photos").getPublicUrl(path).data.publicUrl]);
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">How was the food from {restaurantName}?</h2>
        <Stars value={food} onChange={setFood} label="Food rating" />
        {food ? <p className="text-sm font-semibold text-primary">{WORDS[food]}</p> : null}
        {food ? <Tags options={food >= 4 ? FOOD_GOOD : FOOD_BAD} value={foodTags} onToggle={toggle(setFoodTags)} /> : null}
      </Card>
      {riderName ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">How was the delivery by {riderName}?</h2>
          <Stars value={delivery} onChange={setDelivery} label="Delivery rating" />
          {delivery ? <Tags options={delivery >= 4 ? DELIVERY_GOOD : DELIVERY_BAD} value={deliveryTags} onToggle={toggle(setDeliveryTags)} /> : null}
        </Card>
      ) : null}
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Tell others more (optional)</h2>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you love? What could be better?" maxLength={1000} aria-label="Review" />
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p} className="relative size-20 overflow-hidden rounded-xl bg-muted">
              <Image src={p} alt="Your photo" fill sizes="80px" className="object-cover" unoptimized />
              <button type="button" aria-label="Remove photo" onClick={() => setPhotos((x) => x.filter((y) => y !== p))} className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white">
                <X className="size-3" />
              </button>
            </div>
          ))}
          {photos.length < 4 ? (
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground hover:border-primary">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />} Add photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
            </label>
          ) : null}
        </div>
      </Card>
      <Button
        size="lg"
        className="w-full"
        disabled={!food || (Boolean(riderName) && !delivery) || pending}
        onClick={() =>
          start(async () => {
            const res = await submitReview({ orderId, foodRating: food, deliveryRating: riderName ? delivery : null, foodTags, deliveryTags, comment, photoUrls: photos });
            if (!res.ok) return void toast.error(res.error);
            toast.success("Thanks for rating your order!");
            router.push(`/orders/${orderId}`);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Submit rating
      </Button>
    </div>
  );
}
