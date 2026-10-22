"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ContentTabs({ tab, banners, collections, counts }: { tab: "banners" | "collections"; banners: React.ReactNode; collections: React.ReactNode; counts: { banners: number; collections: number } }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs value={tab} onValueChange={(v) => router.replace(v === "banners" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}>
      <TabsList className="mb-4">
        <TabsTrigger value="banners">Banners ({counts.banners})</TabsTrigger>
        <TabsTrigger value="collections">Collections ({counts.collections})</TabsTrigger>
      </TabsList>
      <TabsContent value="banners">{banners}</TabsContent>
      <TabsContent value="collections">{collections}</TabsContent>
    </Tabs>
  );
}
