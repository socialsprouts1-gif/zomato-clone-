"use client";

import { Leaf, Salad } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/client";
import { setMode } from "@/lib/preferences-actions";
import { cn } from "@/lib/utils";

export function ModeToggles({ vegMode, healthyMode, className }: { vegMode: boolean; healthyMode: boolean; className?: string }) {
  const router = useRouter();
  const { t } = useT();
  const [, start] = useTransition();
  const [state, setOptimistic] = useOptimistic({ veg: vegMode, healthy: healthyMode });

  function toggle(mode: "veg" | "healthy", on: boolean) {
    start(async () => {
      setOptimistic((s) => ({ ...s, [mode]: on }));
      await setMode(mode, on);
      toast.success(`${mode === "veg" ? t("mode.veg") : t("mode.healthy")} ${on ? "on" : "off"}`, {
        description: mode === "veg" && on ? t("mode.vegOn") : undefined,
      });
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <label className={cn("flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold", state.veg && "border-veg text-veg")}>
        <Leaf className="size-4" aria-hidden /> {t("mode.veg")}
        <Switch checked={state.veg} onCheckedChange={(v) => toggle("veg", v)} aria-label={t("mode.veg")} className="data-[state=checked]:bg-veg" />
      </label>
      <label className={cn("flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold", state.healthy && "border-emerald-600 text-emerald-700 dark:text-emerald-400")}>
        <Salad className="size-4" aria-hidden /> {t("mode.healthy")}
        <Switch checked={state.healthy} onCheckedChange={(v) => toggle("healthy", v)} aria-label={t("mode.healthy")} className="data-[state=checked]:bg-emerald-600" />
      </label>
    </div>
  );
}
