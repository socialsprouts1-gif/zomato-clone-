"use client";

import { Loader2, MessageCircle, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRealtime } from "@/hooks/use-realtime";
import { loadChat, sendChatMessage, type Thread } from "@/lib/chat/actions";
import { cn } from "@/lib/utils";

type Msg = Awaited<ReturnType<typeof loadChat>>[number];

const QUICK: Record<"customer" | "rider" | "restaurant", string[]> = {
  customer: ["Please ring the bell", "Leave it with the guard", "Where are you?", "Less spicy please"],
  rider: ["On my way!", "I'm at the gate", "Please come down", "Reached the restaurant"],
  restaurant: ["Your order is being prepared", "Packed and ready", "Sorry for the delay"],
};

/** Order-scoped chat between two parties (realtime). */
export function ChatButton({
  orderId,
  thread,
  as,
  myId,
  title,
  label = "Chat",
  variant = "outline",
}: {
  orderId: string;
  thread: Thread;
  as: "customer" | "rider" | "restaurant";
  myId: string;
  title: string;
  label?: string;
  variant?: "outline" | "secondary" | "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const list = await loadChat(orderId, thread);
    setMsgs((prev) => {
      if (!open && list.length > prev.length && prev.length) setUnread((u) => u + list.length - prev.length);
      return list;
    });
  }, [orderId, thread, open]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useRealtime(`chat:${orderId}:${thread}`, [{ table: "chat_messages", filter: `order_id=eq.${orderId}`, event: "INSERT" }], (p) => {
    const row = p?.new as { thread?: string } | undefined;
    if (!p || row?.thread === thread) void reload();
  }, 6000);
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [open, msgs.length]);

  async function send(body: string) {
    if (!body.trim()) return;
    setSending(true);
    const res = await sendChatMessage(orderId, thread, body, as);
    setSending(false);
    if (!res.ok) return void toast.error(res.error);
    setText("");
    void reload();
  }

  return (
    <>
      <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)} className="relative" aria-label={`${label}: ${title}`}>
        <MessageCircle /> {label}
        {unread ? <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unread}</span> : null}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto flex h-[80dvh] max-w-lg flex-col gap-0 p-0">
          <SheetHeader className="border-b px-5 pt-2 pb-3">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>Messages stay on this order. Phone numbers are never shared.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite" data-testid="chat-messages">
            {msgs.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello 👋</p> : null}
            {msgs.map((m) => {
              const mine = m.sender_id === myId && m.sender_role === as;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
                    {!mine ? <p className="text-[10px] font-semibold opacity-70">{m.sender_name ?? m.sender_role}</p> : null}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-0.5 text-right text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <div className="space-y-2 border-t p-3">
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {QUICK[as].map((q) => (
                <button key={q} type="button" onClick={() => void send(q)} className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs">
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" aria-label="Message" maxLength={1000} />
              <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Send message">
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
