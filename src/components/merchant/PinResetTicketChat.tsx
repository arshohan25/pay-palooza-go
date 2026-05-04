import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  CheckCheck,
  Check,
  Loader2,
  Lock,
  Send,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Sparkles,
} from "lucide-react";

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
  /** Pass "pending" while the parent is still resolving the request id from `merchant-forgot-pin`. */
  requestId: string;
  initialTicket: string;
  maskedPhone: string;
  onSessionExpired: () => void;
}

const POLL_FALLBACK_MS = 8000;

/* ────────────────────────────────────────────────────────────── helpers ── */

const formatDayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-BD", { month: "short", day: "numeric" });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" });

/* ────────────────────────────────────────────────────────────── component */

export default function PinResetTicketChat({
  requestId: initialRequestId,
  initialTicket,
  maskedPhone,
  onSessionExpired,
}: PinResetTicketChatProps) {
  const [requestId, setRequestId] = useState(initialRequestId);
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState<PinResetMessage[]>([]);
  const [status, setStatus] = useState<"open" | "resolved" | string>("open");
  const [input, setInput] = useState("");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ticketRef = useRef(initialTicket);
  const requestIdRef = useRef(initialRequestId);
  const expiredHandledRef = useRef(false);

  useEffect(() => {
    ticketRef.current = ticket;
  }, [ticket]);
  useEffect(() => {
    requestIdRef.current = requestId;
  }, [requestId]);

  /* Listen for parent's background-resolved request id */
  useEffect(() => {
    if (requestId !== "pending") return;
    // Pick up id resolved BEFORE we mounted (race fallback).
    try {
      const stashed = (window as any).__pinResetResolvedId;
      if (typeof stashed === "string" && stashed && stashed !== "pending") {
        setRequestId(stashed);
        return;
      }
    } catch { /* noop */ }
    const onResolved = (e: Event) => {
      const id = (e as CustomEvent).detail?.requestId;
      if (id) setRequestId(id);
    };
    window.addEventListener("pin-reset-request-resolved", onResolved);
    return () => window.removeEventListener("pin-reset-request-resolved", onResolved);
  }, [requestId]);

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

  const callChat = useCallback(
    async (action: "fetch" | "send" | "ack", extra: Record<string, unknown> = {}) => {
      const id = requestIdRef.current;
      if (!id || id === "pending") throw new Error("__pending__");
      const { data, error } = await supabase.functions.invoke("merchant-pin-reset-chat", {
        body: { action, request_id: id, otp_ticket: ticketRef.current, ...extra },
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
    },
    [handleExpiry],
  );

  /* Fetch + polling — only once a real requestId is known */
  useEffect(() => {
    if (requestId === "pending") return;
    let cancelled = false;
    let intervalId: number | null = null;

    const load = async (initial: boolean) => {
      try {
        const payload = await callChat("fetch");
        if (cancelled) return;
        const next = (payload.messages ?? []) as PinResetMessage[];
        setMessages(next);
        if (payload.status) setStatus(payload.status);
        if (initial) setBootstrapping(false);
        scrollToBottom();
      } catch (err: any) {
        if (cancelled) return;
        if (err?.message === "__pending__") return;
        if (initial) setBootstrapping(false);
      }
    };

    void load(true);
    intervalId = window.setInterval(() => void load(false), POLL_FALLBACK_MS);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [requestId, callChat, scrollToBottom]);

  /* Realtime — only once requestId is real */
  useEffect(() => {
    if (requestId === "pending") return;
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
            void callChat("ack").catch(() => {});
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, callChat, scrollToBottom]);

  /* Composer */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || status !== "open") return;
    if (requestId === "pending") {
      toast.info("Connecting you to support… try again in a second.");
      return;
    }
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

  const isResolved = status !== "open";
  const stillConnecting = requestId === "pending" || bootstrapping;

  /* Group consecutive messages by sender for cleaner avatar stack */
  const decorated = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const isFirstOfRun = !prev || prev.sender_role !== m.sender_role;
      const showDayDivider =
        !prev || formatDayLabel(prev.created_at) !== formatDayLabel(m.created_at);
      return { msg: m, isFirstOfRun, showDayDivider };
    });
  }, [messages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-background via-background to-primary/[0.04]"
    >
      {/* Premium header */}
      <div className="relative shrink-0 border-b border-border/50 bg-gradient-to-r from-primary/[0.07] via-background to-primary/[0.04] px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-[0_6px_18px_-6px_hsl(var(--primary)/0.55)] ring-1 ring-primary/30">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[13px] font-semibold leading-tight text-foreground">
                EasyPay Support
              </h2>
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <p className="flex items-center gap-1 truncate text-[10px] leading-tight text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              Encrypted · +88 {maskedPhone}
            </p>
          </div>
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-semibold tracking-wide ${
              isResolved
                ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300"
                : "bg-gradient-to-r from-primary/15 to-primary/5 text-primary ring-1 ring-primary/30"
            }`}
          >
            <ShieldCheck className="h-3 w-3" />
            {isResolved ? "RESOLVED" : "VERIFIED"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-5 pb-3 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Welcome bubble — always shown instantly, no network needed */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex items-end gap-2"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
            <Bot size={13} className="text-primary" />
          </div>
          <div className="max-w-[80%] rounded-[20px] rounded-bl-[6px] border border-border/40 bg-card/80 px-3.5 py-2.5 shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.08)] backdrop-blur-sm">
            <p className="text-[12.5px] leading-relaxed text-foreground">
              Hi there 👋 Your number is verified. Tell us briefly what happened (e.g. "I changed
              phones" or "I forgot my PIN") and our team will guide you through resetting it.
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              EasyPay · automated
            </p>
          </div>
        </motion.div>

        {/* Skeletons while bootstrapping */}
        {stillConnecting && messages.length === 0 && (
          <div className="space-y-2 pt-1">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`flex items-end gap-2 ${i % 2 ? "flex-row-reverse" : ""}`}
              >
                <div className="h-6 w-6 shrink-0 rounded-full bg-muted/60" />
                <div
                  className={`h-9 ${i % 2 ? "w-[55%]" : "w-[65%]"} animate-pulse rounded-[20px] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70`}
                />
              </div>
            ))}
            <p className="pt-1 text-center text-[10px] text-muted-foreground/70">
              {requestId === "pending" ? "Connecting you to support…" : "Loading conversation…"}
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {decorated.map(({ msg, isFirstOfRun, showDayDivider }) => {
            const isMe = msg.sender_role === "merchant";
            return (
              <div key={msg.id}>
                {showDayDivider && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
                      {formatDayLabel(msg.created_at)}
                    </span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.16 }}
                  className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""} ${isFirstOfRun ? "mt-1.5" : "mt-0.5"}`}
                >
                  {/* Avatar — only on first of run */}
                  <div className="w-7 shrink-0">
                    {isFirstOfRun && (
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 ${
                          isMe
                            ? "bg-gradient-to-br from-primary to-primary/70 ring-primary/30"
                            : "bg-gradient-to-br from-primary/20 to-primary/5 ring-primary/20"
                        }`}
                      >
                        {isMe ? (
                          <UserIcon size={12} className="text-primary-foreground" />
                        ) : (
                          <Bot size={12} className="text-primary" />
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className={`max-w-[76%] px-3.5 py-2 ${
                      isMe
                        ? "rounded-[20px] rounded-br-[6px] bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.45)]"
                        : "rounded-[20px] rounded-bl-[6px] border border-border/40 bg-card/80 text-foreground shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.08)] backdrop-blur-sm"
                    }`}
                  >
                    <p className="break-words text-[12.5px] leading-relaxed">{msg.content}</p>
                    <div
                      className={`mt-0.5 flex items-center gap-1 ${isMe ? "justify-end" : ""}`}
                    >
                      <span
                        className={`text-[9px] ${isMe ? "text-primary-foreground/65" : "text-muted-foreground"}`}
                      >
                        {formatTime(msg.created_at)}
                      </span>
                      {isMe &&
                        (msg.read_by_admin ? (
                          <CheckCheck size={11} className="text-cyan-200" />
                        ) : (
                          <Check size={11} className="text-primary-foreground/50" />
                        ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Composer — premium glassmorphism */}
      <div className="relative shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),10px)] pt-3">
        {/* Frosted top fade so messages dissolve into the composer */}
        <div className="pointer-events-none absolute inset-x-0 -top-5 h-5 bg-gradient-to-t from-background/85 to-transparent" />
        {/* Glass surface */}
        <div className="absolute inset-0 -z-0 border-t border-white/10 bg-gradient-to-b from-background/65 via-background/85 to-background/95 backdrop-blur-2xl" />

        <div className="relative z-10">
          {isResolved ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] p-3 text-center backdrop-blur-xl">
              <p className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                ✓ Ticket resolved
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Try signing in with your new PIN.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              className="flex items-end gap-2"
            >
              {/* Glass pill input with gradient ring */}
              <motion.div
                initial={false}
                animate={{
                  boxShadow: input
                    ? "0 10px 30px -12px hsl(var(--primary) / 0.4), inset 0 1px 0 hsl(var(--background) / 0.45)"
                    : "0 4px 18px -10px hsl(var(--foreground) / 0.18), inset 0 1px 0 hsl(var(--background) / 0.4)",
                }}
                transition={{ duration: 0.18 }}
                className="relative flex-1 overflow-hidden rounded-[24px]"
              >
                {/* gradient border layer */}
                <div
                  className={`absolute inset-0 rounded-[24px] bg-gradient-to-br transition-opacity duration-300 ${
                    input
                      ? "from-primary/55 via-primary/25 to-primary/45"
                      : "from-border/70 via-border/40 to-border/70"
                  }`}
                />
                {/* glass body */}
                <div className="relative m-[1px] rounded-[23px] bg-gradient-to-br from-background/60 via-card/55 to-background/75 backdrop-blur-xl">
                  {/* highlight sheen */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder={stillConnecting ? "Connecting…" : "Reply to support…"}
                    rows={1}
                    disabled={sending || stillConnecting}
                    className="block w-full resize-none rounded-[23px] border-0 bg-transparent px-4 py-3 pr-14 text-[13px] leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 disabled:opacity-60"
                    style={{ maxHeight: 120 }}
                  />

                  {/* Character counter */}
                  <AnimatePresence>
                    {input.length > 0 && (
                      <motion.div
                        key="counter"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ type: "spring", stiffness: 400, damping: 24 }}
                        className="pointer-events-none absolute bottom-2 right-2.5 flex items-center"
                      >
                        {input.length > 1500 ? (
                          <CounterRing value={input.length} max={2000} />
                        ) : (
                          <span className="text-[9.5px] font-medium tabular-nums text-muted-foreground/55">
                            {input.length}/2000
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Gradient send button */}
              <motion.button
                type="submit"
                disabled={!input.trim() || sending || stillConnecting}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.04 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-primary to-primary/65" />
                <div className="absolute inset-0 rounded-full shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.65),inset_0_1px_0_hsl(var(--background)/0.35)]" />
                <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <div className="relative">
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                  ) : (
                    <Send className="h-4 w-4 text-primary-foreground" strokeWidth={2.4} />
                  )}
                </div>
              </motion.button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Animated counter ring for the last 500 chars ────────────────────────── */
function CounterRing({ value, max }: { value: number; max: number }) {
  const pct = Math.min(1, value / max);
  const radius = 8;
  const circ = 2 * Math.PI * radius;
  const dash = circ * pct;
  const remaining = max - value;
  const danger = remaining <= 50;
  const warn = remaining <= 200;
  const gradId = "counterRingGrad";
  return (
    <motion.div
      className="relative flex h-5 w-5 items-center justify-center"
      animate={
        danger
          ? { scale: [1, 1.12, 1] }
          : warn
            ? { scale: [1, 1.05, 1] }
            : { scale: 1 }
      }
      transition={
        danger
          ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
          : warn
            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
      }
      style={
        danger
          ? { filter: "drop-shadow(0 0 6px hsl(var(--destructive) / 0.55))" }
          : warn
            ? { filter: "drop-shadow(0 0 5px hsl(var(--primary) / 0.45))" }
            : undefined
      }
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {danger ? (
              <>
                <stop offset="0%" stopColor="hsl(var(--destructive))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--primary) / 0.55)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted) / 0.6)"
          strokeWidth="2"
        />
        <circle
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-[stroke-dasharray] duration-300 ease-out"
        />
      </svg>
      <span
        className={`absolute text-[8px] font-semibold tabular-nums transition-colors ${
          danger ? "text-destructive" : warn ? "text-primary" : "text-foreground/70"
        }`}
      >
        {remaining}
      </span>
    </motion.div>
  );
}
