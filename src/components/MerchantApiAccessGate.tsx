import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, MessageCircle, CheckCircle2, Clock, XCircle, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AccessRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  merchantId?: string | null;
}

/**
 * Shown to merchants when the API Integration tab is locked.
 * Single CTA: creates a pending access request row and opens Live Chat
 * so the merchant can describe their needs freely.
 */
export default function MerchantApiAccessGate({ userId, merchantId }: Props) {
  const navigate = useNavigate();
  const [latest, setLatest] = useState<AccessRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("merchant_api_access_requests")
      .select("id, status, message, reviewer_note, reviewed_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    setLatest(data?.[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`api-access-req-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_api_access_requests", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const buildPrefill = () =>
    [
      "Hi EasyPay team, I'd like to request API access for my merchant account.",
      `Merchant ID: ${merchantId ?? "—"}`,
      "Purpose: [briefly describe how you'll use the API — webhooks, checkout, payouts, etc.]",
    ].join("\n");

  const openChat = (withDraft: boolean) => {
    const params = new URLSearchParams({ openChat: "1" });
    if (withDraft) params.set("prefill", buildPrefill());
    navigate(`/account?${params.toString()}`);
  };

  const status = latest?.status;
  const pending = status === "pending";
  const rejected = status === "rejected";

  // 7-day cooldown after rejection: re-enable only after the cooldown elapses.
  const COOLDOWN_DAYS = 7;
  const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const rejectedAt = rejected ? new Date(latest!.reviewed_at ?? latest!.created_at).getTime() : 0;
  const cooldownRemainingMs = rejected ? Math.max(0, rejectedAt + COOLDOWN_MS - Date.now()) : 0;
  const inCooldown = rejected && cooldownRemainingMs > 0;
  const cooldownUnlockAt = rejected ? new Date(rejectedAt + COOLDOWN_MS) : null;

  const formatRemaining = (ms: number) => {
    const totalHours = Math.ceil(ms / (60 * 60 * 1000));
    if (totalHours <= 24) return `${totalHours}h`;
    const days = Math.ceil(totalHours / 24);
    return `${days}d`;
  };

  const requestViaChat = async () => {
    if (inCooldown) {
      toast.error(`You can submit a new request after ${cooldownUnlockAt!.toLocaleDateString()} (${formatRemaining(cooldownRemainingMs)} remaining).`);
      return;
    }
    setSubmitting(true);
    if (!pending) {
      const { error } = await (supabase as any).from("merchant_api_access_requests").insert({
        user_id: userId,
        merchant_id: merchantId ?? null,
        message: null,
        status: "pending",
      });
      if (error) {
        setSubmitting(false);
        toast.error(error.message);
        return;
      }
      toast.success("Request submitted. Opening Live Chat…");
    }
    setSubmitting(false);
    openChat(true);
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d <= 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Globe className="w-6 h-6 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 border-2 border-card flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground">API Integration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Locked by default. Request access to generate API keys, configure webhooks, and integrate EasyPay into your site or app.
          </p>
        </div>
      </div>

      {/* Status block */}
      {!loading && latest && (
        <div className={`mt-4 rounded-xl border p-3 flex items-start gap-3 ${
          pending ? "border-amber-500/30 bg-amber-500/5"
          : status === "approved" ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-destructive/30 bg-destructive/5"
        }`}>
          {pending && <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
          {status === "approved" && <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
          {rejected && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground capitalize">
              Request {status}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {pending && "Our team is reviewing your request. You’ll see the API tab as soon as it’s approved. You can chat with support for updates."}
              {status === "approved" && "Access granted — refresh if the tab hasn’t appeared yet."}
              {rejected && "Your previous request was rejected. Review the admin's note below, then submit a new one or contact support."}
            </p>
            {rejected && (
              <div className="mt-2 rounded-lg border border-destructive/20 bg-background/60 p-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">
                  Admin's reason
                </p>
                <p className="text-[11px] text-foreground mt-1 whitespace-pre-wrap break-words">
                  {latest.reviewer_note?.trim() || "No reason was provided. Please contact support for details."}
                </p>
                <Button
                  size="sm"
                  variant="default"
                  disabled={submitting || inCooldown}
                  onClick={requestViaChat}
                  className="mt-2 h-7 text-[11px] gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  {inCooldown
                    ? `Submit new request in ${formatRemaining(cooldownRemainingMs)}`
                    : "Submit new API request"}
                </Button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Submitted {new Date(latest.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <Button
        size="sm"
        disabled={submitting || pending || inCooldown}
        onClick={requestViaChat}
        className="w-full mt-4 text-xs gap-1.5"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {pending
          ? "Request Pending — Awaiting Review"
          : inCooldown
          ? `Available in ${formatRemaining(cooldownRemainingMs)}`
          : rejected
          ? "Request Again via Live Chat"
          : "Request API Access via Live Chat"}
      </Button>

      {pending && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openChat(false)}
          className="w-full mt-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Open Live Chat to follow up
        </Button>
      )}

      {inCooldown && cooldownUnlockAt && (
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          You can submit a new request after <span className="font-semibold text-foreground">{cooldownUnlockAt.toLocaleDateString()}</span>.
          Need help sooner? <button onClick={() => openChat(false)} className="text-primary hover:underline">Contact support</button>.
        </p>
      )}

      {latest && !inCooldown && (
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          Last submitted: {relativeTime(latest.created_at)}
        </p>
      )}
      {!latest && !loading && (
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          You'll be taken to support chat with a prefilled template you can edit.
        </p>
      )}
    </motion.div>
  );
}
