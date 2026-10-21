import "server-only";

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { brand } from "@/config/brand";

type InvoiceData = {
  orderNumber: number;
  date: string;
  restaurant: { name: string; address: string; fssai: string | null; gstin: string | null };
  customer: { name: string; address: string };
  items: { name: string; detail: string; qty: number; unit: number; total: number }[];
  bill: { label: string; amount: number; negative?: boolean }[];
  total: number;
  paymentLabel: string;
};

const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Standard PDF fonts can't draw ₹ or emoji; keep text to plain characters.
const clean = (s: string) => s.replace(/₹/g, "Rs.").replace(/[^\x20-\x7E]/g, "");

export async function renderInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${brand.name} invoice #${d.orderNumber}`);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const orange = rgb(0.976, 0.451, 0.086);
  const grey = rgb(0.42, 0.45, 0.5);
  let y = 800;
  const text = (s: string, x: number, size = 10, f = font, color = rgb(0.12, 0.16, 0.22)) => page.drawText(clean(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, size = 10, f = font) => {
    const w = f.widthOfTextAtSize(clean(s), size);
    page.drawText(clean(s), { x: xRight - w, y, size, font: f });
  };

  page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: orange });
  y = 822;
  page.drawText(`${brand.name} · Tax invoice`, { x: 40, y, size: 13, font: bold, color: rgb(1, 1, 1) });
  y = 785;
  text(`Order #${d.orderNumber}`, 40, 12, bold);
  right(d.date, 555);
  y -= 26;
  text("Sold by", 40, 9, bold, grey);
  text("Billed to", 320, 9, bold, grey);
  y -= 14;
  text(d.restaurant.name, 40, 11, bold);
  text(d.customer.name, 320, 11, bold);
  y -= 14;
  const wrap = (s: string, n: number) => clean(s).match(new RegExp(`.{1,${n}}(\\s|$)`, "g")) ?? [s];
  const restLines = wrap(d.restaurant.address, 45);
  const custLines = wrap(d.customer.address, 45);
  for (let i = 0; i < Math.max(restLines.length, custLines.length); i++) {
    if (restLines[i]) text(restLines[i]!.trim(), 40, 9);
    if (custLines[i]) text(custLines[i]!.trim(), 320, 9);
    y -= 12;
  }
  if (d.restaurant.gstin) {
    text(`GSTIN: ${d.restaurant.gstin}`, 40, 9);
    y -= 12;
  }
  if (d.restaurant.fssai) {
    text(`FSSAI Lic. No.: ${d.restaurant.fssai}`, 40, 9);
    y -= 12;
  }
  y -= 14;
  page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 0.5, color: grey });
  text("Item", 40, 9, bold, grey);
  right("Qty", 380, 9, bold);
  right("Rate", 460, 9, bold);
  right("Amount", 555, 9, bold);
  y -= 16;
  for (const it of d.items) {
    text(it.name.slice(0, 60), 40, 10);
    right(String(it.qty), 380);
    right(rs(it.unit), 460);
    right(rs(it.total), 555);
    y -= 12;
    if (it.detail) {
      text(it.detail.slice(0, 80), 48, 8, font, grey);
      y -= 12;
    }
    y -= 2;
  }
  y -= 6;
  page.drawLine({ start: { x: 320, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 0.5, color: grey });
  for (const b of d.bill) {
    text(b.label, 320, 10);
    right(`${b.negative ? "- " : ""}${rs(b.amount)}`, 555);
    y -= 14;
  }
  page.drawLine({ start: { x: 320, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 1, color: orange });
  y -= 4;
  text("Grand total", 320, 12, bold);
  right(rs(d.total), 555, 12, bold);
  y -= 20;
  text(d.paymentLabel, 320, 9, font, grey);
  y = 60;
  text("GST on food is collected and paid by the restaurant (Section 9(5) of CGST Act applies to platform-collected GST).", 40, 7, font, grey);
  y -= 10;
  text(`This is a computer-generated invoice from ${brand.name} (demo). No signature required.`, 40, 7, font, grey);
  return pdf.save();
}
