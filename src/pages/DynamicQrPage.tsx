import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, XCircle, Store } from "lucide-react";
import QRCode from "qrcode";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type Status = "loading" | "pending" | "completed" | "expired" | "error";

const DynamicQrPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("BDT");
  const [merchantName, setMerchantName] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const expiresRef = useRef<number>(0);

  // Load session + generate QR
  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    (async () => {
      console.log("[DynamicQR] Fetching session:", sessionId);
      const { data: session, error } = await supabase
        .from("merchant_payment_sessions")
        .select("id, amount, currency, reference, description, status, success_url, expires_at, merchant_id")
        .eq("id", sessionId)
        .single();
      console.log("[DynamicQR] Session result:", { session, error });
      if (error || !session) { setStatus("error"); return; }

      setAmount(session.amount);
      setCurrency(session.currency);
      setReference(session.reference);
      setSuccessUrl(session.success_url);

      if (session.status === "completed") { setStatus("completed"); return; }
      if (session.status === "expired" || session.status === "failed" || new Date(session.expires_at) < new Date()) {
        setStatus("expired"); return;
      }

      expiresRef.current = new Date(session.expires_at).getTime();

      const { data: merch } = await supabase.from("merchants").select("business_name").eq("id", session.merchant_id).single();
      if (merch) setMerchantName(merch.business_name);

      // Build QR payload
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
    })();
  }, [sessionId]);

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

  // Realtime subscription for status changes
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
          // Redirect after short delay
          setTimeout(() => {
            if (successUrl) window.location.href = successUrl;
          }, 3000);
        } else if (newStatus === "expired" || newStatus === "failed") {
          setStatus("expired");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, status, successUrl]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Invalid Session</h2>
          <p className="text-sm text-muted-foreground">This payment link is not valid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card rounded-3xl shadow-xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-card to-accent/5 px-6 pt-6 pb-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <Store className="w-7 h-7 text-primary" />
          </div>
          {merchantName && <h1 className="text-lg font-bold text-foreground">{merchantName}</h1>}
          <p className="text-3xl font-extrabold text-foreground mt-1">
            ৳{fmt(amount)} <span className="text-sm font-medium text-muted-foreground">{currency}</span>
          </p>
          {reference && <p className="text-xs text-muted-foreground mt-1">Ref: {reference}</p>}
        </div>

        <AnimatePresence mode="wait">
          {status === "pending" && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-5">
              {/* QR Code */}
              {qrDataUrl && (
                <div className="bg-white rounded-2xl p-4 mx-auto w-fit shadow-sm">
                  <img src={qrDataUrl} alt="Payment QR Code" className="w-64 h-64" />
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Scan with <span className="font-semibold text-foreground">EasyPay</span> app to pay
              </p>

              {/* Timer */}
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className={`text-sm font-mono font-bold ${secondsLeft <= 60 ? "text-destructive" : "text-muted-foreground"}`}>
                  {fmtTime(secondsLeft)}
                </span>
              </div>

              {/* Pulsing waiting indicator */}
              <div className="flex items-center justify-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs text-muted-foreground">Waiting for payment…</span>
              </div>
            </motion.div>
          )}

          {status === "completed" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
              >
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground">Payment Received!</h2>
              <p className="text-sm text-muted-foreground">৳{fmt(amount)} paid successfully</p>
              {successUrl && (
                <p className="text-xs text-muted-foreground">Redirecting…</p>
              )}
            </motion.div>
          )}

          {status === "expired" && (
            <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center space-y-4">
              <XCircle className="w-14 h-14 text-destructive/60 mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Session Expired</h2>
              <p className="text-sm text-muted-foreground">This payment session has expired.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 text-center">
          <p className="text-[10px] text-muted-foreground/60">Powered by EasyPay</p>
        </div>
      </motion.div>
    </div>
  );
};

export default DynamicQrPage;
