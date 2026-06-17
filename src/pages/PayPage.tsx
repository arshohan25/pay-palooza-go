import Seo from "@/components/Seo";
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
import { useI18n } from "@/lib/i18n";

const NotFoundView = ({ merchantCode, onHome }: { merchantCode: string; onHome: () => void }) => {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <GradientMesh />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-card/90 backdrop-blur-2xl border border-border/20 rounded-3xl p-8 text-center space-y-4 shadow-2xl shadow-primary/5">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <XCircle className="w-7 h-7 text-destructive/70" />
        </div>
        <h2 className="text-lg font-bold text-foreground">{t("merchantNotFound")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("merchantNotFoundDescPrefix")} "<span className="font-mono font-semibold text-foreground/70">{merchantCode}</span>" {t("merchantNotFoundDescSuffix")}
        </p>
        <Button variant="outline" onClick={onHome} className="rounded-2xl mt-2 h-11 px-6">{t("goHome")}</Button>
      </motion.div>
    </div>
  );
};

const fmt = (n: number, locale = "en-BD") => new Intl.NumberFormat(locale).format(n);

type Step = "loading" | "ready" | "phone" | "otp" | "pin" | "processing" | "success" | "error" | "not_found";

const formatDateTime = (d: Date, locale = "en-BD") => {
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
};

interface MerchantInfo {
  id: string;
  business_name: string;
  category: string;
  phone: string;
  user_id: string;
}

const STEP_INDEX: Record<string, number> = { phone: 0, otp: 1, pin: 2 };

/* ─── Segmented Step Bar ────────────────────────────────────── */
const StepBar = ({ current }: { current: string }) => {
  const { t } = useI18n();
  const idx = STEP_INDEX[current] ?? -1;
  const labels = [t("ppStepPhone"), t("ppStepVerify"), t("ppStepPin")];
  return (
    <div className="mb-6 px-2">
      <div className="flex items-center gap-1">
        {labels.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full h-1 rounded-full overflow-hidden bg-muted/60">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: i <= idx ? "100%" : "0%" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className={`text-[9px] font-semibold tracking-wide transition-colors duration-300 ${
              i <= idx ? "text-primary" : "text-muted-foreground/40"
            }`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── PIN Input ──────────────────────────────────────────────── */
const PinInput = ({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-3.5 cursor-text" onClick={() => inputRef.current?.focus()}>
        {Array.from({ length }).map((_, i) => {
          const isFilled = i < value.length;
          const isActive = i === value.length;
          return (
            <motion.div
              key={i}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                ${isFilled ? "bg-primary/10 border border-primary/40 shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]"
                  : isActive ? "bg-background/80 border border-primary/30" : "bg-muted/40 border border-border/30"}`}
              animate={isFilled ? { scale: [0.8, 1.05, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              {isFilled ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="w-3 h-3 rounded-full bg-primary" />
              ) : isActive ? (
                <motion.div className="w-0.5 h-5 bg-primary/50 rounded-full" animate={{ opacity: [1, 0.2] }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }} />
              ) : <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />}
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

/* ─── OTP Input (Underline Style) ────────────────────────────── */
const OtpInput = ({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2.5 cursor-text" onClick={() => inputRef.current?.focus()}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          const isActive = i === value.length;
          const isFilled = !!char;
          return (
            <motion.div key={i}
              className={`w-10 h-12 flex flex-col items-center justify-end pb-1 transition-all duration-300`}
              animate={isFilled ? { scale: [0.85, 1.05, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              <span className={`text-xl font-bold mb-1 ${isFilled ? "text-foreground" : "text-transparent"}`}>
                {char || "0"}
              </span>
              <div className={`w-full h-[2px] rounded-full transition-all duration-300 ${
                isFilled ? "bg-primary shadow-[0_1px_8px_hsl(var(--primary)/0.4)]"
                  : isActive ? "bg-primary/60" : "bg-border/50"
              }`} />
              {isActive && (
                <motion.div
                  className="absolute w-0.5 h-5 bg-primary/60 rounded-full -mt-7"
                  animate={{ opacity: [1, 0.2] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                />
              )}
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
}: { open: boolean; onClose: () => void; qrDataUrl: string | null; merchantName: string; amount: number }) => {
  const { t } = useI18n();
  return (
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
          className="w-full max-w-sm bg-card/90 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-primary/5"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-primary/10 via-card to-accent/5 px-6 pt-6 pb-4 text-center relative">
            <button onClick={onClose} className="absolute right-4 top-4 w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform">
              <X size={13} className="text-muted-foreground" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-3 ring-2 ring-primary/10">
              <Store className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{t("ppScanToPay")}</h3>
            {merchantName && <p className="text-xs text-muted-foreground mt-0.5">{merchantName}</p>}
            {amount > 0 && (
              <p className="text-3xl font-extrabold text-foreground mt-1">
                ৳{fmt(amount)} <span className="text-sm font-medium text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">BDT</span>
              </p>
            )}
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-white rounded-2xl p-4 mx-auto w-fit shadow-lg">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={t("ppPaymentQrAlt")} className="w-64 h-64" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full" />
                </div>
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {t("ppOpenAppScan")}
            </p>
          </div>

          <div className="px-6 pb-5 pt-2 text-center border-t border-border/20">
            <p className="text-[10px] text-muted-foreground/60">{t("poweredByEasyPay")}</p>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
};

/* ─── Gradient Mesh Background ───────────────────────────────── */
const GradientMesh = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <div className="absolute inset-0 bg-background" />
    <div className="absolute top-[-20%] right-[-15%] w-[500px] h-[500px] rounded-full bg-primary/[0.04] blur-[100px]" />
    <div className="absolute bottom-[-10%] left-[-15%] w-[400px] h-[400px] rounded-full bg-accent/[0.06] blur-[100px]" />
    <div className="absolute inset-0 opacity-[0.015]" style={{
      backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
      backgroundSize: "32px 32px",
    }} />
  </div>
);

/* ════════════════════════════════════════════════════════════════ */
/*                         PAY PAGE                               */
/* ════════════════════════════════════════════════════════════════ */

const PayPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-BD";

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
          setErrorMsg(t("ppCouldNotConnect"));
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
        setErrorMsg(t("ppSomethingWrong"));
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
      setErrorMsg(t("ppValidNumber"));
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
      if (!res.ok) throw new Error(result.error || t("ppFailedSendOtp"));
      if (result.dev_otp) setDevOtp(result.dev_otp);
      setStep("otp");
      haptics.success();
    } catch (err: any) {
      setErrorMsg(err.message || t("ppFailedSendOtp"));
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
      const safeReference = refParam.trim().toUpperCase();
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
          description: description || `${t("ppPaymentTo")} ${merchant.business_name}`,
          reference: safeReference || null,
          merchant_id: merchant.id || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t("ppPaymentFailedMsg"));
      setSuccessTxnId(result.txn_id || `TXN${Date.now().toString(36).toUpperCase()}`);
      setSuccessTime(new Date());
      setStep("success");
      fireSuccessConfetti();
      haptics.success();
      playPaymentSuccess();
      import("@/lib/activityTracker").then(({ activityTracker }) =>
        activityTracker.transaction("send_money_success", { amount: amountParam, txn_id: result.txn_id })
      );
    } catch (err: any) {
      setErrorMsg(err.message || t("ppPaymentFailedMsg"));
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
        <GradientMesh />
        <motion.div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <motion.div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <motion.div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
              animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
          </div>
          <p className="text-xs text-muted-foreground font-medium tracking-wide">{t("loadingPayment")}</p>
        </motion.div>
      </div>
    );
  }

  /* ─── Not Found ─── */
  if (step === "not_found") {
    return <NotFoundView merchantCode={merchantCode} onHome={() => navigate("/")} />;
  }

  const showStepBar = ["phone", "otp", "pin"].includes(step);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Seo
        title="Pay Merchants – QR & Wallet Payments | EasyPay"
        description="Pay any EasyPay merchant instantly by scanning a QR code, entering a wallet ID or selecting a contact. Secure, instant, no fees on most payments."
        path="/pay"
      />
      <GradientMesh />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-card/90 backdrop-blur-2xl border border-border/20 dark:border-white/[0.06] rounded-3xl shadow-2xl shadow-primary/5 overflow-hidden"
      >
        {/* ─── Merchant Header ─── */}
        <div className="relative px-6 pt-7 pb-5 text-center">
          {/* Top gradient accent line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {/* Merchant avatar with gradient ring */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
            className="relative w-16 h-16 mx-auto mb-3"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 rotate-3" />
            <div className="absolute inset-[2px] rounded-[14px] bg-card flex items-center justify-center">
              <Store className="w-7 h-7 text-primary" />
            </div>
          </motion.div>

          {merchant && (
            <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-base font-bold text-foreground tracking-tight">
              {merchant.business_name}
            </motion.h1>
          )}
          {merchant?.category && (
            <p className="text-[10px] text-muted-foreground/60 capitalize mt-0.5 tracking-widest uppercase font-medium">
              {merchant.category.replace(/_/g, " ")}
            </p>
          )}

          {amountParam > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
              className="mt-4 inline-flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">৳{fmt(amountParam)}</span>
              <span className="text-[10px] font-semibold text-muted-foreground/50 bg-muted/50 px-1.5 py-0.5 rounded-full">BDT</span>
            </motion.div>
          )}

          {(refParam || noteParam) && (
            <div className="mt-2 flex flex-col items-center gap-0.5">
              {refParam && <p className="text-[10px] text-muted-foreground/50 font-mono">Ref: {refParam}</p>}
              {noteParam && <p className="text-[10px] text-muted-foreground/50 font-mono">Note: {noteParam}</p>}
            </div>
          )}

          {/* Thin divider */}
          <div className="mt-5 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        </div>

        <AnimatePresence mode="wait">
          {/* ─── Ready ─── */}
          {step === "ready" && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-6 pb-6 space-y-3 text-center">
              <Button
                onClick={() => { setStep("phone"); setPhone(""); setOtp(""); setPin(""); setErrorMsg(""); }}
                className="w-full rounded-2xl h-12 text-sm font-bold shadow-lg shadow-primary/20 active:scale-[0.97] transition-transform"
              >
                <Shield size={16} className="mr-2" />
                Pay with Phone & PIN
              </Button>

              <button
                onClick={() => setShowQr(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-muted-foreground hover:text-primary active:scale-[0.97] transition-all"
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
              <StepBar current="phone" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Enter your phone number</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">We'll send a verification code</p>
              </div>
              <div>
                <input type="tel" inputMode="numeric" maxLength={11} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-6 py-3.5 rounded-full bg-muted/30 border border-border/30 text-foreground text-center text-lg font-semibold tracking-widest placeholder:text-center placeholder:text-muted-foreground/40 placeholder:font-medium placeholder:text-base placeholder:tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/20 shadow-inner transition-all"
                  autoFocus />
              </div>
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <Button onClick={handleSendOtp} disabled={phone.length < 11} className="w-full rounded-2xl h-11 font-bold active:scale-[0.97] transition-transform">
                Send OTP
              </Button>
              <button onClick={() => { setStep("ready"); setErrorMsg(""); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground py-1 active:scale-[0.97] transition-all">
                <ArrowLeft size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* ─── OTP ─── */}
          {step === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="px-6 pb-6 space-y-5 text-center">
              <StepBar current="otp" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Enter verification code</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Sent to {phone}</p>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              {devOtp && <p className="text-[10px] text-center text-muted-foreground/40 font-mono">Dev OTP: {devOtp}</p>}
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <button onClick={() => { setStep("phone"); setOtp(""); setErrorMsg(""); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground py-1 active:scale-[0.97] transition-all">
                <ArrowLeft size={12} /> Change number
              </button>
            </motion.div>
          )}

          {/* ─── PIN ─── */}
          {step === "pin" && (
            <motion.div key="pin" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="px-6 pb-6 space-y-5 text-center">
              <StepBar current="pin" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-4.5 h-4.5 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">Enter your PIN</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">4-digit security PIN</p>
              </div>
              <PinInput value={pin} onChange={setPin} />
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <button onClick={() => { setStep("otp"); setPin(""); setErrorMsg(""); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground py-1 active:scale-[0.97] transition-all">
                <ArrowLeft size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* ─── Processing ─── */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-6 pb-8 pt-2 flex flex-col items-center gap-5">
              <div className="relative w-16 h-16">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/15"
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock size={16} className="text-primary/70" />
                </div>
              </div>
              <p className="text-xs font-semibold text-muted-foreground/60 tracking-wide">Processing payment…</p>
            </motion.div>
          )}

          {/* ─── Success ─── */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="px-5 pb-6 pt-2 text-center space-y-4">
              {/* Gradient checkmark circle */}
              <div className="relative w-18 h-18 mx-auto" style={{ width: 72, height: 72 }}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5" />
                <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.15 }}>
                    <CheckCircle2 className="w-9 h-9 text-primary" />
                  </motion.div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-foreground">Payment Successful!</h2>
                <p className="text-xs text-muted-foreground/60 mt-1">৳{fmt(amountParam)} paid to {merchant?.business_name}</p>
              </div>

              {/* Receipt Card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-border/30 bg-muted/20 text-left overflow-hidden"
              >
                <div className="divide-y divide-border/30">
                  {[
                    { label: "Amount", value: `৳${fmt(amountParam)}`, bold: true },
                    { label: "Merchant", value: merchant?.business_name || "" },
                    ...(refParam ? [{ label: "Reference", value: refParam }] : []),
                    ...(description ? [{ label: "Note", value: description }] : []),
                    { label: "Date", value: successTime ? formatDateTime(successTime) : "—" },
                    { label: "Fee", value: "Free", accent: true },
                  ].map((row, i) => (
                    <div key={row.label} className={`flex justify-between items-center px-4 py-2.5 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <span className="text-[11px] text-muted-foreground/60">{row.label}</span>
                      <span className={`text-xs font-semibold truncate max-w-[55%] text-right ${
                        (row as any).accent ? "text-primary" : (row as any).bold ? "text-sm font-bold text-foreground" : "text-foreground"
                      }`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {/* Transaction ID chip */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-semibold">Transaction ID</p>
                    <p className="text-[11px] font-mono font-bold text-primary break-all mt-0.5 leading-snug">{successTxnId || "—"}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(successTxnId || ""); } catch {}
                      haptics.light();
                      setCopiedTxn(true);
                      setTimeout(() => setCopiedTxn(false), 2000);
                    }}
                    className="ml-2 shrink-0 w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedTxn ? <CheckCircle2 size={12} className="text-primary" /> : <Copy size={12} />}
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
              <div className="w-14 h-14 rounded-full bg-destructive/8 border border-destructive/15 flex items-center justify-center mx-auto shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.2)]">
                <XCircle className="w-7 h-7 text-destructive/70" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Payment Failed</h2>
              <p className="text-sm text-muted-foreground/60 leading-relaxed">{errorMsg || "Something went wrong"}</p>
              <Button variant="outline"
                onClick={() => { setStep("ready"); setPin(""); setOtp(""); setErrorMsg(""); }}
                className="rounded-2xl h-11 px-6 font-semibold">
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Footer ─── */}
        <div className="px-6 pb-5 pt-1">
          <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent mb-3" />
          <div className="flex items-center justify-center gap-1.5">
            <Shield size={10} className="text-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground/30 font-medium tracking-wide">Secured by EasyPay</p>
          </div>
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
