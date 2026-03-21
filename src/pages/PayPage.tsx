import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Store, CheckCircle2, XCircle, QrCode, Shield, Lock, X, ArrowLeft, Copy, ExternalLink, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { playPaymentSuccess, playPaymentError } from "@/lib/sounds";
import QRCode from "qrcode";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

type Step = "loading" | "ready" | "phone" | "otp" | "pin" | "processing" | "success" | "error" | "not_found";

const formatDateTime = (d: Date) => {
  return d.toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" });
};

interface MerchantInfo {
  id: string;
  business_name: string;
  category: string;
  phone: string;
  user_id: string;
}

const STEP_INDEX: Record<string, number> = { phone: 0, otp: 1, pin: 2 };

/* ─── Step Progress Dots ────────────────────────────────────── */
const StepDots = ({ current }: { current: string }) => {
  const idx = STEP_INDEX[current] ?? -1;
  const labels = ["Phone", "OTP", "PIN"];
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <motion.div
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                i < idx ? "bg-primary" : i === idx ? "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)]" : "bg-muted-foreground/20"
              }`}
              animate={i === idx ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className={`text-[9px] font-medium ${i <= idx ? "text-primary" : "text-muted-foreground/40"}`}>{label}</span>
          </div>
          {i < 2 && <div className={`w-8 h-px mb-3 ${i < idx ? "bg-primary/60" : "bg-muted-foreground/15"}`} />}
        </div>
      ))}
    </div>
  );
};

/* ─── PIN Input ──────────────────────────────────────────────── */
const PinInput = ({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 cursor-text" onClick={() => inputRef.current?.focus()}>
        {Array.from({ length }).map((_, i) => {
          const isFilled = i < value.length;
          const isActive = i === value.length;
          return (
            <motion.div
              key={i}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-all duration-300
                ${isFilled ? "bg-primary/15 border-2 border-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]"
                  : isActive ? "bg-background/60 border-2 border-primary/50" : "bg-background/30 border-2 border-border/40"}`}
              animate={isFilled ? { scale: [0.75, 1.1, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              {isFilled ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
              ) : isActive ? (
                <motion.div className="w-0.5 h-6 bg-primary/60 rounded-full" animate={{ opacity: [1, 0.2] }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }} />
              ) : <div className="w-3 h-3 rounded-full bg-border/30" />}
            </motion.div>
          );
        })}
      </div>
      <input ref={inputRef} type="password" inputMode="numeric" maxLength={length} value={value}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, length); if (v.length > value.length) haptics.light(); onChange(v); }}
        className="sr-only" autoFocus />
    </div>
  );
};

/* ─── OTP Input ──────────────────────────────────────────────── */
const OtpInput = ({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 cursor-text" onClick={() => inputRef.current?.focus()}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          const isActive = i === value.length;
          const isFilled = !!char;
          return (
            <motion.div key={i}
              className={`w-12 h-14 rounded-2xl flex items-center justify-center text-xl font-black backdrop-blur-sm transition-all duration-300
                ${isFilled ? "bg-primary/15 border-2 border-primary text-foreground" : isActive ? "bg-background/60 border-2 border-primary/60" : "bg-background/30 border-2 border-border/40"}`}
              animate={isFilled ? { scale: [0.8, 1.08, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              {char ? <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>{char}</motion.span>
                : isActive ? <motion.div className="w-0.5 h-6 bg-primary rounded-full" animate={{ opacity: [1, 0.2] }} transition={{ duration: 0.7, repeat: Infinity }} />
                : null}
            </motion.div>
          );
        })}
      </div>
      <input ref={inputRef} type="text" inputMode="numeric" maxLength={length} value={value}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, length); if (v.length > value.length) haptics.light(); onChange(v); }}
        className="sr-only" autoComplete="one-time-code" autoFocus />
    </div>
  );
};

/* ─── QR Modal ───────────────────────────────────────────────── */
const QrModal = ({
  open, onClose, qrDataUrl, merchantName, amount,
}: { open: boolean; onClose: () => void; qrDataUrl: string | null; merchantName: string; amount: number }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl p-6 space-y-5 shadow-2xl text-center"
        >
          <div className="relative flex items-center justify-center">
            <h3 className="text-sm font-bold text-foreground">Scan to Pay</h3>
            <button onClick={onClose} className="absolute right-0 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center active:scale-95 transition-transform">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Payment QR" className="w-52 h-52" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full" />
                </div>
              )}
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-foreground">{merchantName}</p>
              {amount > 0 && <p className="text-lg font-extrabold text-primary">৳{fmt(amount)}</p>}
              <p className="text-[10px] text-muted-foreground">Open <span className="font-semibold">EasyPay</span> app → Scan QR</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ─── Floating Orbs Background ───────────────────────────────── */
const FloatingOrbs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <motion.div
      className="absolute w-72 h-72 rounded-full bg-primary/[0.04] blur-3xl"
      animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      style={{ top: "-10%", right: "-15%" }}
    />
    <motion.div
      className="absolute w-56 h-56 rounded-full bg-accent/[0.06] blur-3xl"
      animate={{ x: [0, -30, 15, 0], y: [0, 25, -15, 0] }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      style={{ bottom: "5%", left: "-10%" }}
    />
  </div>
);

/* ════════════════════════════════════════════════════════════════ */
/*                         PAY PAGE                               */
/* ════════════════════════════════════════════════════════════════ */

const PayPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const merchantCode = params.get("merchant") || "";
  const refParam = params.get("ref") || "";
  const noteParam = params.get("note") || "";
  const amountParam = parseFloat(params.get("amount") || "0");
  const description = [refParam, noteParam].filter(Boolean).join(" — ");
  const redirectParam = params.get("redirect") || "";

  const [step, setStep] = useState<Step>("loading");
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [successTxnId, setSuccessTxnId] = useState<string | null>(null);
  const [successTime, setSuccessTime] = useState<Date | null>(null);
  const [copiedTxn, setCopiedTxn] = useState(false);

  // Resolve merchant
  useEffect(() => {
    if (!merchantCode) { setStep("not_found"); return; }
    (async () => {
      try {
        const { data, error } = await supabase.rpc("resolve_payment_merchant", {
          p_identifier: merchantCode,
        });
        if (error) {
          console.error("resolve_payment_merchant RPC error:", error);
          setErrorMsg("Could not connect to payment service. Please try again.");
          setStep("error");
          return;
        }
        const result = typeof data === "string" ? JSON.parse(data) : data;
        if (!result?.found || !result?.recipient_phone) { setStep("not_found"); return; }

        setMerchant({
          id: result.merchant_id || "",
          business_name: result.recipient_name || merchantCode,
          category: result.category || "",
          phone: result.recipient_phone,
          user_id: "",
        });
        setStep("ready");
      } catch (e) {
        console.error("resolve_payment_merchant exception:", e);
        setErrorMsg("Something went wrong. Please try again.");
        setStep("error");
      }
    })();
  }, [merchantCode]);

  // Generate QR when modal opens
  useEffect(() => {
    if (!merchant || !showQr) return;
    const url = `${window.location.origin}/pay?merchant=${merchantCode}&amount=${amountParam}${refParam ? `&ref=${refParam}` : ""}${noteParam ? `&note=${noteParam}` : ""}`;
    const payload = JSON.stringify({
      type: "easypay_pay",
      merchant: merchantCode,
      amount: amountParam,
      ref: refParam || null,
      note: noteParam || null,
      url,
    });
    QRCode.toDataURL(payload, { width: 280, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQrDataUrl);
  }, [merchant, showQr, merchantCode, amountParam, refParam, noteParam]);

  // Guest Pay: Send OTP
  const handleSendOtp = useCallback(async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg("Enter a valid 11-digit number");
      haptics.error();
      return;
    }
    setErrorMsg("");
    setStep("processing");
    haptics.medium();
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, purpose: "payment" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send OTP");
      if (result.dev_otp) setDevOtp(result.dev_otp);
      setStep("otp");
      haptics.success();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send OTP");
      setStep("phone");
      haptics.error();
    }
  }, [phone]);

  // Auto-advance OTP → PIN
  useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      haptics.medium();
      setErrorMsg("");
      setPin("");
      setStep("pin");
    }
  }, [otp, step]);

  // Auto-submit PIN
  useEffect(() => {
    if (pin.length === 4 && step === "pin") handleGuestPay();
  }, [pin, step]);

  // Guest Pay: Verify OTP + PIN
  const handleGuestPay = useCallback(async () => {
    if (otp.length < 6 || pin.length < 4 || !merchant) return;
    setErrorMsg("");
    setStep("processing");
    haptics.medium();
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/checkout-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          otp_code: otp,
          pin,
          recipient_phone: merchant.phone,
          amount: amountParam,
          description: description || `Payment to ${merchant.business_name}`,
          reference: refParam || null,
          merchant_id: merchant.id || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Payment failed");
      setSuccessTxnId(result.txn_id || `TXN${Date.now().toString(36).toUpperCase()}`);
      setSuccessTime(new Date());
      setStep("success");
      fireSuccessConfetti();
      haptics.success();
      playPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Payment failed");
      setPin("");
      if (err.message?.toLowerCase().includes("pin")) setStep("pin");
      else { setStep("error"); }
      haptics.error();
      playPaymentError();
    }
  }, [otp, pin, phone, merchant, amountParam, description, refParam]);

  /* ─── Loading ─── */
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FloatingOrbs />
        <motion.div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <motion.div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <motion.div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
              animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Loading payment…</p>
        </motion.div>
      </div>
    );
  }

  /* ─── Not Found ─── */
  if (step === "not_found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <FloatingOrbs />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm bg-card/90 backdrop-blur-xl border border-border/40 rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-destructive/70" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Merchant Not Found</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The merchant code "<span className="font-mono font-semibold text-foreground/70">{merchantCode}</span>" could not be resolved.
          </p>
          <Button variant="outline" onClick={() => navigate("/")} className="rounded-2xl mt-2 h-11 px-6">Go Home</Button>
        </motion.div>
      </div>
    );
  }

  const showStepDots = ["phone", "otp", "pin"].includes(step);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <FloatingOrbs />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-card/90 backdrop-blur-xl border border-border/40 rounded-3xl shadow-xl overflow-hidden"
      >
        {/* ─── Merchant Header ─── */}
        <div className="relative px-6 pt-7 pb-6 text-center">
          {/* Subtle top glow */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.06] to-transparent rounded-t-3xl" />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
            className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3"
          >
            <Store className="w-7 h-7 text-primary" />
          </motion.div>

          {merchant && (
            <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-lg font-bold text-foreground">
              {merchant.business_name}
            </motion.h1>
          )}
          {merchant?.category && (
            <p className="text-[11px] text-muted-foreground capitalize mt-0.5 tracking-wide">
              {merchant.category.replace(/_/g, " ")}
            </p>
          )}
          {amountParam > 0 && (
            <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
              className="text-3xl font-extrabold text-foreground mt-3 tracking-tight">
              ৳{fmt(amountParam)}
              <span className="text-xs font-medium text-muted-foreground ml-1.5">BDT</span>
            </motion.p>
          )}
          {refParam && <p className="text-[10px] text-muted-foreground mt-1.5 font-mono text-center">Ref: {refParam}</p>}
          {noteParam && <p className="text-[10px] text-muted-foreground font-mono text-center">Note: {noteParam}</p>}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── Ready ─── */}
          {step === "ready" && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-6 pb-6 space-y-3 text-center">
              <Button
                onClick={() => { setStep("phone"); setPhone(""); setOtp(""); setPin(""); setErrorMsg(""); }}
                className="w-full rounded-2xl h-13 text-sm font-bold shadow-lg shadow-primary/20 active:scale-[0.97] transition-transform"
              >
                <Shield size={18} className="mr-2" />
                Pay with Phone & PIN
              </Button>

              <button
                onClick={() => setShowQr(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-primary hover:text-primary/80 active:scale-[0.97] transition-all"
              >
                <QrCode size={14} />
                Show QR Code
              </button>
            </motion.div>
          )}

          {/* ─── Phone ─── */}
          {step === "phone" && (
            <motion.div key="phone" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="px-6 pb-6 space-y-4 text-center">
              <StepDots current="phone" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Enter your phone number</p>
                <p className="text-[11px] text-muted-foreground mt-1">We'll send a verification code</p>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">+880</span>
                <input type="tel" inputMode="numeric" maxLength={11} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  className="w-full pl-16 pr-4 py-3.5 rounded-2xl bg-background/50 border border-border/40 text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 backdrop-blur-sm transition-shadow"
                  autoFocus />
              </div>
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <Button onClick={handleSendOtp} disabled={phone.length < 11} className="w-full rounded-2xl h-12 font-bold active:scale-[0.97] transition-transform">
                Send OTP
              </Button>
              <button onClick={() => { setStep("ready"); setErrorMsg(""); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 active:scale-[0.97] transition-all">
                <ArrowLeft size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* ─── OTP ─── */}
          {step === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="px-6 pb-6 space-y-5 text-center">
              <StepDots current="otp" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Enter verification code</p>
                <p className="text-[11px] text-muted-foreground mt-1">Sent to +880{phone}</p>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              {devOtp && <p className="text-[10px] text-center text-muted-foreground/50 font-mono">Dev OTP: {devOtp}</p>}
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <button onClick={() => { setStep("phone"); setOtp(""); setErrorMsg(""); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 active:scale-[0.97] transition-all">
                <ArrowLeft size={12} /> Change number
              </button>
            </motion.div>
          )}

          {/* ─── PIN ─── */}
          {step === "pin" && (
            <motion.div key="pin" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="px-6 pb-6 space-y-5 text-center">
              <StepDots current="pin" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">Enter your PIN</p>
                <p className="text-[11px] text-muted-foreground mt-1">4-digit security PIN</p>
              </div>
              <PinInput value={pin} onChange={setPin} />
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <button onClick={() => { setStep("otp"); setPin(""); setErrorMsg(""); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 active:scale-[0.97] transition-all">
                <ArrowLeft size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* ─── Processing ─── */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-6 pb-8 pt-2 flex flex-col items-center gap-5">
              <div className="relative w-20 h-20">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="absolute inset-0 rounded-full border-2 border-primary/25"
                    animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45, ease: "easeOut" }} />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div className="w-10 h-10 rounded-full bg-primary/15 backdrop-blur-sm flex items-center justify-center"
                    animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <Lock size={16} className="text-primary" />
                  </motion.div>
                </div>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Processing payment…</p>
            </motion.div>
          )}

          {/* ─── Success ─── */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="px-5 pb-6 pt-2 text-center space-y-4">
              {/* Animated check icon */}
              <div className="relative w-20 h-20 mx-auto">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: "conic-gradient(from 0deg, hsl(var(--primary)/0.4), hsl(var(--primary)/0.1), hsl(var(--primary)/0.4))" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.15 }}>
                    <CheckCircle2 className="w-10 h-10 text-primary" />
                  </motion.div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
                <p className="text-sm text-muted-foreground mt-1">৳{fmt(amountParam)} paid to {merchant?.business_name}</p>
              </div>

              {/* Receipt Card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-border bg-muted/30 text-left overflow-hidden"
              >
                <div className="divide-y divide-border/60">
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Amount</span>
                    <span className="text-sm font-bold text-foreground">৳{fmt(amountParam)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Merchant</span>
                    <span className="text-xs font-semibold text-foreground truncate max-w-[55%] text-right">{merchant?.business_name}</span>
                  </div>
                  {refParam && (
                    <div className="flex justify-between items-center px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">Reference</span>
                      <span className="text-xs font-semibold text-foreground truncate max-w-[55%] text-right">{refParam}</span>
                    </div>
                  )}
                  {description && (
                    <div className="flex justify-between items-center px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">Note</span>
                      <span className="text-xs font-semibold text-foreground truncate max-w-[55%] text-right">{description}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Date</span>
                    <span className="text-xs font-semibold text-foreground">{successTime ? formatDateTime(successTime) : "—"}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Fee</span>
                    <span className="text-xs font-semibold text-primary">Free</span>
                  </div>
                </div>
                {/* Transaction ID footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-muted/40">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Transaction ID</p>
                    <p className="text-xs font-mono font-bold text-primary break-all mt-0.5 leading-snug">{successTxnId || "—"}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(successTxnId || ""); } catch {}
                      haptics.light();
                      setCopiedTxn(true);
                      setTimeout(() => setCopiedTxn(false), 2000);
                    }}
                    className="ml-2 shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedTxn ? <CheckCircle2 size={13} className="text-primary" /> : <Copy size={13} />}
                  </motion.button>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.35 }}
                className="flex flex-col gap-2 pt-1"
              >
                {redirectParam && (
                  <Button
                    onClick={() => { window.location.href = redirectParam; }}
                    className="rounded-2xl h-11 font-semibold gap-2 w-full"
                  >
                    <ExternalLink size={15} /> Return to Merchant
                  </Button>
                )}
                <Button
                  variant={redirectParam ? "outline" : "default"}
                  onClick={() => navigate("/")}
                  className="rounded-2xl h-11 font-semibold gap-2 w-full"
                >
                  <Home size={15} /> Go Home
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── Error ─── */}
          {step === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-6 pb-8 pt-2 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-destructive/70" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Payment Failed</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{errorMsg || "Something went wrong"}</p>
              <Button variant="outline"
                onClick={() => { setStep("ready"); setPin(""); setOtp(""); setErrorMsg(""); }}
                className="rounded-2xl h-11 px-6 font-semibold">
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Footer ─── */}
        <div className="px-6 pb-5 pt-1 flex items-center justify-center gap-1.5">
          <Lock size={10} className="text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/40 font-medium">Secured by EasyPay</p>
        </div>
      </motion.div>

      {/* ─── QR Modal ─── */}
      <QrModal
        open={showQr}
        onClose={() => setShowQr(false)}
        qrDataUrl={qrDataUrl}
        merchantName={merchant?.business_name || ""}
        amount={amountParam}
      />
    </div>
  );
};

export default PayPage;
