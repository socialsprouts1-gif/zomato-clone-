"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCart, type CartRestaurant } from "@/components/cart/cart-store";
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
import { unitPriceOf, type MenuItem } from "@/lib/catalog/menu-shared";
import { CustomiseSheet, type Customisation } from "./customise-sheet";

/** Add-to-cart flow (customisation sheet + "Replace cart?" dialog) usable outside the restaurant page. */
export function useAddToCart(vegOnly: boolean) {
  const cart = useCart();
  const [customising, setCustomising] = useState<{ item: MenuItem; restaurant: CartRestaurant } | null>(null);
  const [conflict, setConflict] = useState<{ item: MenuItem; restaurant: CartRestaurant; c: Customisation } | null>(null);

  function lineFor(item: MenuItem, c: Customisation) {
    const addons = item.addon_groups.flatMap((g) => g.addons).filter((a) => c.addonIds.includes(a.id));
    const variant = item.item_variants.find((v) => v.id === c.variantId);
    return {
      itemId: item.id, name: item.name, isVeg: item.is_veg, imageUrl: item.image_url, variantId: variant?.id ?? null, variantName: variant?.name ?? null,
      addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price_paise })), unitPrice: unitPriceOf(item, variant?.id ?? null, addons),
    };
  }

  function commit(item: MenuItem, restaurant: CartRestaurant, c: Customisation) {
    if (cart.add(restaurant, lineFor(item, c), c.qty) === "conflict") return setConflict({ item, restaurant, c });
    toast.success(`Added ${item.name}`, { description: `From ${restaurant.name}`, duration: 1500 });
  }

  function add(item: MenuItem, restaurant: CartRestaurant) {
    if (item.item_variants.length || item.addon_groups.length) setCustomising({ item, restaurant });
    else commit(item, restaurant, { variantId: null, addonIds: [], qty: 1 });
  }

  const ui = (
    <>
      <CustomiseSheet
        item={customising?.item ?? null}
        open={Boolean(customising)}
        onOpenChange={(o) => !o && setCustomising(null)}
        vegOnly={vegOnly}
        onSubmit={(c) => {
          if (customising) commit(customising.item, customising.restaurant, c);
          setCustomising(null);
        }}
      />
      <AlertDialog open={Boolean(conflict)} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace cart items?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items from {cart.restaurant?.name}. Discard them and add from {conflict?.restaurant.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!conflict) return;
                cart.replaceWith(conflict.restaurant, lineFor(conflict.item, conflict.c), conflict.c.qty);
                toast.success(`Cart replaced. Added ${conflict.item.name}`);
                setConflict(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
  return { add, ui };
}
