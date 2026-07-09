import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, XCircle, Store, RefreshCw, Wallet } from "lucide-react";
import QRCode from "qrcode";
import DynamicQrPaySheet from "@/components/DynamicQrPaySheet";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Status = "loading" | "pending" | "completed" | "expired" | "not_found" | "error";

interface SessionInfo {
  id: string;
  amount: number;
  currency: string;
  reference: string | null;
  description: string | null;
  status: string;
  success_url: string | null;
  expires_at: string;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
  merchant_name: string | null;
  merchant_category: string | null;
}

const DynamicQrPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("loading");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("BDT");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCategory, setMerchantCategory] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [showPaySheet, setShowPaySheet] = useState(false);
  const expiresRef = useRef<number>(0);

  const fetchSession = useCallback(async () => {
    if (!sessionId || !UUID_RE.test(sessionId)) {
      setStatus("not_found");
      return;
    }
    setStatus("loading");
    try {
      const { data, error } = await supabase.rpc("get_public_session_info", {
        p_session_id: sessionId,
      });

      if (error) {
        console.error("DynamicQR fetch error:", error.message);
        setStatus("error");
        return;
      }

      const session = data as unknown as SessionInfo | null;
      if (!session) {
        setStatus("not_found");
        return;
      }

      setAmount(session.amount);
      setCurrency(session.currency);
      setReference(session.reference);
      setSuccessUrl(session.success_url);

      // Merchant name: prefer RPC field, fallback to metadata
      const name = session.merchant_name
        || (typeof session.metadata?.merchant_name === "string" ? session.metadata.merchant_name : "");
      setMerchantName(name);
      setMerchantCategory(session.merchant_category || "");
      setMerchantId(session.merchant_id);

      if (session.status === "completed") { setStatus("completed"); return; }
      if (session.status === "expired" || session.status === "failed" || new Date(session.expires_at) < new Date()) {
        setStatus("expired"); return;
      }

      expiresRef.current = new Date(session.expires_at).getTime();

      const qrPayload = JSON.stringify({
        type: "easypay",
        sessionId: session.id,
        merchantId: session.merchant_id,
        amount: session.amount,
        ref: session.reference || null,
      });
      const url = await QRCode.toDataURL(qrPayload, { width: 320, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } });
      setQrDataUrl(url);
      setStatus("pending");
    } catch (err) {
      console.error("DynamicQR unexpected error:", err);
      setStatus("error");
    }
  }, [sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  // Countdown
  useEffect(() => {
    if (status !== "pending") return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setStatus("expired");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Realtime subscription
  useEffect(() => {
    if (!sessionId || status !== "pending") return;
    const channel = supabase
      .channel(`qr-session-${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "merchant_payment_sessions",
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const newStatus = (payload.new as any).status;
        if (newStatus === "completed") {
          setStatus("completed");
          setTimeout(() => { if (successUrl) window.location.href = successUrl; }, 3000);
        } else if (newStatus === "expired" || newStatus === "failed") {
          setStatus("expired");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, status, successUrl]);

  const handleRetry = async () => {
    setRetrying(true);
    await fetchSession();
    setRetrying(false);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full" />
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">{t("dqpSessionNotFound")}</h2>
          <p className="text-sm text-muted-foreground">{t("dqpSessionNotFoundDesc")}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">{t("dqpSomethingWrong")}</h2>
          <p className="text-sm text-muted-foreground">{t("dqpCouldNotLoad")}</p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold mt-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
            {t("dqpRetry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-card to-accent/5 px-3 pt-3 pb-0.5 text-center">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-1">
            <Store className="w-6 h-6 text-primary" />
          </div>
          {merchantName && <h1 className="text-base font-bold text-foreground">{merchantName}</h1>}
          {merchantCategory && <p className="text-[11px] text-muted-foreground capitalize">{merchantCategory.replace(/_/g, " ")}</p>}
          <p className="text-2xl font-extrabold text-foreground mt-0.5">
            ৳{fmt(amount)} <span className="text-xs font-medium text-muted-foreground">{currency}</span>
          </p>
          {reference && <p className="text-[11px] text-muted-foreground mt-0.5">{t("dqpRef")}: {reference}</p>}
        </div>

        <AnimatePresence mode="wait">
          {status === "pending" && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-2 py-1.5 space-y-1">
              {qrDataUrl && (
                <div className="bg-white rounded-xl p-1.5 mx-auto w-fit shadow-sm">
                  <img src={qrDataUrl} alt={t("dqpPaymentQrAlt")} className="w-48 h-48" />
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                {t("dqpScanWith")} <span className="font-semibold text-foreground">EasyPay</span> {t("dqpToPay")}
              </p>
              <div className="flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={`text-xs font-mono font-bold ${secondsLeft <= 60 ? "text-destructive" : "text-muted-foreground"}`}>
                  {fmtTime(secondsLeft)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-[11px] text-muted-foreground">{t("dqpWaiting")}</span>
              </div>
              {isAuthenticated && (
                <button
                  onClick={() => setShowPaySheet(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                >
                  <Wallet className="w-4 h-4" />
                  {t("dqpPayWithEasyPay")}
                </button>
              )}
            </motion.div>
          )}

          {status === "completed" && (
            <motion.div key="completed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-5 text-center space-y-3">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}>
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground">{t("dqpPaymentReceived")}</h2>
              <p className="text-sm text-muted-foreground">৳{fmt(amount)} {t("dqpPaidSuccess")}</p>
              {successUrl && <p className="text-xs text-muted-foreground">{t("dqpRedirecting")}</p>}
            </motion.div>
          )}

          {status === "expired" && (
            <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 text-center space-y-3">
              <XCircle className="w-14 h-14 text-destructive/60 mx-auto" />
              <h2 className="text-lg font-bold text-foreground">{t("dqpSessionExpired")}</h2>
              <p className="text-sm text-muted-foreground">{t("dqpSessionExpiredDesc")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-3 pb-1.5 pt-0.5 text-center">
          <p className="text-[10px] text-muted-foreground/60">{t("dqpPoweredBy")}</p>
        </div>
      </motion.div>

      {sessionId && (
        <DynamicQrPaySheet
          open={showPaySheet}
          onClose={() => { setShowPaySheet(false); fetchSession(); }}
          sessionId={sessionId}
          merchantId={merchantId}
          amount={amount}
          ref_={reference}
        />
      )}
    </div>
  );
};

export default DynamicQrPage;
