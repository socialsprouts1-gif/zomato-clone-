"use client";

import { Bell, Languages, Leaf, Moon, Salad, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deleteAccount, updateNotificationPrefs } from "@/lib/account/actions";
import { useT } from "@/lib/i18n/client";
import { setLanguage, setMode } from "@/lib/preferences-actions";

type Prefs = { order_updates: boolean; offers: boolean; push: boolean };

function Row({ icon: Icon, title, description, children }: { icon: typeof Bell; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsForm({ vegMode, healthyMode, locale, prefs }: { vegMode: boolean; healthyMode: boolean; locale: "en" | "hi"; prefs: Prefs }) {
  const router = useRouter();
  const { t } = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [veg, setVeg] = useState(vegMode);
  const [healthy, setHealthy] = useState(healthyMode);
  const [notif, setNotif] = useState(prefs);
  const [, start] = useTransition();
  useEffect(() => setMounted(true), []);

  function toggleMode(mode: "veg" | "healthy", on: boolean) {
    (mode === "veg" ? setVeg : setHealthy)(on); // optimistic
    start(async () => {
      await setMode(mode, on);
      toast.success(`${mode === "veg" ? "Veg" : "Healthy"} Mode ${on ? "on" : "off"}`);
      router.refresh();
    });
  }

  async function togglePref(key: keyof Prefs, on: boolean) {
    if (key === "push" && on) {
      if (!("Notification" in window)) return void toast.error("This browser doesn't support notifications");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return void toast.error("Notifications are blocked in your browser settings");
    }
    const next = { ...notif, [key]: on };
    setNotif(next);
    start(async () => {
      const r = await updateNotificationPrefs(next);
      if (!r.ok) {
        toast.error(r.error);
        setNotif(notif);
      } else toast.success("Notification settings saved");
    });
  }

  return (
    <div className="space-y-6">
      <Card className="divide-y">
        <Row icon={Leaf} title={t("mode.veg")} description="Hide non-veg restaurants and dishes everywhere.">
          <Switch checked={veg} onCheckedChange={(v) => toggleMode("veg", v)} aria-label="Veg Mode" />
        </Row>
        <Row icon={Salad} title={t("mode.healthy")} description="Show Healthy Scores, calories and macros on dishes.">
          <Switch checked={healthy} onCheckedChange={(v) => toggleMode("healthy", v)} aria-label="Healthy Mode" />
        </Row>
        <Row icon={Moon} title={t("settings.darkMode")}>
          <Switch
            checked={mounted && resolvedTheme === "dark"}
            onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
            aria-label="Dark mode"
          />
        </Row>
        <Row icon={Languages} title={t("settings.language")}>
          <Select
            defaultValue={locale}
            onValueChange={(v) =>
              start(async () => {
                await setLanguage(v === "hi" ? "hi" : "en");
                router.refresh();
              })
            }
          >
            <SelectTrigger className="w-36" aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिन्दी</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Card>

      <div>
        <h2 className="mb-2 px-1 text-sm font-bold tracking-wide text-muted-foreground uppercase">{t("settings.notifications")}</h2>
        <Card className="divide-y">
          <Row icon={Bell} title="Order updates" description="Status changes for your orders.">
            <Switch checked={notif.order_updates} onCheckedChange={(v) => togglePref("order_updates", v)} aria-label="Order updates" />
          </Row>
          <Row icon={Bell} title="Offers and recommendations">
            <Switch checked={notif.offers} onCheckedChange={(v) => togglePref("offers", v)} aria-label="Offers" />
          </Row>
          <Row icon={Bell} title="Browser push notifications" description="Get alerts even when this tab is in the background.">
            <Switch checked={notif.push} onCheckedChange={(v) => togglePref("push", v)} aria-label="Push notifications" />
          </Row>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">{t("settings.deleteAccount")}</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Your profile, addresses and saved data are removed and you&apos;re signed out. Past orders stay anonymised for restaurant records.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive">
              <Trash2 /> Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>This can&apos;t be undone. Your wallet balance will be lost.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => start(() => deleteAccount().then(() => undefined))}>
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}
