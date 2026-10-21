"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PayMethod = "upi" | "card" | "netbanking" | "wallet_app" | "cod";

type CheckoutState = {
  addressId: string | null;
  couponCode: string | null;
  tipPaise: number;
  donationPaise: number;
  paymentMethod: PayMethod;
  useWallet: boolean;
  scheduledFor: string | null;
  cookingInstructions: string;
  noCutlery: boolean;
  avoidCalling: boolean;
  leaveAtDoor: boolean;
  directions: string;
  set: (p: Partial<Omit<CheckoutState, "set" | "resetForNewOrder">>) => void;
  resetForNewOrder: () => void;
};

export const useCheckout = create<CheckoutState>()(
  persist(
    (set) => ({
      addressId: null,
      couponCode: null,
      tipPaise: 0,
      donationPaise: 0,
      paymentMethod: "upi",
      useWallet: false,
      scheduledFor: null,
      cookingInstructions: "",
      noCutlery: false,
      avoidCalling: false,
      leaveAtDoor: false,
      directions: "",
      set: (p) => set(p),
      resetForNewOrder: () => set({ couponCode: null, tipPaise: 0, donationPaise: 0, scheduledFor: null, cookingInstructions: "", noCutlery: false, directions: "" }),
    }),
    { name: "thaali.checkout", storage: createJSONStorage(() => localStorage) },
  ),
);
