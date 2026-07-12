import { useState, useEffect, useRef } from "react";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, CheckCircle2, AlertCircle, Lock, ShieldCheck, MessageSquare, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

import { signIn, changePin as changePinAuth } from "@/lib/auth";
import { isWeakPin } from "@/lib/pinValidation";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const getPhone = () => localStorage.getItem("mfs_device_phone") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "current" | "otp" | "new" | "confirm" | "success";

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── PIN dots + native input ──────────────────────────────────────────────────
interface PinFieldProps {
  value: string;
  onChange: (v: string) => void;
  gradient: string;
  error?: string;
  autoFocus?: boolean;
}

const PinField = ({ value, onChange, gradient, error, autoFocus }: PinFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-5 py-2">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: value.length > i ? 1.2 : 1,
              backgroundColor: error
                ? "hsl(var(--destructive))"
                : value.length > i
                ? undefined
                : "transparent",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              value.length > i && !error
                ? `${gradient} border-transparent shadow-md`
                : value.length > i && error
                ? "bg-destructive border-transparent"
                : "border-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-destructive flex items-center justify-center gap-1.5"
          >
            <AlertCircle size={13} /> {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="px-6">
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className={`w-full h-14 text-center text-3xl font-bold tracking-[1.2rem] bg-card border-2 rounded-2xl focus:outline-none transition-colors placeholder:text-muted-foreground/30 ${
            error ? "border-destructive" : "border-border focus:border-primary"
          }`}
          placeholder="••••"
        />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
interface ChangePinFlowProps { onClose: () => void; }

const OTP_PURPOSE = "pin_reset";
const RESEND_SECONDS = 60;

const ChangePinFlow = ({ onClose }: ChangePinFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]         = useState<Step>("current");
  const [direction, setDir]     = useState(1);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError]       = useState("");

  // OTP state
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const STEPS: Step[] = ["current", "otp", "new", "confirm"];
  const stepIndex = STEPS.indexOf(step);

  const stepMeta = {
    current: { heading: t("enterCurrentPin"), sub: t("confirmCurrentPinSub"), gradient: "gradient-send", iconGradient: "gradient-send" },
    otp:     { heading: "Verify it's you", sub: `Enter the 6-digit code we sent to ${getPhone() || "your phone"}`, gradient: "gradient-send", iconGradient: "gradient-send" },
    new:     { heading: t("setNewPin"), sub: t("chooseStrongPin"), gradient: "gradient-primary", iconGradient: "gradient-primary" },
    confirm: { heading: t("confirmNewPin"), sub: t("reenterNewPin"), gradient: "gradient-addmoney", iconGradient: "gradient-addmoney" },
    success: { heading: "", sub: "", gradient: "", iconGradient: "" },
  };

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const goTo = (next: Step, dir = 1) => {
    haptics.medium();
    setDir(dir);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "current") { onClose(); return; }
    if (step === "otp")     { setOtp(""); setOtpError(""); goTo("current", -1); return; }
    if (step === "new")     { setCurrentPin(""); setOtp(""); goTo("current", -1); return; }
    if (step === "confirm") { setNewPin(""); goTo("new", -1); return; }
  };

  const sendOtp = async () => {
    const phone = getPhone();
    if (!phone) { setOtpError("Missing phone number"); return; }
    setOtpSending(true); setOtpError(""); setDevOtp(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("send-otp", {
        body: { phone, purpose: OTP_PURPOSE },
      });
      if (invokeErr) throw invokeErr;
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      if (payload?.dev_otp) setDevOtp(String(payload.dev_otp));
      setResendIn(RESEND_SECONDS);
    } catch (err: any) {
      setOtpError(err?.message || "Failed to send code");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async (code: string) => {
    const phone = getPhone();
    if (!phone) return;
    setOtpVerifying(true); setOtpError("");
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code, purpose: OTP_PURPOSE },
      });
      if (invokeErr) throw invokeErr;
      const payload = data as any;
      if (!payload?.verified) {
        haptics.error();
        setOtpError(payload?.error || "Incorrect code");
        setTimeout(() => setOtp(""), 500);
        return;
      }
      haptics.success();
      goTo("new");
    } catch (err: any) {
      haptics.error();
      setOtpError(err?.message || "Verification failed");
      setTimeout(() => setOtp(""), 500);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleCurrentPin = (p: string) => {
    if (p.length > currentPin.length) haptics.light();
    setCurrentPin(p);
    setError("");
    if (p.length === 4) {
      setTimeout(async () => {
        try {
          await signIn(getPhone(), p);
          // Advance to OTP step and trigger send
          goTo("otp");
          setCurrentPin("");
          sendOtp();
        } catch {
          haptics.error();
          setError(t("incorrectPin"));
          setTimeout(() => setCurrentPin(""), 600);
        }
      }, 280);
    }
  };

  const handleOtpChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    setOtp(clean);
    setOtpError("");
    if (clean.length === 6 && !otpVerifying) {
      verifyOtp(clean);
    }
  };

  const handleNewPin = (p: string) => {
    if (p.length > newPin.length) haptics.light();
    setNewPin(p);
    setError("");
    if (p.length === 4) {
      setTimeout(() => {
        if (isWeakPin(p)) {
          haptics.error();
          setError(t("pinTooSimple"));
          setTimeout(() => setNewPin(""), 600);
        } else {
          goTo("confirm");
          setNewPin(p);
        }
      }, 280);
    }
  };

  const handleConfirmPin = (p: string) => {
    if (p.length > confirmPin.length) haptics.light();
    setConfirmPin(p);
    setError("");
    if (p.length === 4) {
      setTimeout(() => {
        if (p !== newPin) {
          haptics.error();
          setError(t("pinsDontMatch"));
          setTimeout(() => setConfirmPin(""), 600);
        } else {
          haptics.success();
          changePinAuth(newPin).catch(() => {});
          setDir(1);
          setStep("success");
        }
      }, 280);
    }
  };

  const activeMeta = stepMeta[step];

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {step !== "success" && (
        <motion.div
          className={`${activeMeta.gradient} px-4 pt-3 pb-3 text-primary-foreground`}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">{t("changePinTitle")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("keepAccountSecure")}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.55)]"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute inset-0 overflow-y-auto scrollbar-none flex flex-col"
          >

            {step === "current" && (
              <div className="flex flex-col gap-7 pt-10 pb-8">
                <div className="text-center space-y-2 px-4">
                  <div className="w-14 h-14 gradient-send rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <Lock size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{stepMeta.current.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{stepMeta.current.sub}</p>
                </div>

                <PinField
                  value={currentPin}
                  onChange={handleCurrentPin}
                  gradient="gradient-send"
                  error={error}
                  autoFocus
                />

                <p className="text-center text-xs text-muted-foreground px-4">
                  {t("demoPin")} <span className="font-mono font-bold text-foreground">1234</span>
                </p>
              </div>
            )}

            {step === "otp" && (
              <div className="flex flex-col gap-7 pt-10 pb-8">
                <div className="text-center space-y-2 px-4">
                  <div className="w-14 h-14 gradient-send rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <MessageSquare size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{stepMeta.otp.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{stepMeta.otp.sub}</p>
                </div>

                <div className="flex flex-col items-center gap-3 px-4">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={handleOtpChange}
                    disabled={otpVerifying || otpSending}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-1.5">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className={`w-10 h-12 text-lg font-bold ${otpError ? "border-destructive" : ""}`}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>

                  {otpSending && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Sending code…
                    </p>
                  )}
                  {otpVerifying && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Verifying…
                    </p>
                  )}
                  {otpError && (
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <AlertCircle size={12} /> {otpError}
                    </p>
                  )}
                  {devOtp && (
                    <p className="text-[10px] text-amber-500 font-mono">DEV code: {devOtp}</p>
                  )}
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={otpSending || resendIn > 0}
                    className="text-xs font-semibold text-primary disabled:text-muted-foreground disabled:opacity-60"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
              </div>
            )}

            {step === "new" && (
              <div className="flex flex-col gap-7 pt-10 pb-8">
                <div className="text-center space-y-2 px-4">
                  <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <Lock size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{stepMeta.new.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{stepMeta.new.sub}</p>
                </div>

                <PinField
                  value={newPin}
                  onChange={handleNewPin}
                  gradient="gradient-primary"
                  error={error}
                  autoFocus
                />

                <div className="mx-6 rounded-2xl bg-muted/60 border border-border px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">{t("pinTips")}</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li>{t("avoidRepeated")}</li>
                    <li>{t("avoidSequential")}</li>
                    <li>{t("dontSharePin")}</li>
                  </ul>
                </div>
              </div>
            )}

            {step === "confirm" && (
              <div className="flex flex-col gap-7 pt-10 pb-8">
                <div className="text-center space-y-2 px-4">
                  <div className="w-14 h-14 gradient-addmoney rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <ShieldCheck size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{stepMeta.confirm.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{stepMeta.confirm.sub}</p>
                </div>

                <PinField
                  value={confirmPin}
                  onChange={handleConfirmPin}
                  gradient="gradient-addmoney"
                  error={error}
                  autoFocus
                />
              </div>
            )}

            {step === "success" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center py-16">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-24 h-24 gradient-addmoney rounded-3xl flex items-center justify-center text-primary-foreground shadow-glow"
                >
                  <CheckCircle2 size={48} strokeWidth={1.5} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <h2 className="text-2xl font-bold text-foreground">{t("pinChanged")}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    {t("pinChangedSub")}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="w-full space-y-3"
                >
                  <button
                    onClick={onClose}
                    className="w-full h-12 gradient-addmoney text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                  >
                    {t("backToAccount")}
                  </button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ChangePinFlow;
