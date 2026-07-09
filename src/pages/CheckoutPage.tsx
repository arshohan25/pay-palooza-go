import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
  Lock, BadgeCheck, ChevronLeft, Send, RotateCcw, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { playPaymentSuccess, playPaymentError } from "@/lib/sounds";
import { useI18n } from "@/lib/i18n";


/* ─── helpers ──────────────────────────────────────────────────── */
const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type SessionData = {
  id: string; amount: number; currency: string; reference: string | null;
  description: string | null; status: string; success_url: string | null;
  cancel_url: string | null; expires_at: string; merchant_id: string;
};
type Step = "loading" | "expired" | "error" | "phone" | "otp" | "pin" | "processing" | "success" | "failed";

/* ─── Circular Countdown ───────────────────────────────────────── */
const CircularCountdown = ({ secondsLeft, total }: { secondsLeft: number; total: number }) => {
  const r = 18, c = 2 * Math.PI * r;
  const progress = Math.max(0, secondsLeft / total);
  const isUrgent = secondsLeft <= 30;
  const isWarning = secondsLeft <= 60 && !isUrgent;
  const strokeColor = isUrgent
    ? "hsl(var(--destructive))"
    : isWarning
      ? "hsl(36 95% 55%)"
      : "hsl(var(--primary))";

  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <svg width="40" height="40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className={`absolute text-[9px] font-bold ${isUrgent ? "text-destructive" : isWarning ? "text-accent" : "text-primary"}`}>
        {fmtTime(secondsLeft)}
      </span>
    </div>
  );
};

/* ─── Pulsing Rings (Processing) ───────────────────────────────── */
const PulsingRings = () => (
  <div className="relative w-20 h-20 mx-auto">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-primary/30"
        animate={{ scale: [1, 2], opacity: [0.5, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
      />
    ))}
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        <Lock size={18} className="text-primary-foreground" />
      </motion.div>
    </div>
  </div>
);

/* ─── Premium OTP Input ────────────────────────────────────────── */
const OtpInput = ({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex gap-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          const isActive = i === value.length;
          const isFilled = !!char;
          return (
            <motion.div
              key={i}
              className={`
                relative w-12 h-14 rounded-2xl flex items-center justify-center text-xl font-black
                backdrop-blur-sm transition-all duration-300 overflow-hidden
                ${isFilled
                  ? "bg-primary/15 border-2 border-primary text-foreground shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)]"
                  : isActive
                    ? "bg-muted/80 border-2 border-primary/60 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.25)]"
                    : "bg-muted/50 border-2 border-border/60"
                }
              `}
              animate={isFilled ? { scale: [0.8, 1.08, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              {/* Gradient shine on filled */}
              {isFilled && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
              {char ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="relative z-10"
                >
                  {char}
                </motion.span>
              ) : isActive ? (
                <motion.div
                  className="w-0.5 h-6 bg-primary rounded-full"
                  animate={{ opacity: [1, 0.2] }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
            </motion.div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={length}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, length);
          if (v.length > value.length) haptics.light();
          onChange(v);
        }}
        className="sr-only"
        autoComplete="one-time-code"
        autoFocus
      />
    </div>
  );
};

/* ─── PIN Input (masked dots) ──────────────────────────────────── */
const PinInput = ({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex gap-4 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }).map((_, i) => {
          const isFilled = i < value.length;
          const isActive = i === value.length;
          return (
            <motion.div
              key={i}
              className={`
                w-14 h-14 rounded-2xl flex items-center justify-center
                backdrop-blur-sm transition-all duration-300
                ${isFilled
                  ? "bg-primary/15 border-2 border-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]"
                  : isActive
                    ? "bg-muted/80 border-2 border-primary/50 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.2)]"
                    : "bg-muted/50 border-2 border-border/60"
                }
              `}
              animate={isFilled ? { scale: [0.75, 1.1, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              {isFilled ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                />
              ) : isActive ? (
                <motion.div
                  className="w-0.5 h-6 bg-primary/60 rounded-full"
                  animate={{ opacity: [1, 0.2] }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                <div className="w-3 h-3 rounded-full bg-border/40" />
              )}
            </motion.div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        maxLength={length}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, length);
          if (v.length > value.length) haptics.light();
          onChange(v);
        }}
        className="sr-only"
        autoFocus
      />
    </div>
  );
};

/* ─── Merchant Avatar ──────────────────────────────────────────── */
const MerchantAvatar = ({ name }: { name: string }) => {
  const initial = (name || "M")[0].toUpperCase();
  return (
    <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-lg font-extrabold shadow-md">
      {initial}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                */
/* ═══════════════════════════════════════════════════════════════ */
const CheckoutPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [step, setStep] = useState<Step>("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(600);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [countdown, setCountdown] = useState(5);

  /* ── Load session ──────────────────────────────────────────── */
  useEffect(() => {
    if (!sessionId || !isValidUUID(sessionId)) { setStep("error"); return; }
    (async () => {
      const { data, error } = await supabase
        .from("merchant_payment_sessions")
        .select("id, amount, currency, reference, description, status, success_url, cancel_url, expires_at, merchant_id")
        .eq("id", sessionId).single();
      if (error || !data) { setStep("error"); return; }
      if (data.status === "completed") { setStep("success"); setSession(data as SessionData); return; }
      if (data.status === "failed" || data.status === "expired") { setStep("expired"); setSession(data as SessionData); return; }
      if (new Date(data.expires_at) < new Date()) { setStep("expired"); setSession(data as SessionData); return; }

      const remainingSec = Math.max(0, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      setTotalSeconds(remainingSec || 600);

      const { data: merchRows } = await supabase.rpc("get_merchant_display_name", { p_merchant_id: data.merchant_id });
      const merch = Array.isArray(merchRows) ? merchRows[0] : null;
      if (merch?.business_name) setMerchantName(merch.business_name);

      setSession(data as SessionData);
      setStep("phone");
    })();
  }, [sessionId]);

  /* ── Session countdown ─────────────────────────────────────── */
  useEffect(() => {
    if (!session?.expires_at || !["phone", "otp", "pin"].includes(step)) return;
    const expires = new Date(session.expires_at).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setStep("expired");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.expires_at, step]);

  /* ── Resend cooldown ───────────────────────────────────────── */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  /* ── Success redirect countdown ────────────────────────────── */
  useEffect(() => {
    if (step !== "success") return;
    setCountdown(5);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          if (session?.success_url) window.location.href = session.success_url;
          else navigate("/");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step, session?.success_url, navigate]);

  /* ── Send OTP ──────────────────────────────────────────────── */
  const handleSendOtp = useCallback(async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg(t("cpInvalidPhone"));
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
      if (!res.ok) throw new Error(result.error || t("cpFailedSendOtp"));

      if (result.dev_otp) setDevOtp(result.dev_otp);
      setResendCooldown(60);
      setStep("otp");
      haptics.success();
    } catch (err: any) {
      setErrorMsg(err.message || t("cpFailedSendOtp"));
      setStep("phone");
      haptics.error();
    }
  }, [phone, t]);

  /* ── Transition to PIN step on OTP complete ────────────────── */
  useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      haptics.medium();
      setErrorMsg("");
      setPin("");
      setStep("pin");
    }
  }, [otp, step]);

  /* ── Verify OTP + PIN & Pay ────────────────────────────────── */
  const handleConfirmPin = useCallback(async () => {
    if (!session || otp.length < 6 || pin.length < 4) return;
    setErrorMsg("");
    setStep("processing");
    haptics.medium();
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/checkout-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id, phone: cleanPhone, otp_code: otp, pin }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t("cpPaymentFailed"));

      setStep("success");
      fireSuccessConfetti();
      haptics.success();
      playPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || t("cpPaymentFailed"));
      setPin("");
      // If PIN wrong, go back to PIN step; otherwise show failed
      if (err.message?.toLowerCase().includes("pin")) {
        setStep("pin");
      } else {
        setStep("failed");
      }
      haptics.error();
      playPaymentError();
    }
  }, [session, otp, pin, phone, t]);

  /* ── Auto-submit PIN when 4 digits ─────────────────────────── */
  useEffect(() => {
    if (pin.length === 4 && step === "pin") {
      handleConfirmPin();
    }
  }, [pin, step, handleConfirmPin]);

  const handleCancel = () => {
    if (session?.cancel_url) window.location.href = session.cancel_url;
    else navigate("/");
  };

  /* ── Step indicator ──────────────────────────────────────────── */
  const stepIndex = step === "phone" ? 0 : step === "otp" ? 1 : step === "pin" ? 2 : -1;
  const StepDots = () =>
    stepIndex >= 0 ? (
      <div className="flex items-center justify-center gap-2 py-3">
        {["Phone", "OTP", "PIN"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${
              i < stepIndex ? "w-2 bg-primary" : i === stepIndex ? "w-6 bg-primary" : "w-2 bg-border"
            }`} />
          </div>
        ))}
      </div>
    ) : null;

  /* ── Merchant bar ──────────────────────────────────────────── */
  const MerchantBar = () => (
    <div className="flex items-center gap-3 px-6 pt-6 pb-2">
      <MerchantAvatar name={merchantName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-sm font-bold text-foreground truncate">{merchantName || t("cpMerchant")}</p>
          <BadgeCheck size={14} className="text-primary shrink-0" />
        </div>
        {session?.description && (
          <p className="text-[11px] text-muted-foreground truncate">{session.description}</p>
        )}
      </div>
      {secondsLeft !== null && ["phone", "otp", "pin"].includes(step) && (
        <CircularCountdown secondsLeft={secondsLeft} total={totalSeconds} />
      )}
    </div>
  );

  /* ── Amount hero ───────────────────────────────────────────── */
  const AmountHero = () => (
    <div className="text-center py-5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1">{t("cpAmountToPay")}</p>
      <p className="text-4xl font-black text-foreground tracking-tight">
        <span className="text-primary text-2xl mr-0.5">৳</span>
        {session ? fmt(session.amount) : "—"}
      </p>
      {session?.reference && (
        <p className="text-[10px] text-muted-foreground mt-2 font-medium">{t("cpRef")}: {session.reference}</p>
      )}
    </div>
  );

  /* ── Footer ────────────────────────────────────────────────── */
  const SecuredFooter = () => (
    <div className="px-6 pb-5 pt-2 flex items-center justify-center gap-1.5 text-muted-foreground/40">
      <Shield size={10} />
      <p className="text-[9px] font-medium tracking-wide">{t("cpSecuredBy")}</p>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*  RENDER                                                     */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/60 via-background to-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <AnimatePresence mode="wait">
          {/* LOADING */}
          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated p-10 text-center"
            >
              <PulsingRings />
              <p className="text-sm text-muted-foreground text-center mt-6 font-medium">{t("cpLoadingPayment")}</p>
            </motion.div>
          )}

          {/* EXPIRED */}
          {step === "expired" && (
            <motion.div key="expired" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated p-10 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
                <Clock size={30} className="text-accent" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">{t("cpSessionExpired")}</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-[260px] mx-auto">{t("cpRequestNewLink")}</p>
              <Button variant="outline" onClick={handleCancel} className="rounded-2xl px-8 h-11">{t("cpGoBack")}</Button>
            </motion.div>
          )}

          {/* ERROR */}
          {step === "error" && (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated p-10 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle size={30} className="text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">Invalid Session</h2>
              <p className="text-sm text-muted-foreground mb-6">This payment link is invalid or no longer available.</p>
              <Button variant="outline" onClick={() => navigate("/")} className="rounded-2xl px-8 h-11">Go Home</Button>
            </motion.div>
          )}

          {/* PHONE ENTRY */}
          {step === "phone" && session && (
            <motion.div key="phone" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated overflow-hidden"
            >
              <MerchantBar />
              <StepDots />
              <AmountHero />

              <div className="px-6 pb-4 space-y-4">
                <div className="h-px bg-border/50" />
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-2 text-center">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    maxLength={11}
                    inputMode="numeric"
                    className="w-full h-12 px-4 rounded-2xl bg-muted/50 border border-border/60 text-base font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all text-center"
                  />
                </div>

                {errorMsg && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive text-center font-medium"
                  >
                    {errorMsg}
                  </motion.p>
                )}

                <Button
                  onClick={handleSendOtp}
                  disabled={phone.replace(/\D/g, "").length < 11}
                  className="w-full h-12 rounded-2xl text-sm font-bold gradient-primary text-primary-foreground shadow-glow"
                >
                  <Send size={15} className="mr-2" />
                  Send OTP
                </Button>

                <button onClick={handleCancel} className="w-full text-center text-xs text-muted-foreground font-medium py-1 hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>

              <SecuredFooter />
            </motion.div>
          )}

          {/* OTP VERIFICATION */}
          {step === "otp" && session && (
            <motion.div key="otp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated overflow-hidden"
            >
              {/* Back + timer */}
              <div className="px-6 pt-5 pb-1 flex items-center justify-between">
                <button onClick={() => { setStep("phone"); setOtp(""); setErrorMsg(""); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft size={16} />
                  Back
                </button>
                {secondsLeft !== null && (
                  <CircularCountdown secondsLeft={secondsLeft} total={totalSeconds} />
                )}
              </div>

              <StepDots />

              {/* Compact amount pill */}
              <div className="text-center pb-4">
                <div className="inline-flex items-center gap-1.5 bg-primary/8 border border-primary/15 rounded-full px-5 py-2">
                  <span className="text-primary text-sm font-bold">৳</span>
                  <span className="text-lg font-black text-foreground">{fmt(session.amount)}</span>
                </div>
              </div>

              <div className="px-6 pb-5 space-y-4">
                <div className="text-center">
                  <h3 className="text-base font-bold text-foreground">Enter OTP</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    A 6-digit code was sent to <span className="font-semibold text-foreground">{phone}</span>
                  </p>
                </div>

                <OtpInput value={otp} onChange={setOtp} />

                {devOtp && (
                  <p className="text-[10px] text-center text-muted-foreground bg-muted/50 rounded-xl px-3 py-1.5">
                    Dev OTP: <span className="font-mono font-bold text-foreground">{devOtp}</span>
                  </p>
                )}

                {errorMsg && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive text-center font-medium"
                  >
                    {errorMsg}
                  </motion.p>
                )}

                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Resend in <span className="font-bold text-foreground">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={() => { setOtp(""); handleSendOtp(); }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <RotateCcw size={12} />
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>

              <SecuredFooter />
            </motion.div>
          )}

          {/* PIN CONFIRMATION */}
          {step === "pin" && session && (
            <motion.div key="pin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated overflow-hidden"
            >
              {/* Back + timer */}
              <div className="px-6 pt-5 pb-1 flex items-center justify-between">
                <button onClick={() => { setStep("otp"); setPin(""); setOtp(""); setErrorMsg(""); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft size={16} />
                  Back
                </button>
                {secondsLeft !== null && (
                  <CircularCountdown secondsLeft={secondsLeft} total={totalSeconds} />
                )}
              </div>

              <StepDots />

              {/* Amount pill */}
              <div className="text-center pb-4">
                <div className="inline-flex items-center gap-1.5 bg-primary/8 border border-primary/15 rounded-full px-5 py-2">
                  <span className="text-primary text-sm font-bold">৳</span>
                  <span className="text-lg font-black text-foreground">{fmt(session.amount)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  to <span className="font-semibold text-foreground">{merchantName || "Merchant"}</span>
                </p>
              </div>

              <div className="px-6 pb-5 space-y-5">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={22} className="text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Enter your PIN</h3>
                  <p className="text-xs text-muted-foreground mt-1">Confirm with your 4-digit EasyPay PIN</p>
                </div>

                <PinInput value={pin} onChange={setPin} />

                {errorMsg && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive text-center font-medium"
                  >
                    {errorMsg}
                  </motion.p>
                )}

                {/* Manual Pay button — fallback if auto-submit misses */}
                <Button
                  onClick={handleConfirmPin}
                  disabled={pin.length < 4}
                  className="w-full h-12 rounded-2xl text-sm font-bold gradient-primary text-primary-foreground shadow-glow disabled:opacity-40"
                >
                  <Lock size={15} className="mr-2" />
                  Pay ৳{fmt(session.amount)}
                </Button>
              </div>

              <SecuredFooter />
            </motion.div>
          )}

          {/* PROCESSING */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated p-10 text-center"
            >
              <PulsingRings />
              <motion.p
                className="text-sm font-semibold text-foreground text-center mt-6"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Processing payment...
              </motion.p>
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">Please don't close this page</p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated p-10 text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"
              >
                <CheckCircle2 size={44} className="text-primary" strokeWidth={2} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="text-xl font-black text-foreground mb-1"
              >
                Payment Successful!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground"
              >
                <span className="text-primary font-bold">৳{session ? fmt(session.amount) : "—"}</span>
                {" "}paid to <span className="font-semibold text-foreground">{merchantName || "Merchant"}</span>
              </motion.p>

              {session?.reference && (
                <p className="text-[10px] text-muted-foreground mt-2">Ref: {session.reference}</p>
              )}

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="mt-6 space-y-2"
              >
                <div className="flex items-center justify-center">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <span className="text-lg font-black text-primary">{countdown}</span>
                  </motion.div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Redirecting{session?.success_url ? " to merchant" : ""}...
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* FAILED */}
          {step === "failed" && (
            <motion.div key="failed" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-3xl bg-card border border-border/60 shadow-elevated p-10 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
                <XCircle size={34} className="text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">Payment Failed</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-[260px] mx-auto">{errorMsg || "Something went wrong."}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleCancel} className="rounded-2xl px-6 h-11">Cancel</Button>
                <Button onClick={() => { setStep("phone"); setOtp(""); setPin(""); setErrorMsg(""); }} className="rounded-2xl px-6 h-11 gradient-primary text-primary-foreground">Try Again</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CheckoutPage;
