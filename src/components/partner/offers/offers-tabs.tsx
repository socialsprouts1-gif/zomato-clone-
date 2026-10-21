"use client";

import { BadgePercent, Megaphone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Offers / Ads tabs; the active tab is mirrored to ?tab= (without a server round-trip) so refreshes and links land on it. */
export function OffersTabs({ offers, ads }: { offers: React.ReactNode; ads: React.ReactNode }) {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "ads" ? "ads" : "offers");
  function change(v: string) {
    setTab(v);
    const url = new URL(window.location.href);
    if (v === "ads") url.searchParams.set("tab", "ads");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }
  return (
    <Tabs value={tab} onValueChange={change}>
      <TabsList className="mb-4 w-full sm:w-auto">
        <TabsTrigger value="offers">
          <BadgePercent /> Offers
        </TabsTrigger>
        <TabsTrigger value="ads">
          <Megaphone /> Ads
        </TabsTrigger>
      </TabsList>
      <TabsContent value="offers">{offers}</TabsContent>
      <TabsContent value="ads">{ads}</TabsContent>
    </Tabs>
  );
}
