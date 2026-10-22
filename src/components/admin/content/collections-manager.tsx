"use client";

import { ExternalLink, Library, ListOrdered, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
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
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteCollection } from "@/lib/admin/content-actions";
import { CollectionDialog } from "./collection-dialog";
import type { Collection } from "./schema";

export function CollectionsManager({ collections }: { collections: (Collection & { count: number })[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Collection | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Collection | null>(null);
  const [pending, start] = useTransition();

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function remove(c: Collection) {
    start(async () => {
      const res = await deleteCollection(c.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`“${c.title}” deleted`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Collections with at least one restaurant near the customer show on the home page.</p>
        <Button onClick={openNew}>
          <Plus /> New collection
        </Button>
      </div>
      {collections.length === 0 ? (
        <EmptyState icon={Library} title="No curated collections" description="Group restaurants into themes like “Late night cravings”." action={<Button onClick={openNew}>Create a collection</Button>} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((c) => (
            <li key={c.id} className="min-w-0">
              <Card className="flex gap-3 p-3" data-testid="admin-collection" data-slug={c.slug ?? ""}>
                <FoodImage src={c.image_url} alt="" name={c.title} sizes="96px" className="h-20 w-20 shrink-0 rounded-xl" emojiClassName="text-3xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.title}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">/collections/{c.slug}</p>
                    </div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for collection ${c.title}`} disabled={pending}>
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          <Pencil /> Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/content/collections/${c.id}`}>
                            <ListOrdered /> Manage restaurants
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/collections/${c.slug}`} target="_blank">
                            <ExternalLink /> View as customer
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm(c)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="mt-1 text-sm">
                    <Link href={`/admin/content/collections/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.count} {c.count === 1 ? "restaurant" : "restaurants"}
                    </Link>
                    <span className="text-muted-foreground"> · position {c.sort + 1}</span>
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CollectionDialog open={open} onOpenChange={setOpen} collection={editing} />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirm?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>The collection and its restaurant list are removed, and /collections/{confirm?.slug} stops working. Restaurants themselves aren&apos;t affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c) remove(c);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
