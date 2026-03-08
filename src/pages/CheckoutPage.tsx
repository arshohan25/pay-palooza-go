import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signIn } from "@/lib/auth";
import { motion, AnimatePresence, animate as fmAnimate } from "framer-motion";
import {
  Store, Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
  ArrowLeft, Lock, BadgeCheck, ChevronLeft, Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SlideToConfirm from "@/components/SlideToConfirm";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";

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
type Step = "loading" | "expired" | "error" | "login" | "confirm" | "processing" | "success" | "failed";

/* ─── Circular Countdown ───────────────────────────────────────── */
const CircularCountdown = ({ secondsLeft, total }: { secondsLeft: number; total: number }) => {
  const r = 20, c = 2 * Math.PI * r;
  const progress = Math.max(0, secondsLeft / total);
  const isUrgent = secondsLeft <= 30;
  const isWarning = secondsLeft <= 60 && !isUrgent;
  const strokeColor = isUrgent
    ? "hsl(var(--destructive))"
    : isWarning
      ? "hsl(36 95% 55%)"
      : "hsl(var(--primary))";

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={strokeColor} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className={`absolute text-[10px] font-bold ${isUrgent ? "text-destructive" : isWarning ? "text-accent" : "text-primary"}`}>
        {fmtTime(secondsLeft)}
      </span>
    </div>
  );
};

/* ─── Animated PIN Dots ────────────────────────────────────────── */
const PinDots = ({ value, onChange, maxLen = 4 }: { value: string; onChange: (v: string) => void; maxLen?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex gap-4 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length: maxLen }).map((_, i) => {
          const filled = i < value.length;
          return (
            <motion.div
              key={i}
              className={`w-4 h-4 rounded-full border-2 ${
                filled
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40 bg-transparent"
              }`}
              animate={filled ? { scale: [0.5, 1.3, 1] } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            />
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        maxLength={maxLen}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, maxLen);
          onChange(v);
          if (v.length === maxLen) haptics.light();
        }}
        className="sr-only"
        autoComplete="off"
      />
    </div>
  );
};

/* ─── Pulsing Rings (Processing) ───────────────────────────────── */
const PulsingRings = () => (
  <div className="relative w-24 h-24 mx-auto">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-primary/40"
        animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
      />
    ))}
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        <Lock size={20} className="text-primary-foreground" />
      </motion.div>
    </div>
  </div>
);

/* ─── Merchant Avatar ──────────────────────────────────────────── */
const MerchantAvatar = ({ name }: { name: string }) => {
  const initial = (name || "M")[0].toUpperCase();
  return (
    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-xl font-extrabold shadow-lg">
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

  const [step, setStep] = useState<Step>("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [merchantPhone, setMerchantPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(600);

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

      const { data: merch } = await supabase.from("merchants").select("business_name, user_id").eq("id", data.merchant_id).single();
      if (merch) {
        setMerchantName(merch.business_name);
        const { data: profile } = await supabase.from("profiles").select("phone").eq("user_id", merch.user_id).single();
        if (profile) setMerchantPhone(profile.phone);
      }
      setSession(data as SessionData);
      setStep("login");
    })();
  }, [sessionId]);

  /* ── Countdown ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!session?.expires_at || (step !== "login" && step !== "confirm")) return;
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

  /* ── Auth ───────────────────────────────────────────────────── */
  const handleLogin = useCallback(async () => {
    if (phone.length < 11 || pin.length < 4) { setErrorMsg("Enter valid phone and 4-digit PIN"); return; }
    setErrorMsg(""); setStep("processing");
    try {
      const cleanPhone = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
      await signIn(cleanPhone, pin);
      setStep("confirm");
    } catch { setErrorMsg("Invalid phone or PIN"); setStep("login"); }
  }, [phone, pin]);

  /* ── Pay ────────────────────────────────────────────────────── */
  const handlePay = useCallback(async () => {
    if (!session || !merchantPhone) return;
    setStep("processing");
    try {
      const { data, error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: merchantPhone, p_amount: session.amount, p_fee: 0,
        p_type: "payment" as any,
        p_description: session.description || `Payment to ${merchantName}`,
        p_reference: session.reference || session.id,
        p_recipient_name: merchantName, p_recipient_type: "payment" as any,
      });
      if (error) throw error;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/merchant-payment-webhook`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      }).catch(() => {});

      await supabase.from("merchant_payment_sessions").update({
        status: "completed",
        payer_user_id: (await supabase.auth.getUser()).data.user?.id,
        customer_phone: phone.replace(/\D/g, "").replace(/^(\+?88)/, ""),
        completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", session.id);

      setStep("success");
      fireSuccessConfetti();
      haptics.success();

      if (session.success_url) {
        setTimeout(() => { window.location.href = session.success_url!; }, 3500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Payment failed"); setStep("failed");
      await supabase.from("merchant_payment_sessions").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", session?.id || "");
    }
  }, [session, merchantPhone, merchantName, phone]);

  const handleCancel = () => {
    if (session?.cancel_url) window.location.href = session.cancel_url;
    else navigate("/");
  };

  /* ═══════════════════════════════════════════════════════════ */
  /*  RENDER                                                     */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Branded Header ────────────────────────────────────── */}
      <div className="gradient-primary px-5 pt-6 pb-8 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-8 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icons/easypay-logo.png"
              alt="EasyPay"
              className="w-8 h-8 rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <h1 className="text-base font-extrabold text-primary-foreground tracking-tight">EasyPay</h1>
              <p className="text-[10px] text-primary-foreground/70 font-medium">Secure Payment Gateway</p>
            </div>
          </div>

          {/* Countdown ring */}
          {secondsLeft !== null && (step === "login" || step === "confirm") && (
            <CircularCountdown secondsLeft={secondsLeft} total={totalSeconds} />
          )}

          {/* Shield badge */}
          {(step === "loading" || step === "processing") && (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center"
            >
              <Shield size={18} className="text-primary-foreground" />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Content area ──────────────────────────────────────── */}
      <div className="flex-1 -mt-4 rounded-t-3xl bg-background relative z-10 px-5 pt-5 pb-8">
        <AnimatePresence mode="wait">
          {/* LOADING */}
          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16">
              <PulsingRings />
              <p className="text-sm text-muted-foreground text-center mt-6 font-medium">Loading payment details...</p>
            </motion.div>
          )}

          {/* EXPIRED */}
          {step === "expired" && (
            <motion.div key="expired" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-10 text-center">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Clock size={36} className="text-accent" />
              </div>
              <h2 className="text-xl font-extrabold text-foreground mb-1">Session Expired</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-[260px] mx-auto">This payment link has expired. Please request a new one from the merchant.</p>
              <Button variant="outline" onClick={handleCancel} className="rounded-xl px-8">Go Back</Button>
            </motion.div>
          )}

          {/* ERROR */}
          {step === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-10 text-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={36} className="text-destructive" />
              </div>
              <h2 className="text-xl font-extrabold text-foreground mb-1">Invalid Session</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-[260px] mx-auto">This payment link is invalid or no longer available.</p>
              <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl px-8">Go Home</Button>
            </motion.div>
          )}

          {/* LOGIN */}
          {step === "login" && session && (
            <motion.div key="login" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              {/* Merchant + Amount Card */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] relative overflow-hidden">
                {/* Shimmer border effect */}
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.08) 50%, transparent 100%)", backgroundSize: "200% 100%" }}
                  animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <MerchantAvatar name={merchantName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">{merchantName || "Merchant"}</p>
                        <BadgeCheck size={16} className="text-primary shrink-0" />
                      </div>
                      {session.description && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{session.description}</p>
                      )}
                      <span className="inline-block mt-1 text-[9px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Verified Merchant
                      </span>
                    </div>
                  </div>

                  <div className="text-center py-4 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Amount to Pay</p>
                    <p className="text-4xl font-black text-foreground leading-none">
                      <span className="text-accent text-2xl align-top mr-0.5">৳</span>
                      {fmt(session.amount)}
                    </p>
                    {session.reference && (
                      <span className="inline-block mt-2 text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        Ref: {session.reference}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Phone + PIN */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-5">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-2">Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">🇧🇩 +88</span>
                    <Input
                      type="tel"
                      placeholder="01XXXXXXXXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      maxLength={11}
                      inputMode="numeric"
                      className="pl-16 h-12 rounded-xl text-base font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-3">Enter PIN</label>
                  <PinDots value={pin} onChange={setPin} />
                </div>

                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive text-center font-medium"
                  >
                    {errorMsg}
                  </motion.p>
                )}

                <Button
                  onClick={handleLogin}
                  disabled={phone.length < 11 || pin.length < 4}
                  className="w-full h-12 rounded-xl text-sm font-bold gradient-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-lg)] transition-shadow"
                >
                  <Fingerprint size={16} className="mr-2" />
                  Pay Securely
                </Button>
              </div>

              <button onClick={handleCancel} className="w-full text-center text-xs text-muted-foreground font-medium py-2 hover:text-foreground transition-colors">
                Cancel Payment
              </button>
            </motion.div>
          )}

          {/* CONFIRM */}
          {step === "confirm" && session && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="text-center mb-2">
                <MerchantAvatar name={merchantName} />
                <h2 className="text-lg font-extrabold text-foreground mt-3">Confirm Payment</h2>
                <p className="text-xs text-muted-foreground">Review details before confirming</p>
              </div>

              {/* Summary card */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">To</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground">{merchantName}</span>
                    <BadgeCheck size={14} className="text-primary" />
                  </div>
                </div>
                <div className="h-px bg-border/60" />
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="text-xl font-black text-foreground">
                    <span className="text-accent text-sm mr-0.5">৳</span>{fmt(session.amount)}
                  </span>
                </div>
                <div className="h-px bg-border/60" />
                {session.reference && (
                  <>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-muted-foreground">Reference</span>
                      <span className="text-xs font-semibold text-foreground">{session.reference}</span>
                    </div>
                    <div className="h-px bg-border/60" />
                  </>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Fee</span>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">FREE</span>
                </div>
              </div>

              {/* Slide to Pay */}
              <SlideToConfirm
                onConfirm={handlePay}
                label="Slide to Pay"
                gradient="gradient-primary"
                pinComplete
              />

              <button onClick={() => { setStep("login"); setPin(""); }} className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground font-medium py-2 hover:text-foreground transition-colors">
                <ChevronLeft size={14} /> Go Back
              </button>
            </motion.div>
          )}

          {/* PROCESSING */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16">
              <PulsingRings />
              <motion.p
                className="text-sm font-semibold text-foreground text-center mt-6"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Verifying payment...
              </motion.p>
              <p className="text-[11px] text-muted-foreground text-center mt-1">Please don't close this page</p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10 text-center">
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"
              >
                <CheckCircle2 size={52} className="text-primary" strokeWidth={2} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="text-2xl font-black text-foreground mb-1"
              >
                Payment Successful!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground"
              >
                <span className="text-accent font-bold">৳{session ? fmt(session.amount) : "—"}</span>
                {" "}paid to <span className="font-semibold text-foreground">{merchantName || "Merchant"}</span>
              </motion.p>

              {session?.reference && (
                <p className="text-[10px] text-muted-foreground mt-2">Ref: {session.reference}</p>
              )}

              {session?.success_url ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-6">
                  <div className="w-48 h-1.5 bg-muted rounded-full mx-auto overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 3, ease: "linear" }}
                    />
                  </div>
                  <p className="text-xs text-primary mt-2 font-medium">Redirecting back to merchant...</p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                  <Button variant="outline" onClick={() => navigate("/")} className="mt-6 rounded-xl px-8">
                    Go to EasyPay
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* FAILED */}
          {step === "failed" && (
            <motion.div key="failed" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-10 text-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircle size={40} className="text-destructive" />
              </div>
              <h2 className="text-xl font-extrabold text-foreground mb-1">Payment Failed</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-[260px] mx-auto">{errorMsg || "Something went wrong. Please try again."}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleCancel} className="rounded-xl px-6">Cancel</Button>
                <Button onClick={() => { setStep("login"); setPin(""); setErrorMsg(""); }} className="rounded-xl px-6 gradient-primary text-primary-foreground">Try Again</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-2 text-center">
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground/50">
          <Lock size={10} />
          <p className="text-[9px] font-medium">Secured by EasyPay · End-to-end encrypted</p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
