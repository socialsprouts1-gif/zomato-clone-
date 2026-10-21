import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/partner/print-button";
import { getPartnerContext } from "@/lib/partner/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kitchen order ticket" };

/** Printable kitchen order ticket (80 mm thermal printer friendly). */
export default async function KotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getPartnerContext(`/partner/orders/${id}/kot`);
  const supabase = await getSupabaseServerClient();
  const { data: o } = await supabase.from("orders").select("*, restaurants(name), order_items(*)").eq("id", id).maybeSingle();
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-[80mm] bg-white p-4 font-mono text-sm text-black print:p-0" data-testid="kot">
      <div className="mb-3 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <p className="text-center text-base font-bold">{o.restaurants?.name}</p>
      <p className="text-center">KITCHEN ORDER TICKET</p>
      <hr className="my-2 border-dashed border-black" />
      <p>Order: #{o.order_number}</p>
      <p>Time: {new Date(o.placed_at ?? o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}</p>
      {o.scheduled_for ? <p>Scheduled: {new Date(o.scheduled_for).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}</p> : null}
      <p>Customer: {o.customer_name ?? "-"}</p>
      <hr className="my-2 border-dashed border-black" />
      <table className="w-full">
        <tbody>
          {o.order_items.map((i) => {
            const addons = (i.addons as { name: string }[] | null) ?? [];
            return (
              <tr key={i.id} className="align-top">
                <td className="w-8 font-bold">{i.quantity}x</td>
                <td>
                  {i.name} {i.is_veg ? "(V)" : "(NV)"}
                  {i.variant_name ? <div>- {i.variant_name}</div> : null}
                  {addons.map((a) => (
                    <div key={a.name}>+ {a.name}</div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <hr className="my-2 border-dashed border-black" />
      {o.cooking_instructions ? <p>NOTE: {o.cooking_instructions}</p> : null}
      {o.no_cutlery ? <p>** NO CUTLERY **</p> : null}
      <p>Payment: {o.payment_method === "cod" ? "CASH ON DELIVERY" : "PAID ONLINE"}</p>
    </div>
  );
}
