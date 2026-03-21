import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, XCircle, Store, RefreshCw, Shield } from "lucide-react";
import QRCode from "qrcode";

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
      const url = await QRCode.toDataURL(qrPayload, { width: 280, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } });
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

  /* ── Gradient mesh background ── */
  const Background = () => (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );

  /* ── Glass card wrapper ── */
  const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full max-w-sm bg-card/90 backdrop-blur-2xl border border-border/20 rounded-3xl shadow-2xl shadow-primary/5 overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );

  /* ── Loading ── */
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Background />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full"
        />
      </div>
    );
  }

  /* ── Not found ── */
  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Background />
        <GlassCard>
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Session Not Found</h2>
            <p className="text-sm text-muted-foreground">This payment session does not exist or has been removed.</p>
          </div>
          <div className="border-t border-border/10 px-6 py-4 text-center">
            <p className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" /> Secured by EasyPay
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  /* ── Error ── */
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Background />
        <GlassCard>
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Something Went Wrong</h2>
            <p className="text-sm text-muted-foreground">Could not load this payment session.</p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-primary/20"
            >
              <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
              Retry
            </button>
          </div>
          <div className="border-t border-border/10 px-6 py-4 text-center">
            <p className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" /> Secured by EasyPay
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  /* ── Main (pending / completed / expired) ── */
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Background />
      <GlassCard>
        {/* Header */}
        <div className="px-6 pt-7 pb-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-3 ring-1 ring-primary/10">
            <Store className="w-7 h-7 text-primary" />
          </div>
          {merchantName && (
            <h1 className="text-lg font-bold text-foreground tracking-tight">{merchantName}</h1>
          )}
          {merchantCategory && (
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {merchantCategory.replace(/_/g, " ")}
            </p>
          )}
          <div className="mt-3 flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              ৳{fmt(amount)}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              {currency}
            </span>
          </div>
          {reference && (
            <p className="text-xs text-muted-foreground/70 mt-2">Ref: {reference}</p>
          )}
        </div>

        {/* Thin divider */}
        <div className="mx-6 h-px bg-border/10" />

        <AnimatePresence mode="wait">
          {/* ── Pending ── */}
          {status === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-6 pt-5 pb-6 space-y-5"
            >
              {qrDataUrl && (
                <div className="bg-white rounded-2xl p-5 mx-auto w-fit shadow-sm shadow-black/5">
                  <img src={qrDataUrl} alt="Payment QR Code" className="w-56 h-56" />
                </div>
              )}
              <p className="text-center text-sm text-muted-foreground">
                Scan with <span className="font-semibold text-foreground">EasyPay</span> app to pay
              </p>
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground/70" />
                <span
                  className={`text-sm font-mono font-bold tracking-wider ${
                    secondsLeft <= 60 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {fmtTime(secondsLeft)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs text-muted-foreground/70">Waiting for payment…</span>
              </div>
            </motion.div>
          )}

          {/* ── Completed ── */}
          {status === "completed" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 pt-6 pb-8 text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground">Payment Received!</h2>
              <p className="text-sm text-muted-foreground">৳{fmt(amount)} paid successfully</p>
              {successUrl && (
                <p className="text-xs text-muted-foreground/60">Redirecting…</p>
              )}
            </motion.div>
          )}

          {/* ── Expired ── */}
          {status === "expired" && (
            <motion.div
              key="expired"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 pt-6 pb-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-destructive/60" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Session Expired</h2>
              <p className="text-sm text-muted-foreground">This payment session has expired.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="border-t border-border/10 px-6 py-4 text-center">
          <p className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" /> Secured by EasyPay
          </p>
        </div>
      </GlassCard>
    </div>
  );
};

export default DynamicQrPage;
