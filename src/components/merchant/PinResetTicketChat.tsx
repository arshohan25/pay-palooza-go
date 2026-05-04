import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Check, CheckCheck, Loader2, Lock, Send, Shield, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PinResetMessage {
  id: string;
  request_id: string;
  sender_role: "merchant" | "admin" | "system";
  content: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_merchant: boolean;
}

interface PinResetTicketChatProps {
  requestId: string;
  initialTicket: string;
  maskedPhone: string;
  onSessionExpired: () => void;
}

const POLL_FALLBACK_MS = 8000;

export default function PinResetTicketChat({
  requestId,
  initialTicket,
  maskedPhone,
  onSessionExpired,
}: PinResetTicketChatProps) {
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState<PinResetMessage[]>([]);
  const [status, setStatus] = useState<"open" | "resolved" | string>("open");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ticketRef = useRef(initialTicket);
  const expiredHandledRef = useRef(false);

  useEffect(() => { ticketRef.current = ticket; }, [ticket]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  const handleExpiry = useCallback(() => {
    if (expiredHandledRef.current) return;
    expiredHandledRef.current = true;
    onSessionExpired();
  }, [onSessionExpired]);

  const callChat = useCallback(async (action: "fetch" | "send" | "ack", extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("merchant-pin-reset-chat", {
      body: { action, request_id: requestId, otp_ticket: ticketRef.current, ...extra },
    });
    if (error) throw error;
    const payload: any = data;
    if (!payload?.ok) {
      if (typeof payload?.message === "string" && /ticket|verify/i.test(payload.message)) {
        handleExpiry();
      }
      throw new Error(payload?.message || "Request failed");
    }
    if (payload?.otp_ticket) {
      setTicket(payload.otp_ticket);
      ticketRef.current = payload.otp_ticket;
    }
    return payload;
  }, [requestId, handleExpiry]);

  // Initial fetch + polling fallback
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const load = async (initial: boolean) => {
      try {
        const payload = await callChat("fetch");
        if (cancelled) return;
        const next = (payload.messages ?? []) as PinResetMessage[];
        setMessages(next);
        if (payload.status) setStatus(payload.status);
        if (initial) setLoading(false);
        scrollToBottom();
      } catch (err: any) {
        if (cancelled) return;
        if (initial) setLoading(false);
      }
    };

    void load(true);
    intervalId = window.setInterval(() => void load(false), POLL_FALLBACK_MS);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [callChat, scrollToBottom]);

  // Realtime: listen for admin-side inserts (RLS allows public read of payload via realtime broadcast for this request only via filter)
  useEffect(() => {
    const channel = supabase
      .channel(`pin-reset-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "merchant_pin_reset_messages",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const msg = payload.new as PinResetMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          scrollToBottom();
          if (msg.sender_role === "admin") {
            // Best-effort ack so admin sees the read receipt
            void callChat("ack").catch(() => {});
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId, callChat, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || status !== "open") return;
    setSending(true);
    setInput("");
    const optimistic: PinResetMessage = {
      id: `temp-${Date.now()}`,
      request_id: requestId,
      sender_role: "merchant",
      content: text,
      created_at: new Date().toISOString(),
      read_by_admin: false,
      read_by_merchant: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();
    try {
      const payload = await callChat("send", { content: text });
      const real = payload.message as PinResetMessage;
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
      toast.error(err?.message || "Couldn't send message");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isResolved = status !== "open";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Encrypted strip */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-muted/40 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Lock size={10} className="text-muted-foreground" />
          <span className="truncate text-[10px] font-medium text-muted-foreground">
            Verified guest chat · +88 {maskedPhone}
          </span>
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          isResolved
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }`}>
          <ShieldCheck size={10} /> {isResolved ? "Resolved" : "Awaiting support"}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 pt-3 pb-2">
        {/* Welcome */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Shield size={14} className="text-primary" />
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted/60 px-3 py-2">
            <p className="text-xs leading-relaxed text-foreground">
              Your number was verified by OTP. Our support team will reply here to complete your PIN reset. You can describe what happened (e.g. "I changed phones" or "I forgot my PIN after vacation") and they'll guide you next.
            </p>
            <p className="mt-1 text-[9px] text-muted-foreground">EasyPay Support · automated welcome</p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.sender_role === "merchant";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18 }}
                className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isMe ? "bg-primary/15" : "bg-primary/10"}`}>
                  {isMe ? <UserIcon size={12} className="text-primary" /> : <Bot size={12} className="text-primary" />}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  isMe
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted/60 text-foreground"
                }`}>
                  <p className="break-words text-xs leading-relaxed">{msg.content}</p>
                  <div className={`mt-0.5 flex items-center gap-1 ${isMe ? "justify-end" : ""}`}>
                    <span className={`text-[9px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMe && (msg.read_by_admin ? (
                      <CheckCheck size={10} className="text-primary-foreground/80" />
                    ) : (
                      <Check size={10} className="text-primary-foreground/40" />
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/40 bg-background/95 px-3 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        {isResolved ? (
          <p className="py-2 text-center text-[12px] text-muted-foreground">
            This ticket is resolved. Try signing in with your new PIN.
          </p>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
            className="flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Reply to support…"
              maxLength={2000}
              disabled={sending}
              className="h-10 rounded-2xl bg-muted/60 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sending}
              className="h-10 w-10 shrink-0 rounded-2xl"
              aria-label="Send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
