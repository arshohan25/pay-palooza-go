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
  Sparkles,
  Paperclip,
  X,
  FileText,
  Download,
  ArrowDown,
} from "lucide-react";

import { toast } from "sonner";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface PinResetMessage {
  id: string;
  request_id: string;
  sender_role: "merchant" | "admin" | "system";
  content: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_merchant: boolean;
  read_by_admin_at?: string | null;
  attachment_path?: string | null;
  attachment_mime?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
}

interface PinResetTicketChatProps {
  /** Pass "pending" while the parent is still resolving the request id from `merchant-forgot-pin`. */
  requestId: string;
  initialTicket: string;
  maskedPhone: string;
  onSessionExpired: () => void;
}

const POLL_FALLBACK_MS = 4000;
const MAX_ATTACH_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];
const ATTACH_BUCKET = "pin-reset-attachments";

/* ────────────────────────────────────────────────────────────── helpers ── */

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const makeFormatDayLabel = (lang: "en" | "bn", t: (k: TranslationKey) => string) => (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return t("prcDayToday") as string;
  if (sameDay(d, yest)) return t("prcDayYesterday") as string;
  return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-BD", { month: "short", day: "numeric" });
};

const makeFormatTime = (lang: "en" | "bn") => (iso: string) =>
  new Date(iso).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-BD", { hour: "2-digit", minute: "2-digit" });

const formatBytes = (n?: number | null) => {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/* ────────────────────────────────────────────────────────────── component */

export default function PinResetTicketChat({
  requestId: initialRequestId,
  initialTicket,
  maskedPhone,
  onSessionExpired,
}: PinResetTicketChatProps) {
  const { t, lang } = useI18n();
  const fmtNum = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US").format(n);
  const tp = (key: TranslationKey, vars: Record<string, string | number>) => {
    let s = t(key) as string;
    for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    return s;
  };
  const formatDayLabel = useMemo(() => makeFormatDayLabel(lang, t as any), [lang, t]);
  const formatTime = useMemo(() => makeFormatTime(lang), [lang]);
  const [requestId, setRequestId] = useState(initialRequestId);
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState<PinResetMessage[]>([]);
  const [status, setStatus] = useState<"open" | "resolved" | string>("open");
  const [input, setInput] = useState("");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sending, setSending] = useState(false);

  // Pending attachment state (selected → uploaded → attached on send)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0); // 0..1
  const [uploaded, setUploaded] = useState<{ path: string; mime: string; name: string; size: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ticketRef = useRef(initialTicket);
  const requestIdRef = useRef(initialRequestId);
  const expiredHandledRef = useRef(false);

  // Auto-scroll + unread tracking
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => { atBottomRef.current = atBottom; }, [atBottom]);

  useEffect(() => { ticketRef.current = ticket; }, [ticket]);
  useEffect(() => { requestIdRef.current = requestId; }, [requestId]);

  /* Listen for parent's background-resolved request id */
  useEffect(() => {
    if (requestId !== "pending") return;
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

  const scrollToBottom = useCallback((smooth = false) => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      setUnreadCount(0);
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isBottom = distance < 60;
    setAtBottom(isBottom);
    if (isBottom) setUnreadCount(0);
  }, []);

  const handleExpiry = useCallback(() => {
    if (expiredHandledRef.current) return;
    expiredHandledRef.current = true;
    onSessionExpired();
  }, [onSessionExpired]);

  const callChat = useCallback(
    async (action: "fetch" | "send" | "ack" | "attach_init" | "attach_url", extra: Record<string, unknown> = {}) => {
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

  /* Fetch + polling */
  useEffect(() => {
    if (requestId === "pending") return;
    let cancelled = false;
    let intervalId: number | null = null;

    const load = async (initial: boolean) => {
      try {
        const payload = await callChat("fetch");
        if (cancelled) return;
        const next = (payload.messages ?? []) as PinResetMessage[];
        let hadNewAdmin = false;
        setMessages((prev) => {
          if (!initial) {
            const prevIds = new Set(prev.map((m) => m.id));
            hadNewAdmin = next.some((m) => m.sender_role === "admin" && !prevIds.has(m.id));
          }
          return next;
        });
        if (payload.status) setStatus(payload.status);
        if (initial) {
          setBootstrapping(false);
          scrollToBottom();
        } else if (hadNewAdmin) {
          if (atBottomRef.current) scrollToBottom(true);
          else setUnreadCount((c) => c + (next.filter((m) => m.sender_role === "admin").length > 0 ? 1 : 0));
        }
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

  /* Realtime — both INSERT (new messages) and UPDATE (read receipts) */
  useEffect(() => {
    if (requestId === "pending") return;
    const channel = supabase
      .channel(`pin-reset-${requestId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "merchant_pin_reset_messages", filter: `request_id=eq.${requestId}` },
        (payload) => {
          const msg = payload.new as PinResetMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_role === "admin") {
            if (atBottomRef.current) {
              scrollToBottom(true);
            } else {
              setUnreadCount((c) => c + 1);
            }
            void callChat("ack").catch(() => {});
          } else {
            scrollToBottom(true);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "merchant_pin_reset_messages", filter: `request_id=eq.${requestId}` },
        (payload) => {
          const next = payload.new as PinResetMessage;
          setMessages((prev) => prev.map((m) => (m.id === next.id ? { ...m, ...next } : m)));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId, callChat, scrollToBottom]);

  /* ───── Attachment selection + upload ──────────────────────────────────── */
  const clearPending = () => {
    setPendingFile(null);
    setUploaded(null);
    setUploadProgress(0);
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview);
      setPendingPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIMES.includes(file.type)) {
      toast.error("Only images (JPG, PNG, WEBP, GIF) and PDFs are allowed");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_ATTACH_BYTES) {
      toast.error("File too large (max 5 MB)");
      e.target.value = "";
      return;
    }
    if (requestId === "pending") {
      toast.info("Connecting… try again in a moment.");
      e.target.value = "";
      return;
    }

    setPendingFile(file);
    setPendingPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setUploadProgress(0.05);

    try {
      const init = await callChat("attach_init", { mime: file.type, size: file.size, name: file.name });
      const { path, token } = init.upload as { path: string; token: string };
      setUploadProgress(0.25);

      const { error: upErr } = await supabase.storage
        .from(ATTACH_BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      setUploaded({ path, mime: file.type, name: file.name, size: file.size });
      setUploadProgress(1);
    } catch (err: any) {
      toast.error(err?.message || (t("prcErrUploadFailed") as string));
      clearPending();
    }
  };

  /* Outgoing queue — lets the user send before request_id resolves */
  type Pending = { id: string; text: string; attachment: typeof uploaded };
  const [queue, setQueue] = useState<Pending[]>([]);
  const queueRef = useRef<Pending[]>([]);
  const flushingRef = useRef(false);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    if (requestIdRef.current === "pending") return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current[0];
        try {
          const payload = await callChat("send", {
            content: next.text,
            ...(next.attachment ? { attachment: next.attachment } : {}),
          });
          const real = payload.message as PinResetMessage;
          setMessages((prev) => prev.map((m) => (m.id === next.id ? real : m)));
          setQueue((q) => q.slice(1));
        } catch (err: any) {
          // Stop flushing on error; surface and remove the failed item
          setMessages((prev) => prev.filter((m) => m.id !== next.id));
          setQueue((q) => q.slice(1));
          toast.error(err?.message || (t("prcErrSendFailed") as string));
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [callChat]);

  // Flush as soon as the request id resolves or new items arrive
  useEffect(() => {
    if (requestId !== "pending" && queue.length > 0) void flushQueue();
  }, [requestId, queue.length, flushQueue]);

  /* Composer send */
  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && !uploaded) || sending || status !== "open") return;

    const sentText = text;
    const sentAttachment = uploaded;
    setInput("");
    clearPending();

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: PinResetMessage = {
      id: tempId,
      request_id: requestId,
      sender_role: "merchant",
      content: sentText,
      created_at: new Date().toISOString(),
      read_by_admin: false,
      read_by_merchant: true,
      read_by_admin_at: null,
      attachment_path: sentAttachment?.path ?? null,
      attachment_mime: sentAttachment?.mime ?? null,
      attachment_name: sentAttachment?.name ?? null,
      attachment_size: sentAttachment?.size ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setQueue((q) => [...q, { id: tempId, text: sentText, attachment: sentAttachment }]);
    scrollToBottom();
    inputRef.current?.focus();

    if (requestId !== "pending") void flushQueue();
  };

  const isResolved = status !== "open";
  const stillConnecting = requestId === "pending" || bootstrapping;

  /* Group consecutive messages by sender for cleaner avatar stack */
  const decorated = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const isFirstOfRun = !prev || prev.sender_role !== m.sender_role;
      const showDayDivider = !prev || formatDayLabel(prev.created_at) !== formatDayLabel(m.created_at);
      return { msg: m, isFirstOfRun, showDayDivider };
    });
  }, [messages]);

  /* Find the last outgoing message id so we can render a "Seen by support" line under it */
  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_role === "merchant" && !messages[i].id.startsWith("temp-")) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  const composerDisabled = sending || (uploaded === null && pendingFile !== null) || isResolved;
  const canSend = (!!input.trim() || !!uploaded) && !sending && !isResolved;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-background via-background to-primary/[0.04]"
    >
      {/* Premium header */}
      <div
        className="relative shrink-0 border-b border-border/50 bg-gradient-to-r from-primary/[0.07] via-background to-primary/[0.04] py-2.5 backdrop-blur-xl"
        style={{
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
        }}
      >
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
                {t("prcSupportName")}
              </h2>
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <p className="flex items-center gap-1 truncate text-[10px] leading-tight text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              {t("prcEncrypted")} · +88 {maskedPhone}
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
            {isResolved ? t("prcResolvedBadge") : t("prcVerifiedBadge")}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 space-y-2 overflow-y-auto pb-3 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          paddingLeft: "max(env(safe-area-inset-left), 1.25rem)",
          paddingRight: "max(env(safe-area-inset-right), 1.25rem)",
        }}
      >
        {/* Welcome bubble */}
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
              {t("prcWelcomeMsg")}
            </p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {t("prcWelcomeFooter")}
            </p>
          </div>
        </motion.div>

        {/* No connecting skeleton — chat is treated as instantly ready. */}

        <AnimatePresence initial={false}>
          {decorated.map(({ msg, isFirstOfRun, showDayDivider }) => {
            const isMe = msg.sender_role === "merchant";
            const isLastOwn = isMe && msg.id === lastOwnMessageId;
            const isPending = msg.id.startsWith("temp-");
            const seenLabel = msg.read_by_admin_at ? formatTime(msg.read_by_admin_at) : null;
            const fullSeenTitle = msg.read_by_admin_at
              ? tp("prcSeenOn", { when: new Date(msg.read_by_admin_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })
              : undefined;
            return (
              <div key={msg.id}>
                {showDayDivider && (
                  <div className="my-3 flex items-center gap-2 px-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border/60" />
                    <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                      {formatDayLabel(msg.created_at)}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border/60" />
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.16 }}
                  className={`flex items-end ${isMe ? "flex-row-reverse gap-0" : "gap-2"} ${isFirstOfRun ? "mt-1.5" : "mt-0.5"}`}
                >
                  {/* Avatar — only on incoming first-of-run. Outgoing rows have NO avatar slot. */}
                  {!isMe && (
                    <div className="w-7 shrink-0">
                      {isFirstOfRun && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 ring-2 ring-primary/15 ring-offset-1 ring-offset-background">
                          <Bot size={12} className="text-primary" />
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`relative max-w-[82%] px-3.5 py-2 ${
                      isMe
                        ? "rounded-[20px] rounded-br-[6px] bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-[0_6px_18px_-8px_hsl(var(--primary)/0.5)]"
                        : "rounded-[20px] rounded-bl-[6px] border border-border/30 bg-white/85 text-foreground shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.08)] backdrop-blur-sm dark:bg-card/80"
                    }`}
                  >
                    {!isMe && (
                      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    )}
                    {msg.attachment_path && (
                      <AttachmentBubble
                        message={msg}
                        isMe={isMe}
                        callChat={callChat}
                      />
                    )}
                    {msg.content && (
                      <p className={`break-words text-[12.5px] leading-relaxed ${msg.attachment_path ? "mt-1.5" : ""}`}>
                        {msg.content}
                      </p>
                    )}
                    <div
                      className={`mt-0.5 flex items-center gap-1 ${isMe ? "justify-end" : ""}`}
                      title={
                        isMe
                          ? isPending
                            ? (t("prcSending") as string)
                            : msg.read_by_admin
                              ? fullSeenTitle ?? (t("prcDeliveredRead") as string)
                              : (t("prcSent") as string)
                          : undefined
                      }
                    >
                      {isMe && isLastOwn && msg.read_by_admin && seenLabel && (
                        <span className="mr-0.5 text-[9.5px] font-medium tracking-wide text-cyan-100">
                          {tp("prcSeen", { time: seenLabel })}
                        </span>
                      )}
                      <span className={`text-[9px] tabular-nums ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {formatTime(msg.created_at)}
                      </span>
                      {isMe &&
                        (isPending ? (
                          <Loader2 size={10} className="animate-spin text-primary-foreground/65" aria-label={t("prcAriaSending") as string} />
                        ) : msg.read_by_admin ? (
                          <CheckCheck size={11} className="text-cyan-200" aria-label={t("prcAriaDelivered") as string} />
                        ) : (
                          <Check size={11} className="text-primary-foreground/55" aria-label={t("prcAriaSent") as string} />
                        ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Unread badge / jump-to-bottom */}
      <AnimatePresence>
        {unreadCount > 0 && !atBottom && (
          <motion.button
            type="button"
            onClick={() => scrollToBottom(true)}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.55)] ring-1 ring-primary/40"
            aria-label={tp(unreadCount > 1 ? "prcNewMsgMany" : "prcNewMsgOne", { n: fmtNum(unreadCount) })}
          >
            <ArrowDown className="h-3 w-3" />
            {tp(unreadCount > 1 ? "prcNewLabelMany" : "prcNewLabelOne", { n: fmtNum(unreadCount) })}
          </motion.button>
        )}
      </AnimatePresence>
      </div>

      {/* Composer */}
      <div
        className="relative shrink-0 pt-3"
        style={{
          paddingLeft: "max(env(safe-area-inset-left), 1.25rem)",
          paddingRight: "max(env(safe-area-inset-right), 1.25rem)",
          paddingBottom: "max(env(safe-area-inset-bottom), 10px)",
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 -top-5 h-5 bg-gradient-to-t from-background/85 to-transparent" />
        <div className="absolute inset-0 -z-0 border-t border-white/10 bg-gradient-to-b from-background/65 via-background/85 to-background/95 backdrop-blur-2xl" />

        <div className="relative z-10">
          {isResolved ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] p-3 text-center backdrop-blur-xl">
              <p className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300">{t("prcTicketResolved")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t("prcTryNewPin")}</p>
            </div>
          ) : (
            <>
              {/* Pending attachment chip */}
              <AnimatePresence>
                {pendingFile && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="mb-2 flex items-center gap-2 rounded-2xl border border-border/40 bg-card/70 p-1.5 pr-2 backdrop-blur-xl"
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {pendingPreview ? (
                        <img src={pendingPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-medium text-foreground">{pendingFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatBytes(pendingFile.size)}
                        {!uploaded && uploadProgress < 1 && tp("prcUploading", { pct: fmtNum(Math.round(uploadProgress * 100)) })}
                        {uploaded && t("prcReady")}
                      </p>
                      {!uploaded && (
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full bg-gradient-to-r from-primary to-primary/70"
                            animate={{ width: `${Math.max(8, uploadProgress * 100)}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearPending}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form
                onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
                className="flex items-end gap-2"
              >
                {/* Attach button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={onPickFile}
                />
                <motion.button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || isResolved || !!pendingFile}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/50 bg-card/70 text-muted-foreground backdrop-blur-xl transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </motion.button>

                {/* Glass pill input */}
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
                  <div
                    className={`absolute inset-0 rounded-[24px] bg-gradient-to-br transition-opacity duration-300 ${
                      input ? "from-primary/55 via-primary/25 to-primary/45" : "from-border/70 via-border/40 to-border/70"
                    }`}
                  />
                  <div className="relative m-[1px] rounded-[23px] bg-gradient-to-br from-background/60 via-card/55 to-background/75 backdrop-blur-xl">
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
                      placeholder={uploaded ? (t("prcPlaceholderCaption") as string) : (t("prcPlaceholderType") as string)}
                      rows={1}
                      disabled={composerDisabled}
                      className="block w-full resize-none rounded-[23px] border-0 bg-transparent px-4 py-3 pr-14 text-[13px] leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 disabled:opacity-60"
                      style={{ maxHeight: 120 }}
                    />
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
                  disabled={!canSend}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full disabled:cursor-not-allowed disabled:opacity-40"
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
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Attachment bubble (image thumbnail or PDF chip) ────────────────────── */
function AttachmentBubble({
  message,
  isMe,
  callChat,
}: {
  message: PinResetMessage;
  isMe: boolean;
  callChat: (action: "fetch" | "send" | "ack" | "attach_init" | "attach_url", extra?: Record<string, unknown>) => Promise<any>;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isImage = (message.attachment_mime ?? "").startsWith("image/");
  const isOptimistic = message.id.startsWith("temp-");

  useEffect(() => {
    if (!isImage || isOptimistic) return;
    let cancelled = false;
    setLoading(true);
    callChat("attach_url", { message_id: message.id })
      .then((p) => { if (!cancelled) setUrl(p?.url ?? null); })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [message.id, isImage, isOptimistic, callChat]);

  const open = async () => {
    if (isOptimistic) return;
    try {
      const p = await callChat("attach_url", { message_id: message.id });
      if (p?.url) window.open(p.url, "_blank", "noopener,noreferrer");
    } catch { /* ignore */ }
  };

  if (isImage) {
    return (
      <button
        type="button"
        onClick={open}
        className="block overflow-hidden rounded-xl"
        style={{ maxWidth: 220 }}
      >
        {(loading || (!url && !isOptimistic)) ? (
          <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-muted/60">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <img
            src={url ?? ""}
            alt={message.attachment_name ?? (t("prcAttachmentAlt") as string)}
            className="block max-h-[220px] w-auto rounded-xl"
            loading="lazy"
          />
        )}
      </button>
    );
  }

  // PDF / other
  return (
    <button
      type="button"
      onClick={open}
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${
        isMe ? "border-primary-foreground/25 bg-primary-foreground/10" : "border-border/50 bg-muted/40"
      }`}
      style={{ maxWidth: 240 }}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        isMe ? "bg-primary-foreground/15" : "bg-background"
      }`}>
        <FileText className={`h-4 w-4 ${isMe ? "text-primary-foreground" : "text-primary"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[11.5px] font-medium ${isMe ? "text-primary-foreground" : "text-foreground"}`}>
          {message.attachment_name ?? "Attachment"}
        </p>
        <p className={`text-[9.5px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatBytes(message.attachment_size)} · PDF
        </p>
      </div>
      <Download className={`h-3 w-3 shrink-0 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
    </button>
  );
}

/* ─── Animated counter ring ──────────────────────────────────────────────── */
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
      animate={danger ? { scale: [1, 1.12, 1] } : warn ? { scale: [1, 1.05, 1] } : { scale: 1 }}
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
        <circle cx="10" cy="10" r={radius} fill="none" stroke="hsl(var(--muted) / 0.6)" strokeWidth="2" />
        <circle
          cx="10" cy="10" r={radius} fill="none"
          stroke={`url(#${gradId})`} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-[stroke-dasharray] duration-300 ease-out"
        />
      </svg>
      <span className={`absolute text-[8px] font-semibold tabular-nums transition-colors ${
        danger ? "text-destructive" : warn ? "text-primary" : "text-foreground/70"
      }`}>
        {remaining}
      </span>
    </motion.div>
  );
}
