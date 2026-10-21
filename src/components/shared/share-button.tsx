"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Native share sheet on phones; copies the link elsewhere. */
export function ShareButton({ title, path, className, children }: { title: string; path: string; className?: string; children: React.ReactNode }) {
  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Couldn't share. Copy the address bar link instead.");
    }
  }
  return (
    <Button type="button" variant="secondary" size="sm" onClick={share} className={cn(className)}>
      {children}
    </Button>
  );
}
