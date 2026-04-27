import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, XCircle, X, MessageCircle, FileText, Loader2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AccessRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  /** Pass false for staff or non-owners — banner won't render. */
  visible?: boolean;
}

const DISMISS_KEY = (userId: string, id: string, status: string) =>
  `mfs_api_access_banner_dismissed:${userId}:${id}:${status}`;

/**
 * Persistent confirmation banner shown to merchant owners after they submit an
 * API access request. Reflects the latest status (pending / approved / rejected)
 * in real time and can be dismissed once the merchant has acknowledged a
 * terminal state. Pending state is non-dismissable so the open request stays visible.
 */
export default function MerchantApiAccessStatusBanner({ userId, visible = true }: Props) {
  const navigate = useNavigate();
  const [latest, setLatest] = useState<AccessRequest | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("merchant_api_access_requests")
      .select("id, status, reviewer_note, reviewed_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const row: AccessRequest | null = data?.[0] ?? null;
    setLatest(row);
    if (row && row.status !== "pending") {
      setDismissed(localStorage.getItem(DISMISS_KEY(userId, row.id, row.status)) === "1");
    } else {
      setDismissed(false);
    }
  };

  useEffect(() => {
    if (!visible || !userId) return;
    load();
    const ch = supabase
      .channel(`api-access-banner-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_api_access_requests", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, visible]);

  if (!visible || !latest || dismissed) return null;

  const status = latest.status;
  const dismissable = status !== "pending";

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY(userId, latest.id, status), "1");
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
          <p className="text-xs font-bold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{body}</p>

          {status !== "pending" && (() => {
            const note = latest.reviewer_note?.trim();
            const isApproved = status === "approved";
            // For approved: only show if admin actually wrote a note (optional).
            // For denied: always show the block, with a fallback message.
            if (isApproved && !note) return null;
            const labelColor = isApproved ? "text-emerald-700 dark:text-emerald-500" : "text-destructive";
            const ringColor = isApproved ? "border-emerald-500/20" : "border-destructive/20";
            const heading = isApproved ? "Admin's approval note" : "Admin's reason for denial";
            return (
              <div className={`mt-2 rounded-lg border ${ringColor} bg-background/60 p-2`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>
                  {heading}
                </p>
                <p className="text-[11px] text-foreground mt-1 whitespace-pre-wrap break-words">
                  {note || "No reason was provided. Please contact support for details."}
                </p>
              </div>
            );
          })()}

          {/* Lifecycle timeline */}
          <Timeline status={status} createdAt={latest.created_at} reviewedAt={latest.reviewed_at} />

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

/* ─────────── Lifecycle Timeline ─────────── */

interface TimelineProps {
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

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
