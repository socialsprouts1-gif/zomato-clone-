"use client";

import { Loader2, MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTicket } from "@/lib/support/actions";

type OrderOption = { id: string; label: string };
const TOPICS = [
  ["order", "Missing or wrong items"],
  ["order", "Food quality"],
  ["rider", "Delivery or rider"],
  ["payment", "Payment or refund"],
  ["account", "Account"],
  ["other", "Something else"],
] as const;

export function NewTicketButton({ orders, defaultOrderId, autoOpen }: { orders: OrderOption[]; defaultOrderId?: string; autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [orderId, setOrderId] = useState<string>(defaultOrderId ?? orders[0]?.id ?? "none");
  const [topic, setTopic] = useState(0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MessageSquarePlus /> Chat with support
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How can we help?</DialogTitle>
            <DialogDescription>Our team replies here in the app, usually within a few minutes.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const t = TOPICS[topic]!;
                const res = await createTicket({ orderId: orderId === "none" ? null : orderId, category: t[0], subject: subject || t[1], message });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Ticket created");
                setOpen(false);
                router.push(`/help/tickets/${res.id}`);
              });
            }}
          >
            <div className="space-y-2">
              <Label>Order</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger aria-label="Order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Not about an order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
              {TOPICS.map(([, l], i) => (
                <button key={l} type="button" role="radio" aria-checked={topic === i} onClick={() => setTopic(i)} className={`rounded-full border px-3 py-1.5 text-sm ${topic === i ? "border-primary bg-secondary" : "bg-card"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">What happened?</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={5} maxLength={2000} placeholder="e.g. The raita was missing from my order." />
            </div>
            <Button type="submit" className="w-full" disabled={pending || message.trim().length < 5}>
              {pending ? <Loader2 className="animate-spin" /> : null} Start chat
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
