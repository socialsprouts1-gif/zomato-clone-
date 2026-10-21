import { z } from "zod";

export const cartLineSchema = z.object({
  itemId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  addonIds: z.array(z.string().uuid()).max(20),
  qty: z.number().int().min(1).max(50),
  addedByName: z.string().max(40).optional(),
});

export const quoteInputSchema = z.object({
  restaurantId: z.string().uuid(),
  lines: z.array(cartLineSchema).min(1).max(60),
  addressId: z.string().uuid().nullable().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  couponCode: z.string().trim().toUpperCase().max(30).nullable().optional(),
  tipPaise: z.number().int().min(0).max(50000).default(0),
  donationPaise: z.number().int().min(0).max(500).default(0),
  paymentMethod: z.enum(["upi", "card", "netbanking", "wallet_app", "cod"]).default("upi"),
  useWallet: z.boolean().default(false),
  scheduledFor: z.string().datetime().nullable().optional(),
});
export type QuoteInput = z.input<typeof quoteInputSchema>;
export type CartLineInput = z.infer<typeof cartLineSchema>;

export type PricedLine = {
  itemId: string;
  name: string;
  isVeg: boolean;
  variantId: string | null;
  variantName: string | null;
  addons: { id: string; name: string; price_paise: number }[];
  qty: number;
  unitPaise: number;
  totalPaise: number;
  addedByName?: string;
  free?: boolean;
};

export type Bill = {
  item_total_paise: number;
  delivery_fee_paise: number;
  platform_fee_paise: number;
  packaging_fee_paise: number;
  gst_paise: number;
  tip_paise: number;
  discount_paise: number;
  donation_paise: number;
  total_paise: number;
  wallet_used_paise: number;
  payable_paise: number;
  gold_savings_paise: number;
  coupon_code: string | null;
  surge_fee_paise: number;
};

export type CouponView = {
  code: string;
  title: string;
  description: string | null;
  source: "platform" | "restaurant";
  eligible: boolean;
  reason?: string;
  savingsPaise: number;
};

export type Quote = {
  ok: boolean;
  errors: string[];
  lines: PricedLine[];
  bill: Bill;
  distanceKm: number;
  etaMinutes: number;
  isGold: boolean;
  goldPartner: boolean;
  restaurantOpen: boolean;
  walletBalancePaise: number;
  coupon: { applied: boolean; code: string | null; message: string | null; couponId: string | null; offerId: string | null };
};
