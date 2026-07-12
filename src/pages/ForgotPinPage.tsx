import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, KeyRound, ShieldCheck, MessageSquare, Loader2, AlertCircle, CheckCircle2, ShieldAlert, Timer, HelpCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/haptics";
import { isWeakPin } from "@/lib/pinValidation";
import { signIn } from "@/lib/auth";
import { useOtpLockout, parseLockout } from "@/hooks/use-otp-lockout";
import Seo from "@/components/Seo";

type Step = "phone" | "otp" | "new" | "confirm" | "success" | "locked";

const RESEND_SECONDS = 60;

const isValidBdPhone = (p: string) => /^01[3-9]\d{8}$/.test(p);

const ForgotPinPage = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState<string>(() => localStorage.getItem("mfs_device_phone") ?? "");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const lockoutKey = useMemo(
    () => (phone && isValidBdPhone(phone) ? `pin_reset:${phone}` : ""),
    [phone],
  );
  const lockout = useOtpLockout(lockoutKey);

  // Resend cooldown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Auto-surface lockout screen when active
  useEffect(() => {
    if (lockout.isLocked && (step === "otp" || step === "phone")) setStep("locked");
    if (!lockout.isLocked && step === "locked") setStep("otp");
  }, [lockout.isLocked, step]);

  const sendOtp = useCallback(async () => {
    if (!isValidBdPhone(phone)) { setError("Enter a valid Bangladeshi mobile number"); return; }
    if (lockout.isLocked) return;
    setSending(true); setError(""); setDevOtp(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("send-otp", {
        body: { phone, purpose: "pin_reset" },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) throw new Error(data.error);
      if (data?.dev_otp) setDevOtp(String(data.dev_otp));
      setResendIn(RESEND_SECONDS);
      setStep("otp");
    } catch (err: any) {
      setError(err?.message || "Failed to send code");
    } finally {
      setSending(false);
    }
  }, [phone, lockout.isLocked]);

  const verifyOtp = useCallback(async (code: string) => {
    if (lockout.isLocked) return;
    setVerifying(true); setError("");
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code, purpose: "pin_reset" },
      });
      const locked = await parseLockout(data, invokeErr);
      if (locked) {
        lockout.lock(locked.minutes, locked.message);
        setOtp("");
        setStep("locked");
        haptics.error();
        return;
      }
      if (invokeErr) throw invokeErr;
      if (!data?.verified) {
        setError(data?.error || "Incorrect code");
        setOtp("");
        haptics.error();
        return;
      }
      haptics.success();
      setNewPin(""); setConfirmPin("");
      setStep("new");
    } catch (err: any) {
      setError(err?.message || "Verification failed");
      haptics.error();
    } finally {
      setVerifying(false);
    }
  }, [phone, lockout]);

  const submitNewPin = useCallback(async () => {
    setSubmitting(true); setError("");
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("reset-pin", {
        body: { phone, newPin, otpCode: otp },
      });
      const locked = await parseLockout(data, invokeErr);
      if (locked) {
        lockout.lock(locked.minutes, locked.message);
        setStep("locked");
        haptics.error();
        return;
      }
      if (invokeErr || data?.error) {
        setError(data?.error || "Could not reset PIN. Please try again.");
        setConfirmPin("");
        haptics.error();
        return;
      }
      haptics.success();
      setStep("success");
      // Try silent sign-in with the new PIN so the user lands authenticated
      try { await signIn(phone, newPin); } catch { /* ignore */ }
      setTimeout(() => navigate("/", { replace: true }), 1600);
    } catch (err: any) {
      setError(err?.message || "Could not reset PIN. Please try again.");
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  }, [phone, newPin, otp, lockout, navigate]);

  const handleOtpChange = (v: string) => {
    if (lockout.isLocked) return;
    const clean = v.replace(/\D/g, "").slice(0, 6);
    setOtp(clean);
    setError("");
    if (clean.length === 6 && !verifying) verifyOtp(clean);
  };

  const handleNewPin = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setNewPin(clean);
    setError("");
    if (clean.length === 4) {
      if (isWeakPin(clean)) {
        setError("PIN is too weak. Avoid sequential or repeated digits.");
        haptics.error();
        setNewPin("");
        return;
      }
      setTimeout(() => setStep("confirm"), 200);
    }
  };

  const handleConfirmPin = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setConfirmPin(clean);
    setError("");
    if (clean.length === 4) {
      if (clean !== newPin) {
        setError("PINs don't match. Please re-enter.");
        haptics.error();
        setConfirmPin("");
        return;
      }
      submitNewPin();
    }
  };

  const goBack = () => {
    if (step === "phone" || step === "success") { navigate(-1); return; }
    if (step === "locked") { navigate(-1); return; }
    if (step === "otp") { setStep("phone"); return; }
    if (step === "new") { setNewPin(""); setStep("otp"); return; }
    if (step === "confirm") { setConfirmPin(""); setStep("new"); return; }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <Seo
        title="Forgot PIN – Reset your transaction PIN"
        description="Recover access by verifying your phone and setting a new 4-digit PIN."
        path="/forgot-pin"
      />

      <motion.header
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-send px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={goBack} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <KeyRound size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Forgot PIN</h1>
              <p className="text-[10px] text-primary-foreground/70">Reset your 4-digit transaction PIN</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ── Phone step ── */}
          {step === "phone" && (
            <motion.div key="phone" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Confirm your number</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll send a 6-digit code to your registered phone.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="forgot-phone" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
                  <div className="relative">
                    <input
                      id="forgot-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      maxLength={11}
                      value={phone}
                      onChange={(e) => { setError(""); setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); }}
                      placeholder="01XXXXXXXXX"
                      className="w-full h-12 rounded-xl border border-border bg-background pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {phone && (
                      <button
                        type="button"
                        aria-label="Clear phone number"
                        onClick={() => { setPhone(""); setError(""); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Tap to edit if this isn't your number.</p>
                </div>
                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}
                <Button onClick={sendOtp} disabled={sending || !isValidBdPhone(phone)} className="w-full h-12 rounded-xl font-bold">
                  {sending ? <><Loader2 size={16} className="animate-spin mr-2" /> Sending code…</> : "Send verification code"}
                </Button>
              </Card>
            </motion.div>
          )}

          {/* ── OTP step ── */}
          {step === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 gradient-send rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <MessageSquare size={26} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">Verify it's you</h2>
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to <span className="font-semibold text-foreground">{phone}</span></p>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={handleOtpChange}
                    disabled={verifying || sending || lockout.isLocked}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-1.5">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot key={i} index={i} className={`w-10 h-12 text-lg font-bold ${error ? "border-destructive" : ""}`} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>

                  {verifying && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Verifying…
                    </p>
                  )}
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  {devOtp && <p className="text-[10px] text-amber-500 font-mono">DEV code: {devOtp}</p>}
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={sending || resendIn > 0 || lockout.isLocked}
                    className="text-xs font-semibold text-primary disabled:text-muted-foreground disabled:opacity-60"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── New PIN step ── */}
          {(step === "new" || step === "confirm") && (
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-5">
                <div className="text-center space-y-2">
                  <div className={`w-14 h-14 ${step === "new" ? "gradient-primary" : "gradient-addmoney"} rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow`}>
                    {step === "new" ? <KeyRound size={26} /> : <ShieldCheck size={26} />}
                  </div>
                  <h2 className="text-lg font-bold text-foreground">
                    {step === "new" ? "Set new PIN" : "Confirm new PIN"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {step === "new" ? "Choose a strong 4-digit PIN." : "Re-enter to confirm."}
                  </p>
                </div>
                <div className="px-6">
                  <input
                    key={step}
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    maxLength={4}
                    value={step === "new" ? newPin : confirmPin}
                    onChange={(e) => (step === "new" ? handleNewPin(e.target.value) : handleConfirmPin(e.target.value))}
                    disabled={submitting}
                    className={`w-full h-14 text-center text-3xl font-bold tracking-[1.2rem] bg-card border-2 rounded-2xl focus:outline-none transition-colors ${error ? "border-destructive" : "border-border focus:border-primary"}`}
                    placeholder="••••"
                  />
                </div>
                {error && (
                  <p className="text-xs text-destructive flex items-center justify-center gap-1.5">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}
                {submitting && (
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Saving new PIN…
                  </p>
                )}
              </Card>
            </motion.div>
          )}

          {/* ── Success ── */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 border-0 shadow-elevated rounded-2xl text-center space-y-4">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-20 h-20 rounded-3xl gradient-addmoney mx-auto flex items-center justify-center text-primary-foreground shadow-glow"
                >
                  <CheckCircle2 size={40} />
                </motion.div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-foreground">PIN reset successful</h2>
                  <p className="text-xs text-muted-foreground">Redirecting you back to your account…</p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Locked ── */}
          {step === "locked" && (
            <motion.div key="locked" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-2xl space-y-5">
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive mx-auto"
                  >
                    <ShieldAlert size={30} />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Verification locked</h2>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {lockout.message ||
                      `Too many incorrect codes. Try again in ${lockout.remainingMin} minute${lockout.remainingMin === 1 ? "" : "s"}.`}
                  </p>
                </div>

                <div className="mx-auto rounded-2xl border border-destructive/25 bg-destructive/[0.06] px-5 py-4 flex flex-col items-center gap-2 min-w-[220px]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-destructive/80 font-semibold">
                    <Timer size={12} /> Try again in
                  </div>
                  <div className="font-mono text-3xl font-bold tabular-nums text-destructive">
                    {lockout.mmss}
                  </div>
                  <div className="w-full h-1 rounded-full bg-destructive/15 overflow-hidden mt-1">
                    <motion.div
                      key={lockout.remainingSec > 0 ? "on" : "off"}
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: lockout.remainingSec, ease: "linear" }}
                      className="h-full bg-destructive/70 rounded-full"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHelp(v => !v)}
                  className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-primary"
                >
                  <HelpCircle size={13} /> Why is OTP locked?
                </button>
                <AnimatePresence>
                  {showHelp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl bg-muted/60 border border-border px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground space-y-1.5"
                    >
                      <p>
                        To protect your account from brute-force attempts, we
                        temporarily pause OTP verification after several
                        incorrect codes.
                      </p>
                      <p>
                        Wait for the timer to end, then request a fresh code.
                        If you keep getting locked out, contact support so we
                        can help you regain access safely.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="text-center">
                  <button onClick={() => navigate(-1)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                    Close and return later
                  </button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ForgotPinPage;
