"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useFieldArray, useForm, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FoodImage } from "@/components/shared/food-image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteItem, saveItem } from "@/lib/partner/menu-actions";
import { HEALTHY_SCORES, type PartnerCategory, type PartnerItem } from "@/lib/partner/menu-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { useMenuAction } from "./use-menu-action";

const rupees = z.string().trim().regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter an amount like 249 or 249.50");
const optNumber = z.string().trim().regex(/^(\d{1,5}(\.\d)?)?$/, "Numbers only");
const optInt = z.string().trim().regex(/^\d{0,6}$/, "Whole numbers only");

const formSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the dish name").max(80),
    description: z.string().trim().max(400),
    price: rupees,
    categoryId: z.string().min(1, "Pick a category"),
    diet: z.enum(["veg", "egg", "nonveg"]),
    bestseller: z.boolean(),
    tags: z.string().max(260),
    imageUrl: z.string().nullable(),
    calories: optInt,
    protein: optNumber,
    carbs: optNumber,
    fat: optNumber,
    grams: optInt,
    healthy: z.string(),
    variantGroupName: z.string().trim().max(40),
    defaultVariant: z.number().int(),
    variants: z.array(z.object({ id: z.string().optional(), name: z.string().trim().min(1, "Name the variant").max(40), price: rupees })),
    addonGroups: z.array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Name the group").max(50),
        min: z.string().regex(/^\d{1,2}$/, "0–20"),
        max: z.string().regex(/^\d{1,2}$/, "1–20"),
        addons: z
          .array(z.object({ id: z.string().optional(), name: z.string().trim().min(1, "Name the add-on").max(50), price: rupees, veg: z.boolean() }))
          .min(1, "Add at least one add-on"),
      }),
    ),
    trackStock: z.boolean(),
    stockQty: optInt,
    lowStockThreshold: z.string().regex(/^\d{1,4}$/, "Whole number"),
  })
  .superRefine((v, ctx) => {
    if (v.trackStock && v.stockQty === "") ctx.addIssue({ code: "custom", message: "Enter the quantity in stock", path: ["stockQty"] });
    v.addonGroups.forEach((g, i) => {
      const min = Number(g.min);
      const max = Number(g.max);
      if (max < 1) ctx.addIssue({ code: "custom", message: "Max must be at least 1", path: ["addonGroups", i, "max"] });
      else if (max < min) ctx.addIssue({ code: "custom", message: "Max must be at least min", path: ["addonGroups", i, "max"] });
      if (min > g.addons.length) ctx.addIssue({ code: "custom", message: "Min is more than the add-ons listed", path: ["addonGroups", i, "min"] });
    });
  });
type Values = z.infer<typeof formSchema>;

const toPaise = (s: string) => Math.round(Number(s) * 100);
const fromPaise = (p: number) => (p % 100 ? (p / 100).toFixed(2) : String(p / 100));
const num = (s: string) => (s.trim() === "" ? null : Number(s));

function defaultsFor(item: PartnerItem | null, categoryId: string): Values {
  const variants = item?.item_variants ?? [];
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? fromPaise(item.price_paise) : "",
    categoryId: item?.category_id ?? categoryId,
    diet: item ? (item.is_veg ? "veg" : item.contains_egg ? "egg" : "nonveg") : "veg",
    bestseller: item?.bestseller ?? false,
    tags: item?.tags.join(", ") ?? "",
    imageUrl: item?.image_url ?? null,
    calories: item?.calories?.toString() ?? "",
    protein: item?.protein_g?.toString() ?? "",
    carbs: item?.carbs_g?.toString() ?? "",
    fat: item?.fat_g?.toString() ?? "",
    grams: item?.grams?.toString() ?? "",
    healthy: item?.healthy_score ?? "",
    variantGroupName: item?.variant_group_name ?? "",
    defaultVariant: Math.max(0, variants.findIndex((v) => v.is_default)),
    variants: variants.map((v) => ({ id: v.id, name: v.name, price: fromPaise(v.price_paise) })),
    addonGroups: (item?.addon_groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      min: String(g.min_select),
      max: String(g.max_select),
      addons: g.addons.map((a) => ({ id: a.id, name: a.name, price: fromPaise(a.price_paise), veg: a.is_veg })),
    })),
    trackStock: item ? item.stock_qty !== null : false,
    stockQty: item?.stock_qty?.toString() ?? "",
    lowStockThreshold: String(item?.low_stock_threshold ?? 5),
  };
}

export type EditorState = { item: PartnerItem | null; categoryId: string } | null;

export function ItemEditor({
  restaurantId,
  categories,
  state,
  onClose,
}: {
  restaurantId: string;
  categories: PartnerCategory[];
  state: EditorState;
  onClose: () => void;
}) {
  return (
    <Sheet open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {state ? <EditorForm key={state.item?.id ?? `new-${state.categoryId}`} restaurantId={restaurantId} categories={categories} item={state.item} categoryId={state.categoryId} onDone={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditorForm({
  restaurantId,
  categories,
  item,
  categoryId,
  onDone,
}: {
  restaurantId: string;
  categories: PartnerCategory[];
  item: PartnerItem | null;
  categoryId: string;
  onDone: () => void;
}) {
  const { run, pending } = useMenuAction();
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: defaultsFor(item, categoryId) });
  const { register, control, watch, setValue, formState } = form;
  const errors = formState.errors;
  const variants = useFieldArray({ control, name: "variants" });
  const groups = useFieldArray({ control, name: "addonGroups" });
  const [name, imageUrl, trackStock] = watch(["name", "imageUrl", "trackStock"]);
  const tops = categories.filter((c) => !c.parent_id);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image");
    if (file.size > 5 * 1024 * 1024) return void toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${restaurantId}/menu/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("restaurant-media").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setValue("imageUrl", supabase.storage.from("restaurant-media").getPublicUrl(path).data.publicUrl, { shouldDirty: true });
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(v: Values) {
    const diet = v.diet;
    void run(
      () =>
        saveItem({
          id: item?.id,
          restaurantId,
          categoryId: v.categoryId,
          name: v.name,
          description: v.description || null,
          pricePaise: toPaise(v.price),
          isVeg: diet === "veg",
          containsEgg: diet === "egg",
          bestseller: v.bestseller,
          tags: v.tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
          imageUrl: v.imageUrl,
          calories: num(v.calories),
          protein_g: num(v.protein),
          carbs_g: num(v.carbs),
          fat_g: num(v.fat),
          grams: num(v.grams),
          healthy_score: (v.healthy || null) as (typeof HEALTHY_SCORES)[number] | null,
          variantGroupName: v.variantGroupName || null,
          variants: v.variants.map((x, i) => ({ id: x.id, name: x.name, pricePaise: toPaise(x.price), isDefault: i === v.defaultVariant })),
          addonGroups: v.addonGroups.map((g) => ({
            id: g.id,
            name: g.name,
            minSelect: Number(g.min),
            maxSelect: Number(g.max),
            addons: g.addons.map((a) => ({ id: a.id, name: a.name, pricePaise: toPaise(a.price), isVeg: a.veg })),
          })),
          trackStock: v.trackStock,
          stockQty: v.trackStock ? num(v.stockQty) : null,
          lowStockThreshold: Number(v.lowStockThreshold),
        }),
      item ? "Item saved" : "Item added",
      onDone,
    );
  }

  return (
    <form onSubmit={form.handleSubmit(submit, () => toast.error("Check the highlighted fields"))} noValidate className="flex min-h-full flex-col">
      <SheetHeader className="px-5 pt-5 pb-4">
        <SheetTitle>{item ? `Edit ${item.name}` : "New item"}</SheetTitle>
        <SheetDescription>Prices are in rupees. Changes show on your menu right away.</SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-5 pb-5">
        <div className="flex items-start gap-4">
          <div className="relative">
            <FoodImage src={imageUrl} alt={name || "Item photo"} name={name || "dish"} sizes="96px" className="size-24 rounded-2xl" />
            {imageUrl ? (
              <button
                type="button"
                onClick={() => setValue("imageUrl", null, { shouldDirty: true })}
                className="absolute -top-2 -right-2 rounded-full border bg-card p-1 shadow-sm"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} {imageUrl ? "Change photo" : "Upload photo"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 5 MB. Square photos look best.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Item photo"
              data-testid="item-photo-input"
              onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
            />
            {imageUrl ? <span className="sr-only" data-testid="item-photo-url">{imageUrl}</span> : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-name">Name</Label>
          <Input id="item-name" {...register("name")} aria-invalid={Boolean(errors.name)} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-description">Description</Label>
          <Textarea id="item-description" rows={2} {...register("description")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="item-price">Price (₹)</Label>
            <Input id="item-price" inputMode="decimal" {...register("price")} aria-invalid={Boolean(errors.price)} />
            <FieldError message={errors.price?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-category">Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="item-category">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {tops.flatMap((t) => [
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>,
                      ...categories
                        .filter((c) => c.parent_id === t.id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {t.name} › {c.name}
                          </SelectItem>
                        )),
                    ])}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.categoryId?.message} />
          </div>
        </div>

        <Controller
          control={control}
          name="diet"
          render={({ field }) => (
            <div className="space-y-1.5">
              <p className="text-sm font-medium" id="diet-label">
                Food type
              </p>
              <div role="radiogroup" aria-labelledby="diet-label" className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["veg", "Veg", "border-veg"],
                    ["egg", "Egg", "border-amber-500"],
                    ["nonveg", "Non-veg", "border-nonveg"],
                  ] as const
                ).map(([value, label, border]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === value}
                    onClick={() => field.onChange(value)}
                    className={cn("h-10 rounded-xl border-2 text-sm font-semibold transition", field.value === value ? cn(border, "bg-secondary") : "border-input text-muted-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        />

        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <Label htmlFor="item-bestseller">Mark as bestseller</Label>
          <Controller control={control} name="bestseller" render={({ field }) => <Switch id="item-bestseller" checked={field.value} onCheckedChange={field.onChange} />} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-tags">Tags</Label>
          <Input id="item-tags" placeholder="spicy, chef special, jain" {...register("tags")} />
          <p className="text-xs text-muted-foreground">Separate with commas.</p>
        </div>
      </div>

      <Section
        title="Variants"
        hint="Sizes or portions. Each variant has its own full price."
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => variants.append({ name: "", price: watch("price") || "" })}>
            <Plus /> Add variant
          </Button>
        }
      >
        {variants.fields.length ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="variant-group">Variant label</Label>
              <Input id="variant-group" placeholder="Size" {...register("variantGroupName")} />
            </div>
            <Controller
              control={control}
              name="defaultVariant"
              render={({ field: def }) => (
                <ul className="space-y-2">
                  {variants.fields.map((f, i) => (
                    <li key={f.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Input aria-label={`Variant ${i + 1} name`} placeholder="Half" {...register(`variants.${i}.name`)} />
                        <Input aria-label={`Variant ${i + 1} price`} placeholder="₹" inputMode="decimal" className="w-24" {...register(`variants.${i}.price`)} />
                        <label className="flex shrink-0 items-center gap-1.5 text-xs">
                          <input type="radio" name="default-variant" checked={def.value === i} onChange={() => def.onChange(i)} aria-label={`Variant ${i + 1} is default`} className="accent-primary" />
                          Default
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove variant ${i + 1}`}
                          onClick={() => {
                            variants.remove(i);
                            if (def.value >= i && def.value > 0) def.onChange(def.value - 1);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <FieldError message={errors.variants?.[i]?.name?.message ?? errors.variants?.[i]?.price?.message} />
                    </li>
                  ))}
                </ul>
              )}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No variants — the item sells at its base price.</p>
        )}
      </Section>

      <Section
        title="Add-on groups"
        hint="Extras customers can pick, like toppings or sides."
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => groups.append({ name: "", min: "0", max: "1", addons: [{ name: "", price: "0", veg: true }] })}>
            <Plus /> Add group
          </Button>
        }
      >
        {groups.fields.length ? (
          <ul className="space-y-3">
            {groups.fields.map((f, gi) => (
              <AddonGroupFields key={f.id} index={gi} control={control} register={register} errors={errors} onRemove={() => groups.remove(gi)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No add-ons.</p>
        )}
      </Section>

      <Section title="Stock" hint="Track quantity to auto-hide the item when it runs out.">
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <Label htmlFor="item-track">Track stock quantity</Label>
          <Controller control={control} name="trackStock" render={({ field }) => <Switch id="item-track" checked={field.value} onCheckedChange={field.onChange} />} />
        </div>
        {trackStock ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-qty">Quantity in stock</Label>
              <Input id="item-qty" inputMode="numeric" {...register("stockQty")} aria-invalid={Boolean(errors.stockQty)} />
              <FieldError message={errors.stockQty?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-threshold">Low-stock alert at</Label>
              <Input id="item-threshold" inputMode="numeric" {...register("lowStockThreshold")} />
              <FieldError message={errors.lowStockThreshold?.message} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Untracked — use the In stock switch to hide it manually.</p>
        )}
      </Section>

      <Section title="Nutrition" hint="Optional. Shown to customers in healthy mode.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ["calories", "Calories (kcal)"],
              ["protein", "Protein (g)"],
              ["carbs", "Carbs (g)"],
              ["fat", "Fat (g)"],
              ["grams", "Portion (g)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`item-${key}`}>{label}</Label>
              <Input id={`item-${key}`} inputMode="decimal" {...register(key)} />
              <FieldError message={errors[key]?.message} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="item-healthy">Healthy score</Label>
            <Controller
              control={control}
              name="healthy"
              render={({ field }) => (
                <Select value={field.value || "auto"} onValueChange={(v) => field.onChange(v === "auto" ? "" : v)}>
                  <SelectTrigger id="item-healthy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Estimate for me</SelectItem>
                    {HEALTHY_SCORES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </Section>

      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t bg-popover px-5 py-4">
        {item ? (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={pending}>
            <Trash2 /> Delete item
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending || uploading}>
          {pending ? <Loader2 className="animate-spin" /> : null} {item ? "Save changes" : "Add item"}
        </Button>
      </div>

      {item ? (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
              <AlertDialogDescription>It disappears from your menu straight away. Past orders keep their details.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void run(() => deleteItem(item.id), "Item deleted", onDone)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </form>
  );
}

function AddonGroupFields({
  index,
  control,
  register,
  errors,
  onRemove,
}: {
  index: number;
  control: Control<Values>;
  register: UseFormRegister<Values>;
  errors: FieldErrors<Values>;
  onRemove: () => void;
}) {
  const addons = useFieldArray({ control, name: `addonGroups.${index}.addons` });
  const e = errors.addonGroups?.[index];
  const n = index + 1;
  return (
    <li className="space-y-3 rounded-2xl border p-3">
      <div className="flex items-center gap-2">
        <Input aria-label={`Add-on group ${n} name`} placeholder="Extra toppings" {...register(`addonGroups.${index}.name`)} />
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove add-on group ${n}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      <FieldError message={e?.name?.message} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`group-${index}-min`}>Min picks</Label>
          <Input id={`group-${index}-min`} inputMode="numeric" aria-label={`Add-on group ${n} minimum`} {...register(`addonGroups.${index}.min`)} />
          <FieldError message={e?.min?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`group-${index}-max`}>Max picks</Label>
          <Input id={`group-${index}-max`} inputMode="numeric" aria-label={`Add-on group ${n} maximum`} {...register(`addonGroups.${index}.max`)} />
          <FieldError message={e?.max?.message} />
        </div>
      </div>
      <ul className="space-y-2">
        {addons.fields.map((f, ai) => (
          <li key={f.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input aria-label={`Group ${n} add-on ${ai + 1} name`} placeholder="Cheese" {...register(`addonGroups.${index}.addons.${ai}.name`)} />
              <Input aria-label={`Group ${n} add-on ${ai + 1} price`} placeholder="₹" inputMode="decimal" className="w-20" {...register(`addonGroups.${index}.addons.${ai}.price`)} />
              <Controller
                control={control}
                name={`addonGroups.${index}.addons.${ai}.veg`}
                render={({ field }) => (
                  <label className="flex shrink-0 items-center gap-1.5 text-xs">
                    <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} aria-label={`Group ${n} add-on ${ai + 1} is veg`} />
                    Veg
                  </label>
                )}
              />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove group ${n} add-on ${ai + 1}`} onClick={() => addons.remove(ai)} disabled={addons.fields.length === 1}>
                <X />
              </Button>
            </div>
            <FieldError message={e?.addons?.[ai]?.name?.message ?? e?.addons?.[ai]?.price?.message} />
          </li>
        ))}
      </ul>
      <FieldError message={e?.addons?.root?.message ?? e?.addons?.message} />
      <Button type="button" variant="ghost" size="sm" onClick={() => addons.append({ name: "", price: "0", veg: true })}>
        <Plus /> Add add-on
      </Button>
    </li>
  );
}
