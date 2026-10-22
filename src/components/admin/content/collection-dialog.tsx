"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCollection } from "@/lib/admin/content-actions";
import { ImageField } from "./image-field";
import { collectionFormSchema, slugify, type Collection, type CollectionFormInput, type CollectionFormValues } from "./schema";

function defaults(c: Collection | null): CollectionFormInput {
  return c
    ? { title: c.title, slug: c.slug ?? "", description: c.description ?? "", image_url: c.image_url ?? "", sort: String(c.sort) }
    : { title: "", slug: "", description: "", image_url: "", sort: "" };
}

function Err({ e }: { e?: FieldError }) {
  return e?.message ? <p className="text-xs font-medium text-destructive">{e.message}</p> : null;
}

export function CollectionDialog({ open, onOpenChange, collection }: { open: boolean; onOpenChange: (v: boolean) => void; collection: Collection | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<CollectionFormInput, unknown, CollectionFormValues>({ resolver: zodResolver(collectionFormSchema), defaultValues: defaults(collection) });
  const { register, formState, watch, reset, setValue, getFieldState } = form;
  const errors = formState.errors;
  const [title, imageUrl] = watch(["title", "image_url"]);

  useEffect(() => {
    if (open) reset(defaults(collection));
  }, [open, collection, reset]);

  function submit(v: CollectionFormValues) {
    start(async () => {
      const res = await saveCollection(collection?.id ?? null, form.getValues());
      if (!res.ok) return void toast.error(res.error);
      onOpenChange(false);
      if (collection) {
        toast.success("Collection updated");
        router.refresh();
      } else {
        toast.success(`“${v.title}” created. Now add restaurants.`);
        router.push(`/admin/content/collections/${res.data!.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col">
        <DialogHeader>
          <DialogTitle>{collection ? "Edit collection" : "New collection"}</DialogTitle>
          <DialogDescription>Curated collections show on the home page and at /collections/&lt;slug&gt;.</DialogDescription>
        </DialogHeader>
        <form id="collection-form" onSubmit={form.handleSubmit(submit)} className="-mx-6 grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-1" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="collection-title">Title</Label>
            <Input
              id="collection-title"
              placeholder="Best biryani in Pune"
              aria-invalid={Boolean(errors.title)}
              {...register("title", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!collection && !getFieldState("slug").isDirty) setValue("slug", slugify(e.target.value));
                },
              })}
            />
            <Err e={errors.title} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="collection-slug">Slug</Label>
              <div className="flex items-center rounded-xl border border-input bg-card pl-3 text-sm text-muted-foreground focus-within:ring-[3px] focus-within:ring-ring/30">
                /collections/
                <Input id="collection-slug" className="border-0 pl-0.5 shadow-none focus-visible:ring-0" aria-invalid={Boolean(errors.slug)} {...register("slug")} />
              </div>
              <Err e={errors.slug} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="collection-sort">Position (optional)</Label>
              <Input id="collection-sort" inputMode="numeric" placeholder="Last" aria-invalid={Boolean(errors.sort)} {...register("sort")} />
              <Err e={errors.sort} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="collection-desc">Description (optional)</Label>
            <Textarea id="collection-desc" rows={2} placeholder="Slow-cooked dum biryanis worth the wait" aria-invalid={Boolean(errors.description)} {...register("description")} />
            <Err e={errors.description} />
          </div>
          <ImageField
            id="collection-image"
            label="Cover image"
            folder="collections"
            value={imageUrl}
            onChange={(url) => setValue("image_url", url, { shouldDirty: true, shouldValidate: true })}
            error={errors.image_url?.message}
            previewName={title}
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="collection-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {collection ? "Save changes" : "Create collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
