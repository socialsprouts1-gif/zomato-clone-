"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatClock } from "@/lib/catalog/open-state";
import { createCategory, deleteCategory, updateCategory } from "@/lib/partner/menu-actions";
import { DAY_LABELS, type PartnerCategory } from "@/lib/partner/menu-types";
import { cn } from "@/lib/utils";
import { useMenuAction } from "./use-menu-action";

export type CategoryDialogState =
  | { mode: "create"; parent: PartnerCategory | null }
  | { mode: "edit"; category: PartnerCategory; itemCount: number };

export function CategoryDialog({
  restaurantId,
  state,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  state: CategoryDialogState | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        {state?.mode === "create" ? <CreateForm restaurantId={restaurantId} parent={state.parent} onDone={(id) => { onCreated(id); onClose(); }} /> : null}
        {state?.mode === "edit" ? <EditForm key={state.category.id} category={state.category} itemCount={state.itemCount} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({ restaurantId, parent, onDone }: { restaurantId: string; parent: PartnerCategory | null; onDone: (id: string) => void }) {
  const [name, setName] = useState("");
  const { run, pending } = useMenuAction();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => createCategory(restaurantId, name, parent?.id ?? null), parent ? "Subcategory added" : "Category added", (id) => id && onDone(id));
      }}
    >
      <DialogHeader>
        <DialogTitle>{parent ? "New subcategory" : "New category"}</DialogTitle>
        <DialogDescription>{parent ? `Groups items inside ${parent.name}.` : "A section on your menu, like Starters or Biryani."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="new-category-name">{parent ? "Subcategory name" : "Category name"}</Label>
        <Input id="new-category-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus required />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : null} {parent ? "Add subcategory" : "Add category"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Half-hour slots, plus 23:59 so a window can run to the end of the day.
const SLOTS = [...Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`), "23:59"];
const withValue = (v: string) => (v && !SLOTS.includes(v) ? [...SLOTS, v].sort() : SLOTS);

function TimeSelect({ options, className, ...props }: React.ComponentProps<"select"> & { options: string[] }) {
  return (
    <select
      className={cn("h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30", className)}
      {...props}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {formatClock(t)}
        </option>
      ))}
    </select>
  );
}

const editSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(60),
    description: z.string().trim().max(200),
    timed: z.boolean(),
    available_from: z.string(),
    available_to: z.string(),
    available_days: z.array(z.number()).min(1, "Pick at least one day"),
    is_active: z.boolean(),
  })
  .refine((v) => !v.timed || (/^\d\d:\d\d/.test(v.available_from) && /^\d\d:\d\d/.test(v.available_to)), { message: "Set a start and end time", path: ["available_to"] })
  .refine((v) => !v.timed || v.available_from.slice(0, 5) < v.available_to.slice(0, 5), { message: "End time must be after start time", path: ["available_to"] });
type EditValues = z.infer<typeof editSchema>;

function EditForm({ category, itemCount, onDone }: { category: PartnerCategory; itemCount: number; onDone: () => void }) {
  const { run, pending } = useMenuAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: category.name,
      description: category.description ?? "",
      timed: Boolean(category.available_from && category.available_to),
      available_from: category.available_from?.slice(0, 5) ?? "11:00",
      available_to: category.available_to?.slice(0, 5) ?? "16:00",
      available_days: category.available_days,
      is_active: category.is_active,
    },
  });
  const timed = form.watch("timed");
  const errors = form.formState.errors;

  function submit(v: EditValues) {
    void run(
      () =>
        updateCategory(category.id, {
          name: v.name,
          description: v.description || null,
          available_from: v.timed ? v.available_from.slice(0, 5) : null,
          available_to: v.timed ? v.available_to.slice(0, 5) : null,
          available_days: v.available_days,
          is_active: v.is_active,
        }),
      "Category saved",
      onDone,
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
      <DialogHeader>
        <DialogTitle>Edit {category.parent_id ? "subcategory" : "category"}</DialogTitle>
        <DialogDescription>Rename it, set when it&apos;s served, or hide it from the menu.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="category-name">Name</Label>
        <Input id="category-name" {...form.register("name")} aria-invalid={Boolean(errors.name)} />
        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="category-description">Description (optional)</Label>
        <Textarea id="category-description" rows={2} {...form.register("description")} />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
        <div>
          <Label htmlFor="category-active">Show on menu</Label>
          <p className="text-xs text-muted-foreground">Hidden categories and their items aren&apos;t visible to customers.</p>
        </div>
        <Controller control={form.control} name="is_active" render={({ field }) => <Switch id="category-active" checked={field.value} onCheckedChange={field.onChange} />} />
      </div>
      <fieldset className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-3">
          <legend className="text-sm font-semibold">Serving hours</legend>
          <Controller
            control={form.control}
            name="timed"
            render={({ field }) => <Switch aria-label="Only serve at set times" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
        {timed ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="category-from">From</Label>
              <TimeSelect id="category-from" options={withValue(form.getValues("available_from"))} {...form.register("available_from")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category-to">To</Label>
              <TimeSelect id="category-to" options={withValue(form.getValues("available_to"))} {...form.register("available_to")} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Served whenever the outlet is open.</p>
        )}
        {errors.available_to ? <p className="text-xs text-destructive">{errors.available_to.message}</p> : null}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Days</p>
          <Controller
            control={form.control}
            name="available_days"
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days available">
                {DAY_LABELS.map((d, i) => {
                  const on = field.value.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => field.onChange(on ? field.value.filter((x) => x !== i) : [...field.value, i].sort())}
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-2 text-xs font-semibold transition",
                        on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.available_days ? <p className="mt-1 text-xs text-destructive">{errors.available_days.message}</p> : null}
        </div>
      </fieldset>
      <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={pending}>
          <Trash2 /> Delete
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save
        </Button>
      </DialogFooter>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemCount
                ? `It still has ${itemCount} item${itemCount === 1 ? "" : "s"} (including subcategories). Move or delete them first.`
                : category.parent_id
                  ? "This removes the subcategory from your menu."
                  : "This removes the category and its empty subcategories from your menu."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={itemCount > 0} onClick={() => void run(() => deleteCategory(category.id), "Category deleted", onDone)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
