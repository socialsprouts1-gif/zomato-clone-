"use client";

import { CheckCircle2, Headset, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/hooks/use-realtime";
import { resolveTicket, sendSupportMessage } from "@/lib/support/actions";
import { cn } from "@/lib/utils";

type Msg = { id: string; sender_role: string; body: string; created_at: string };
type ChatResult = { ok: true } | { ok: false; error: string };

/**
 * Support conversation, used by both the customer and the admin agent. The admin console passes its
 * own audited server actions as `sendAction` / `resolveAction`; the defaults are the customer actions.
 */
export function TicketChat({
  ticketId,
  messages,
  as,
  status,
  sendAction = sendSupportMessage,
  resolveAction = resolveTicket,
}: {
  ticketId: string;
  messages: Msg[];
  as: "customer" | "agent";
  status: string;
  sendAction?: (ticketId: string, body: string) => Promise<ChatResult>;
  resolveAction?: (ticketId: string) => Promise<ChatResult>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(() => router.refresh(), [router]);
  useRealtime(`ticket:${ticketId}`, [{ table: "support_messages", filter: `ticket_id=eq.${ticketId}`, event: "INSERT" }], refresh, 6000);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  return (
    <Card className="flex h-[70dvh] flex-col overflow-hidden">
      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite" data-testid="ticket-messages">
        {messages.map((m) => {
          const mine = m.sender_role === as;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-sm bg-primary text-primary-foreground" : m.sender_role === "bot" ? "rounded-bl-sm bg-muted italic" : "rounded-bl-sm bg-secondary")}>
                {!mine ? (
                  <p className="flex items-center gap-1 text-[10px] font-semibold opacity-70">
                    {m.sender_role === "agent" ? <Headset className="size-3" /> : null}
                    {m.sender_role === "agent" ? "Thaali support" : m.sender_role === "bot" ? "Thaali assistant" : "Customer"}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="space-y-2 border-t p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            start(async () => {
              const r = await sendAction(ticketId, text);
              if (!r.ok) return void toast.error(r.error);
              setText("");
              router.refresh();
            });
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={as === "agent" ? "Reply to the customer" : "Type your message"} aria-label="Message" maxLength={2000} />
          <Button type="submit" size="icon" disabled={pending || !text.trim()} aria-label="Send">
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
        {status !== "resolved" ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() =>
              start(async () => {
                const r = await resolveAction(ticketId);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Marked as resolved");
                router.refresh();
              })
            }
          >
            <CheckCircle2 /> {as === "agent" ? "Resolve ticket" : "My issue is resolved"}
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Resolved. Send a message to reopen.</p>
        )}
      </div>
    </Card>
  );
}
