"use client";

import { Download, Loader2, Pencil, Plus, Printer, QrCode, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { deleteTable, saveTable } from "@/lib/partner/ops-actions";
import { cn } from "@/lib/utils";

export type TableView = { id: string; label: string; section: string; seats: number; qr_token: string; is_active: boolean };
type Draft = { id?: string; label: string; section: string; seats: string; is_active: boolean };

function useOrigin() {
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function TableQr({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then((d) => live && setSrc(d));
    return () => {
      live = false;
    };
  }, [url]);
  if (!src) return <Skeleton className="size-32 rounded-xl" />;
  // eslint-disable-next-line @next/next/no-img-element -- generated data URL
  return <img src={src} alt={`QR code for table ${label}`} data-qr-url={url} className="size-32 rounded-xl border bg-white p-1" />;
}

async function downloadQr(url: string, file: string) {
  const data = await QRCode.toDataURL(url, { margin: 2, width: 1024 });
  const a = document.createElement("a");
  a.href = data;
  a.download = file;
  a.click();
}

async function printQr(url: string, table: TableView, restaurantName: string) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 1 });
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return void toast.error("Allow pop-ups to print the QR code");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  w.document.write(
    `<!doctype html><title>Table ${esc(table.label)}</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:32px}svg{width:320px;height:320px}h1{margin:16px 0 4px}p{margin:0;color:#555}</style>` +
      `${svg}<h1>Table ${esc(table.label)}</h1><p>${esc(restaurantName)} · ${esc(table.section)}</p><p style="margin-top:8px">Scan to see the menu</p><script>window.onload=()=>{window.print()}</script>`,
  );
  w.document.close();
}

export function TablesManager({ restaurantId, slug, restaurantName, tables, canEdit }: { restaurantId: string; slug: string; restaurantName: string; tables: TableView[]; canEdit: boolean }) {
  const router = useRouter();
  const origin = useOrigin();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<TableView | null>(null);
  const [pending, start] = useTransition();
  const urlFor = (t: TableView) => `${origin ?? ""}/restaurant/${slug}?table=${encodeURIComponent(t.qr_token)}`;

  function submit() {
    if (!draft) return;
    start(async () => {
      const r = await saveTable(restaurantId, { id: draft.id, label: draft.label, section: draft.section, seats: draft.seats, is_active: draft.is_active });
      if (!r.ok) return void toast.error(r.error);
      toast.success(draft.id ? "Table updated" : `Table ${draft.label.toUpperCase()} added`);
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="tables-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="tables-heading" className="font-display text-lg font-bold">
            Tables &amp; QR codes
          </h2>
          <p className="text-sm text-muted-foreground">Print a QR for each table. Guests scan it to open your menu at that table.</p>
        </div>
        {canEdit ? (
          <Button onClick={() => setDraft({ label: "", section: tables[0]?.section ?? "Main", seats: "4", is_active: true })}>
            <Plus /> Add table
          </Button>
        ) : null}
      </div>

      {tables.length === 0 ? (
        <EmptyState icon={QrCode} title="No tables yet" description={canEdit ? "Add your tables to assign them to bookings and print QR codes." : "The owner or a manager can add tables."} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((t) => (
            <li key={t.id}>
              <Card className={cn("flex gap-4 p-4", !t.is_active && "opacity-70")} data-testid="table-card" data-label={t.label}>
                {origin ? <TableQr url={urlFor(t)} label={t.label} /> : <Skeleton className="size-32 rounded-xl" />}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <p className="font-display text-xl font-bold">Table {t.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.section} · {t.seats} seats
                    </p>
                  </div>
                  {!t.is_active ? <Badge variant="outline" className="w-fit">Inactive</Badge> : null}
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" disabled={!origin} onClick={() => void downloadQr(urlFor(t), `${slug}-table-${t.label}.png`)} aria-label={`Download QR for table ${t.label}`}>
                      <Download /> QR
                    </Button>
                    <Button size="sm" variant="outline" disabled={!origin} onClick={() => void printQr(urlFor(t), t, restaurantName)} aria-label={`Print QR for table ${t.label}`}>
                      <Printer />
                    </Button>
                    {canEdit ? (
                      <>
                        <Button size="sm" variant="ghost" aria-label={`Edit table ${t.label}`} onClick={() => setDraft({ id: t.id, label: t.label, section: t.section, seats: String(t.seats), is_active: t.is_active })}>
                          <Pencil />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={`Delete table ${t.label}`} onClick={() => setDeleting(t)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? `Edit table ${draft.label}` : "Add a table"}</DialogTitle>
            <DialogDescription>Each table gets its own QR code.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <form
              id="table-form"
              className="grid gap-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="table-label">Table name</Label>
                <Input id="table-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="T5" maxLength={12} required className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-section">Section</Label>
                <Input id="table-section" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} placeholder="Main" maxLength={30} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-seats">Seats</Label>
                <Input id="table-seats" type="number" inputMode="numeric" min={1} max={20} value={draft.seats} onChange={(e) => setDraft({ ...draft, seats: e.target.value })} required />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-medium sm:col-span-3">
                Available for bookings
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} aria-label="Table active" />
              </label>
            </form>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="submit" form="table-form" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Save table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete table {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>Its printed QR code stops pointing to a table. Bookings assigned to it keep their date and time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleting &&
                start(async () => {
                  const r = await deleteTable(restaurantId, deleting.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`Table ${deleting.label} deleted`);
                  setDeleting(null);
                  router.refresh();
                })
              }
            >
              Delete table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
