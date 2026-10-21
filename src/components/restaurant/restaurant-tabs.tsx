"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function RestaurantTabs({ order, reviews, photos, info, reviewCount }: { order: React.ReactNode; reviews: React.ReactNode; photos: React.ReactNode; info: React.ReactNode; reviewCount: number }) {
  return (
    <Tabs defaultValue="order">
      <TabsList className="w-full md:w-auto">
        <TabsTrigger value="order">Order online</TabsTrigger>
        <TabsTrigger value="reviews">Reviews ({reviewCount})</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
        <TabsTrigger value="info">Info</TabsTrigger>
      </TabsList>
      <TabsContent value="order" forceMount className="data-[state=inactive]:hidden">
        {order}
      </TabsContent>
      <TabsContent value="reviews">{reviews}</TabsContent>
      <TabsContent value="photos">{photos}</TabsContent>
      <TabsContent value="info">{info}</TabsContent>
    </Tabs>
  );
}
