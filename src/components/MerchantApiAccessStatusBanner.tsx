import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, XCircle, X, MessageCircle, FileText, Loader2, Circle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { buildMerchantApiAccessPrefill } from "@/lib/buildMerchantApiAccessPrefill";
import { redactSensitive } from "@/lib/redactSensitive";

interface AccessRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  /** Used to prefill the new request draft when the merchant submits again. */
  merchantId?: string | null;
  /** Pass false for staff or non-owners — banner won't render. */
  visible?: boolean;
}

// Pending banner dismissals are session-only (sessionStorage), so they reappear on refresh.
// Approved/denied banners are NOT dismissable — they stay until the merchant submits a new
// request (which moves the latest row back to "pending") or refreshes the page.
const PENDING_DISMISS_KEY = (userId: string, id: string) =>
  `mfs_api_access_banner_dismissed_pending:${userId}:${id}`;

/**
 * Persistent confirmation banner shown to merchant owners after they submit an
 * API access request. Reflects the latest status (pending / approved / rejected)
 * in real time. Pending banners can be dismissed for the current session;
 * approved/denied banners stay visible until a new request is submitted.
 */
type RtStatus = "connecting" | "live" | "retrying" | "offline";

export default function MerchantApiAccessStatusBanner({ userId, merchantId, visible = true }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [latest, setLatest] = useState<AccessRequest | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [rtStatus, setRtStatus] = useState<RtStatus>("connecting");
  const [rtError, setRtError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("merchant_api_access_requests")
      .select("id, status, reviewer_note, reviewed_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return;
    const row: AccessRequest | null = data?.[0] ?? null;
    if (!mountedRef.current) return;
    setLatest(row);
    if (row && row.status === "pending") {
      // Pending: respect a session-only dismissal so the banner reappears on refresh.
      setDismissed(sessionStorage.getItem(PENDING_DISMISS_KEY(userId, row.id)) === "1");
    } else {
      // Approved/denied: never dismissed — stays visible until a new request or refresh.
      setDismissed(false);
    }
  }, [userId]);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback((reason: string) => {
    if (!mountedRef.current) return;
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    setRetryAttempt(attempt);
    setRtStatus("retrying");
    setRtError(reason);
    // Exponential backoff capped at 30s: 1s, 2s, 4s, 8s, 16s, 30s...
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt - 1, 5));
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      // Refresh data on each retry so user still sees up-to-date info.
      load();
      connect();
    }, delay);
  }, [load]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    cleanupChannel();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setRtStatus("offline");
      setRtError("You appear to be offline. We'll reconnect automatically.");
      return;
    }
    setRtStatus("connecting");
    setRtError(null);
    const ch = supabase
      .channel(`api-access-banner-${userId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_api_access_requests", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe((status, err) => {
        if (!mountedRef.current) return;
        if (status === "SUBSCRIBED") {
          attemptRef.current = 0;
          setRetryAttempt(0);
          setRtStatus("live");
          setRtError(null);
          // Refresh once on reconnect to catch any missed events.
          load();
        } else if (status === "CHANNEL_ERROR") {
          scheduleRetry(err?.message || "Realtime channel error. Retrying…");
        } else if (status === "TIMED_OUT") {
          scheduleRetry("Connection timed out. Retrying…");
        } else if (status === "CLOSED") {
          // Closed unexpectedly while we still want to listen → retry.
          if (mountedRef.current && visible && userId) {
            scheduleRetry("Connection closed. Reconnecting…");
          }
        }
      });
    channelRef.current = ch;
  }, [userId, visible, load, cleanupChannel, scheduleRetry]);

  const manualRetry = useCallback(() => {
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    attemptRef.current = 0;
    setRetryAttempt(0);
    load();
    connect();
  }, [load, connect]);

  useEffect(() => {
    if (!visible || !userId) return;
    mountedRef.current = true;
    load();
    connect();

    // Periodic safety-net poll every 30s — keeps banner fresh even if
    // realtime is silently broken (e.g. proxy buffering).
    pollTimerRef.current = window.setInterval(() => {
      load();
    }, 30000);

    const onOnline = () => { manualRetry(); };
    const onOffline = () => {
      setRtStatus("offline");
      setRtError("You're offline. We'll reconnect automatically when your connection returns.");
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && rtStatus !== "live") manualRetry();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      cleanupChannel();
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, visible]);

  if (!visible || !latest || dismissed) return null;

  const status = latest.status;
  // Only the pending banner can be dismissed (session-only).
  // Approved/denied banners stay until a new request is submitted or the page is refreshed.
  const dismissable = status === "pending";

  const dismiss = () => {
    if (status !== "pending") return;
    sessionStorage.setItem(PENDING_DISMISS_KEY(userId, latest.id), "1");
    setDismissed(true);
  };

  const palette =
    status === "pending"
      ? { ring: "border-amber-500/30", bg: "bg-amber-500/5", icon: "text-amber-600", Icon: Clock }
      : status === "approved"
      ? { ring: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: "text-emerald-600", Icon: CheckCircle2 }
      : { ring: "border-destructive/30", bg: "bg-destructive/5", icon: "text-destructive", Icon: XCircle };

  const title =
    status === "pending"
      ? "API access request submitted"
      : status === "approved"
      ? "API access approved"
      : "API access request denied";

  const body =
    status === "pending"
      ? "Our team is reviewing your request. You'll be notified once a decision is made."
      : status === "approved"
      ? "You can now generate API keys and configure webhooks from the API tab."
      : "Your request was denied. You can review the admin's note below, then submit a new request or contact support.";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`relative rounded-2xl border ${palette.ring} ${palette.bg} p-3 pr-10 mb-3 flex items-start gap-3`}
      >
        <palette.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${palette.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-foreground">{title}</p>
            <ConnectionPill status={rtStatus} attempt={retryAttempt} onRetry={manualRetry} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{body}</p>

          {(rtStatus === "retrying" || rtStatus === "offline") && (
            <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2 flex items-start gap-2">
              <WifiOff className="w-3 h-3 mt-0.5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-500">
                  Live updates interrupted
                </p>
                <p className="text-[11px] text-foreground/80 mt-0.5 leading-relaxed">
                  {rtError || "We lost the realtime connection."} The status above is being refreshed every 30 seconds in the meantime.
                </p>
                <button
                  onClick={manualRetry}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-500 hover:underline"
                >
                  <RefreshCw className="w-3 h-3" /> Retry now
                </button>
              </div>
            </div>
          )}
          {status !== "pending" && (() => {
            const note = latest.reviewer_note?.trim();
            const isApproved = status === "approved";
            // For approved: only show if admin actually wrote a note (optional).
            // For denied: always show the block, with a fallback message.
            if (isApproved && !note) return null;
            const labelColor = isApproved ? "text-emerald-700 dark:text-emerald-500" : "text-destructive";
            const ringColor = isApproved ? "border-emerald-500/20" : "border-destructive/20";
            const heading = isApproved ? t("apiAccessAdminApprovalNote") : t("apiAccessAdminDenialReason");
            return (
              <div className={`mt-2 rounded-lg border ${ringColor} bg-background/60 p-2`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>
                  {heading}
                </p>
                <p className="text-[11px] text-foreground mt-1 whitespace-pre-wrap break-words">
                  {note ? redactSensitive(note) : t("apiAccessNoReasonProvided")}
                </p>
              </div>
            );
          })()}

          {/* Lifecycle timeline */}
          <Timeline status={status} createdAt={latest.created_at} reviewedAt={latest.reviewed_at} />

          {status === "rejected" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  const prefill = await buildMerchantApiAccessPrefill(userId, { merchantId });
                  const note = latest.reviewer_note?.trim();
                  const params = new URLSearchParams({
                    openChat: "1",
                    prefill,
                    newApiRequest: "1",
                    contextTitle: t("apiAccessAdminDenialReason"),
                    contextBody: redactSensitive(note || t("apiAccessNoReasonProvided")),
                    ...(merchantId ? { merchantId } : {}),
                  });
                  navigate(`/account?${params.toString()}`);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm hover:opacity-90"
              >
                <RefreshCw className="w-3 h-3" /> Submit new API request
              </button>
              <button
                onClick={() => navigate("/account?openChat=1")}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="w-3 h-3" /> Contact support
              </button>
            </div>
          )}

          {status === "pending" && (
            <button
              onClick={() => navigate("/account?openChat=1")}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <MessageCircle className="w-3 h-3" /> Follow up in Live Chat
            </button>
          )}
        </div>
        {dismissable && (
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ─────────── Connection Pill ─────────── */

function ConnectionPill({
  status,
  attempt,
  onRetry,
}: {
  status: RtStatus;
  attempt: number;
  onRetry: () => void;
}) {
  if (status === "live") {
    return (
      <span
        title="Live updates connected"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-500"
      >
        <Wifi className="w-2.5 h-2.5" />
        Live
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Connecting
      </span>
    );
  }
  if (status === "offline") {
    return (
      <button
        onClick={onRetry}
        title="You're offline. Tap to retry."
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-500 hover:bg-amber-500/20"
      >
        <WifiOff className="w-2.5 h-2.5" />
        Offline
      </button>
    );
  }
  return (
    <button
      onClick={onRetry}
      title="Reconnecting to live updates. Tap to retry now."
      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-500 hover:bg-amber-500/20"
    >
      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
      Reconnecting{attempt > 1 ? ` · ${attempt}` : ""}
    </button>
  );
}

/* ─────────── Lifecycle Timeline ─────────── */

interface TimelineProps {
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
}

// User's resolved IANA timezone, e.g. "Asia/Dhaka" or "America/Los_Angeles".
const userTimeZone =
  (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || undefined;

// Returns a short timezone abbreviation for the given date in the user's locale.
// Falls back to a GMT±HH:MM offset if the runtime can't produce a name (e.g. "GMT+6").
const tzAbbr = (d: Date) => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: userTimeZone,
      timeZoneName: "short",
    }).formatToParts(d);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tz) return tz;
  } catch {
    /* ignore — fall through to offset */
  }
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `GMT${sign}${hh}:${mm}`;
};

// Renders the timestamp in the user's local timezone with the abbreviation appended,
// e.g. "Apr 27, 02:30 PM BST".
const fmt = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: userTimeZone,
  });
  return `${time} ${tzAbbr(d)}`;
};

function Timeline({ status, createdAt, reviewedAt }: TimelineProps) {
  const decided = status !== "pending";
  const decisionTs = reviewedAt ?? (decided ? createdAt : null);

  const steps = [
    {
      key: "submitted",
      label: "Submitted",
      sub: fmt(createdAt),
      state: "done" as const,
      Icon: FileText,
    },
    {
      key: "processing",
      label: decided ? "Processed by admin" : "Processing review",
      sub: decided && decisionTs ? `until ${fmt(decisionTs)}` : "In review by our team",
      state: decided ? ("done" as const) : ("active" as const),
      Icon: decided ? CheckCircle2 : Loader2,
    },
    {
      key: "decision",
      label: status === "approved" ? "Approved" : status === "rejected" ? "Denied" : "Decision pending",
      sub: decided && decisionTs ? fmt(decisionTs) : "Awaiting decision",
      state: status === "approved" ? ("done" as const)
           : status === "rejected" ? ("denied" as const)
           : ("upcoming" as const),
      Icon: status === "approved" ? CheckCircle2
          : status === "rejected" ? XCircle
          : Circle,
    },
  ];

  return (
    <ol className="mt-3 space-y-2.5">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const dotColor =
          s.state === "done" ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30"
          : s.state === "active" ? "bg-amber-500/15 text-amber-600 ring-amber-500/30"
          : s.state === "denied" ? "bg-destructive/15 text-destructive ring-destructive/30"
          : "bg-muted text-muted-foreground ring-border";
        const lineColor =
          s.state === "done" ? "bg-emerald-500/40"
          : s.state === "active" ? "bg-amber-500/40"
          : "bg-border";
        return (
          <li key={s.key} className="relative flex items-start gap-2.5">
            <div className="relative flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full ring-1 flex items-center justify-center ${dotColor}`}>
                <s.Icon className={`w-2.5 h-2.5 ${s.state === "active" ? "animate-spin" : ""}`} />
              </div>
              {!isLast && <div className={`w-px flex-1 mt-1 ${lineColor}`} style={{ minHeight: 14 }} />}
            </div>
            <div className="flex-1 min-w-0 -mt-0.5 pb-1">
              <p className={`text-[11px] font-semibold ${
                s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"
              }`}>
                {s.label}
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">{s.sub}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
