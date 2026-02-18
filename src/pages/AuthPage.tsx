import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, KeyRound, ShieldCheck, ChevronLeft,
  AlertCircle, Eye, EyeOff, ArrowRight, RefreshCw,
  Fingerprint, Sparkles, Zap, Shield, Send, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SESSION_KEY    = "mfs_authenticated";
const PIN_KEY        = "mfs_user_pin";
const DEVICE_KEY     = "mfs_device_verified";
const REGISTERED_KEY = "mfs_registered_phone";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStoredPin      = () => localStorage.getItem(PIN_KEY) ?? "";
const getDeviceVerified = () => localStorage.getItem(DEVICE_KEY) === "1";
const getRegistered     = () => localStorage.getItem(REGISTERED_KEY) ?? "";

const DEMO_OTP = "123456";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode =
  | "landing"
  | "register_phone" | "register_otp" | "register_pin"
  | "login_phone" | "login_otp" | "login_pin"
  | "forgot_otp" | "forgot_pin"
  | "success";

// ─── Animated background particles ───────────────────────────────────────────
const FloatingOrb = ({ className, delay = 0 }: { className: string; delay?: number }) => (
  <motion.div
    className={`absolute rounded-full pointer-events-none ${className}`}
    animate={{ y: [0, -18, 0], opacity: [0.5, 0.8, 0.5] }}
    transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
  />
);

// ─── Feature chip ─────────────────────────────────────────────────────────────
const FeatureChip = ({ icon: Icon, label, delay }: { icon: React.ElementType; label: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, type: "spring", stiffness: 300, damping: 26 }}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary"
  >
    <Icon size={12} strokeWidth={2.5} />
    <span className="text-xs font-semibold">{label}</span>
  </motion.div>
);

// ─── PIN dots ─────────────────────────────────────────────────────────────────
const PinDots = ({ pin, error, length = 4 }: { pin: string; error: boolean; length?: number }) => (
  <div className="flex justify-center gap-4">
    {Array.from({ length }).map((_, i) => (
      <motion.div
        key={i}
        animate={{
          scale: pin.length > i ? 1.25 : 1,
          backgroundColor: error
            ? "hsl(var(--destructive))"
            : pin.length > i
            ? "hsl(var(--primary))"
            : "transparent",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className={`w-4 h-4 rounded-full border-2 transition-all ${
          error && pin.length > i
            ? "border-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.5)]"
            : pin.length > i
            ? "border-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
            : "border-muted-foreground/30"
        }`}
      />
    ))}
  </div>
);

// ─── Slide variants ───────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Step header ──────────────────────────────────────────────────────────────
const StepHeader = ({
  iconClass, icon: Icon, title, subtitle,
}: { iconClass: string; icon: React.ElementType; title: string; subtitle: string }) => (
  <motion.div
    className="text-center"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.06, duration: 0.35 }}
  >
    <div className={`w-16 h-16 ${iconClass} rounded-3xl flex items-center justify-center text-white mx-auto mb-4 shadow-glow`}>
      <Icon size={28} strokeWidth={1.8} />
    </div>
    <h2 className="text-2xl font-extrabold text-foreground tracking-tight">{title}</h2>
    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>
  </motion.div>
);

// ─── Phone input ──────────────────────────────────────────────────────────────
const PhoneInput = ({
  value, onChange, error, autoFocus = false,
}: { value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean }) => (
  <div className="space-y-2">
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
        <span className="text-sm font-bold text-foreground">+880</span>
        <div className="w-px h-5 bg-border" />
      </div>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="01XXXXXXXXX"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
        autoFocus={autoFocus}
        className={`w-full pl-[4.5rem] pr-4 h-14 text-base font-bold bg-card border-2 rounded-2xl focus:outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground/40 ${
          error ? "border-destructive" : "border-border focus:border-primary focus:shadow-glow"
        }`}
      />
    </div>
    {error && (
      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
        className="text-xs text-destructive flex items-center gap-1.5 px-1">
        <AlertCircle size={12} /> {error}
      </motion.p>
    )}
  </div>
);

// ─── OTP section ──────────────────────────────────────────────────────────────
const OtpSection = ({
  value, onChange, error, phone,
}: { value: string; onChange: (v: string) => void; error?: string; phone: string }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  return (
    <div className="space-y-4">
      {/* Sent to chip */}
      <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-primary/8 border border-primary/20">
        <Send size={12} className="text-primary" />
        <p className="text-xs text-primary font-semibold">Code sent to +880 {phone}</p>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: value.length > i ? 1.2 : 1,
              backgroundColor: value.length > i ? "hsl(var(--primary))" : "transparent",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className={`w-3.5 h-3.5 rounded-full border-2 ${
              value.length > i
                ? "border-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                : "border-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`w-full h-14 text-center text-2xl font-bold tracking-[0.8rem] bg-card border-2 rounded-2xl focus:outline-none transition-all placeholder:text-muted-foreground/30 placeholder:tracking-normal ${
          error ? "border-destructive" : "border-border focus:border-primary focus:shadow-glow"
        }`}
        placeholder="······"
      />

      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs text-destructive flex items-center justify-center gap-1.5">
          <AlertCircle size={12} /> {error}
        </motion.p>
      )}

      {/* Demo hint */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 border border-border">
        <ShieldCheck size={13} className="text-muted-foreground shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          Demo mode — use OTP <strong className="text-foreground">123456</strong>
        </p>
      </div>
    </div>
  );
};

// ─── PIN input field ──────────────────────────────────────────────────────────
const PinInput = ({
  value, onChange, show, onToggleShow, error, autoFocus = false,
}: {
  value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void;
  error?: string; autoFocus?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => inputRef.current?.focus(), 120); }, [autoFocus]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={show ? "text" : "password"}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className={`w-full h-14 text-center text-3xl font-bold tracking-[1.1rem] bg-card border-2 rounded-2xl focus:outline-none transition-all pr-12 ${
          error ? "border-destructive" : "border-border focus:border-primary focus:shadow-glow"
        }`}
        placeholder="••••"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
interface AuthPageProps { onAuthenticated: () => void; }

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode]             = useState<Mode>("landing");
  const [direction, setDir]         = useState(1);
  const [phone, setPhone]           = useState("");
  const [otp, setOtp]               = useState("");
  const [pin, setPin]               = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin]       = useState(false);
  const [error, setError]           = useState("");

  const goTo = useCallback((next: Mode, dir = 1) => {
    setDir(dir); setMode(next); setError(""); haptics.medium();
  }, []);

  const formatPhone = (raw: string) => raw.replace(/\D/g, "").slice(0, 11);
  const isValidPhone = (p: string) => /^01[3-9]\d{8}$/.test(p);
  const isNewUser = !getRegistered();

  // ── Register flow ──────────────────────────────────────────────────────────
  const handleRegisterPhone = () => {
    if (!isValidPhone(phone)) { setError("Enter a valid 11-digit Bangladeshi mobile number."); return; }
    if (getRegistered() === phone) { setError("This number is already registered. Please log in."); return; }
    goTo("register_otp");
  };

  const handleRegisterOtp = useCallback(() => {
    if (otp.length < 6) { setError("Enter the 6-digit OTP."); return; }
    if (otp !== DEMO_OTP) { setError("Incorrect OTP. Demo OTP is 123456."); haptics.error(); return; }
    goTo("register_pin");
  }, [otp, goTo]);

  const handleRegisterPin = () => {
    if (pin.length < 4) { setError("PIN must be 4 digits."); return; }
    const seq = ["1234","2345","3456","4567","5678","6789","9876","8765","7654","6543","5432","4321"];
    const rep = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999"];
    if (seq.includes(pin) || rep.includes(pin)) { setError("PIN too weak. Avoid sequential or repeated digits."); return; }
    if (confirmPin.length < 4) { setError("Re-enter your PIN to confirm."); return; }
    if (pin !== confirmPin) { setError("PINs do not match."); return; }
    localStorage.setItem(PIN_KEY, pin);
    localStorage.setItem(DEVICE_KEY, "1");
    localStorage.setItem(REGISTERED_KEY, phone);
    sessionStorage.setItem(SESSION_KEY, "1");
    haptics.success();
    goTo("success");
    setTimeout(onAuthenticated, 1400);
  };

  // ── Login flow ─────────────────────────────────────────────────────────────
  const handleLoginPhone = () => {
    if (!isValidPhone(phone)) { setError("Enter a valid 11-digit Bangladeshi mobile number."); return; }
    const registered = getRegistered();
    if (registered && registered !== phone) {
      setError("Number not registered. Create an account to get started.");
      return;
    }
    if (getDeviceVerified() && getStoredPin()) { goTo("login_pin"); }
    else { goTo("login_otp"); }
  };

  const handleLoginOtp = useCallback(() => {
    if (otp.length < 6) { setError("Enter the 6-digit OTP."); return; }
    if (otp !== DEMO_OTP) { setError("Incorrect OTP. Demo OTP is 123456."); haptics.error(); return; }
    localStorage.setItem(DEVICE_KEY, "1");
    goTo("login_pin");
  }, [otp, goTo]);

  const handleLoginPin = useCallback(() => {
    const stored = getStoredPin() || "1234";
    if (pin !== stored) {
      haptics.error();
      setError("Incorrect PIN. Try again.");
      setTimeout(() => { setPin(""); setError(""); }, 700);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "1");
    haptics.success();
    goTo("success");
    setTimeout(onAuthenticated, 1400);
  }, [pin, goTo, onAuthenticated]);

  // ── Forgot PIN flow ────────────────────────────────────────────────────────
  const handleForgotOtp = useCallback(() => {
    if (otp.length < 6) { setError("Enter the 6-digit OTP."); return; }
    if (otp !== DEMO_OTP) { setError("Incorrect OTP. Demo OTP is 123456."); haptics.error(); return; }
    setPin(""); setConfirmPin("");
    goTo("forgot_pin");
  }, [otp, goTo]);

  const handleForgotPin = () => {
    if (pin.length < 4) { setError("PIN must be 4 digits."); return; }
    const seq = ["1234","2345","3456","4567","5678","6789","9876","8765","7654","6543","5432","4321"];
    const rep = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999"];
    if (seq.includes(pin) || rep.includes(pin)) { setError("PIN too weak. Avoid sequential or repeated digits."); return; }
    if (confirmPin.length < 4) { setError("Re-enter your PIN to confirm."); return; }
    if (pin !== confirmPin) { setError("PINs do not match."); return; }
    localStorage.setItem(PIN_KEY, pin);
    localStorage.setItem(DEVICE_KEY, "1");
    haptics.success();
    setPin(""); setConfirmPin("");
    goTo("login_pin");
  };

  // ── OTP auto-advance ───────────────────────────────────────────────────────
  const handleOtpChange = (val: string, onComplete: () => void) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setOtp(digits); setError("");
    if (digits.length === 6) setTimeout(onComplete, 260);
  };

  const handlePinChange = (val: string, setter: (v: string) => void, cb?: () => void) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setter(digits); setError("");
    if (cb && digits.length === 4) setTimeout(cb, 260);
  };

  // ── Back navigation ────────────────────────────────────────────────────────
  const handleBack = () => {
    if (mode === "register_phone" || mode === "login_phone") { goTo("landing", -1); return; }
    if (mode === "register_otp")  { setOtp(""); goTo("register_phone", -1); return; }
    if (mode === "register_pin")  { setPin(""); setConfirmPin(""); goTo("register_otp", -1); return; }
    if (mode === "login_otp")     { setOtp(""); goTo("login_phone", -1); return; }
    if (mode === "login_pin")     { setPin(""); goTo("login_phone", -1); return; }
    if (mode === "forgot_otp")    { setOtp(""); goTo("login_pin", -1); return; }
    if (mode === "forgot_pin")    { setPin(""); setConfirmPin(""); goTo("forgot_otp", -1); return; }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden">

      {/* ── Atmospheric background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <FloatingOrb className="w-80 h-80 -top-32 -left-32 bg-primary/6" delay={0} />
        <FloatingOrb className="w-96 h-96 -bottom-48 -right-32 bg-primary/5" delay={1.5} />
        <FloatingOrb className="w-48 h-48 top-1/3 right-0 bg-accent/6" delay={2.5} />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* ── Back button ── */}
      <AnimatePresence>
        {mode !== "landing" && mode !== "success" && (
          <motion.button
            key="back"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={handleBack}
            className="absolute top-12 left-5 z-10 w-10 h-10 rounded-2xl bg-card border border-border shadow-card flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Main scrollable content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto scrollbar-none py-8">
        <div className="w-full max-w-sm">
          <AnimatePresence custom={direction} mode="popLayout">
            <motion.div
              key={mode}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >

              {/* ────────────── LANDING ────────────── */}
              {mode === "landing" && (
                <div className="flex flex-col items-center gap-8 pt-8">

                  {/* Logo mark */}
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
                      className="relative"
                    >
                      <div className="w-24 h-24 gradient-hero rounded-[28px] flex items-center justify-center text-white text-5xl font-black shadow-glow-lg">
                        ৳
                      </div>
                      {/* Glow ring */}
                      <div className="absolute inset-0 rounded-[28px] ring-1 ring-primary/30 scale-110 opacity-60" />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-center"
                    >
                      <h1 className="text-4xl font-black text-foreground tracking-tight leading-none">
                        MFS Wallet
                      </h1>
                      <p className="text-sm text-muted-foreground mt-2 font-medium">
                        Fast · Secure · Instant
                      </p>
                    </motion.div>
                  </div>

                  {/* Feature chips */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap justify-center gap-2"
                  >
                    <FeatureChip icon={Send} label="Send Money" delay={0.32} />
                    <FeatureChip icon={Zap} label="Pay Bills" delay={0.38} />
                    <FeatureChip icon={Shield} label="Secure" delay={0.44} />
                    <FeatureChip icon={Sparkles} label="Cashback" delay={0.50} />
                  </motion.div>

                  {/* Premium card preview */}
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.38, type: "spring", stiffness: 200, damping: 24 }}
                    className="w-full relative overflow-hidden gradient-hero rounded-3xl p-5 text-white shadow-glow-lg"
                  >
                    <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/8" />
                    <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5" />
                    <div className="relative flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] opacity-60 mb-0.5">Available Balance</p>
                        <p className="text-2xl font-black tracking-tight">৳ ••••••</p>
                      </div>
                      <div className="w-10 h-10 glass-hero rounded-xl flex items-center justify-center">
                        <Shield size={18} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 glass-hero rounded-lg flex items-center justify-center">
                        <CheckCircle2 size={14} />
                      </div>
                      <span className="text-xs font-semibold opacity-80">Bank-grade security</span>
                    </div>
                  </motion.div>

                  {/* CTA buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.48 }}
                    className="w-full space-y-3"
                  >
                    {/* Primary action */}
                    <button
                      className="w-full h-14 gradient-hero text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      onClick={() => {
                        setPhone(""); setOtp(""); setPin(""); setConfirmPin("");
                        // Trusted device with stored PIN → skip phone entry, go straight to PIN
                        if (!isNewUser && getDeviceVerified() && getStoredPin()) {
                          goTo("login_pin");
                        } else {
                          goTo(isNewUser ? "register_phone" : "login_phone");
                        }
                      }}
                    >
                      {isNewUser ? (
                        <><Sparkles size={17} /> Create Free Account</>
                      ) : (
                        <><ArrowRight size={17} /> Log In to Wallet</>
                      )}
                    </button>

                    {/* Secondary action */}
                    {isNewUser ? (
                      <button
                        className="w-full h-12 bg-card border border-border text-foreground font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-card"
                        onClick={() => {
                          setPhone(""); setOtp(""); setPin(""); setConfirmPin("");
                          goTo("login_phone");
                        }}
                      >
                        Already have an account? <span className="text-primary">Sign in</span>
                      </button>
                    ) : (
                      <button
                        className="w-full text-sm text-muted-foreground font-medium text-center py-2"
                        onClick={() => {
                          localStorage.removeItem(REGISTERED_KEY);
                          localStorage.removeItem(PIN_KEY);
                          localStorage.removeItem(DEVICE_KEY);
                          setPhone(""); setOtp(""); setPin(""); setConfirmPin("");
                          goTo("register_phone");
                        }}
                      >
                        New user? <span className="text-primary font-semibold">Create an account →</span>
                      </button>
                    )}
                  </motion.div>

                  <p className="text-[11px] text-muted-foreground text-center pb-4">
                    By continuing, you agree to our{" "}
                    <span className="text-primary underline-offset-2 underline">Terms</span> &{" "}
                    <span className="text-primary underline-offset-2 underline">Privacy Policy</span>
                  </p>
                </div>
              )}

              {/* ────────────── PHONE ENTRY (Register / Login) ────────────── */}
              {(mode === "register_phone" || mode === "login_phone") && (
                <div className="space-y-6 pt-14">
                  <StepHeader
                    iconClass={mode === "login_phone" ? "gradient-primary" : "gradient-hero"}
                    icon={Phone}
                    title={mode === "register_phone" ? "Create Account" : "Welcome Back"}
                    subtitle={
                      mode === "register_phone"
                        ? "Enter your mobile number to get started with your free wallet"
                        : "Enter your registered mobile number to access your wallet"
                    }
                  />

                  <div className="space-y-4">
                    <PhoneInput
                      value={phone}
                      onChange={(v) => { setPhone(formatPhone(v)); setError(""); }}
                      error={error}
                      autoFocus
                    />

                    <button
                      className="w-full h-14 gradient-hero text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                      onClick={mode === "register_phone" ? handleRegisterPhone : handleLoginPhone}
                      disabled={phone.length < 11}
                    >
                      {mode === "register_phone" ? "Send OTP" : "Continue"}
                      <ArrowRight size={17} />
                    </button>

                    {/* Switch mode hint */}
                    <div className="pt-2 text-center">
                      {mode === "register_phone" ? (
                        <button
                          className="text-sm text-muted-foreground"
                          onClick={() => { setError(""); setPhone(""); goTo("login_phone"); }}
                        >
                          Already registered?{" "}
                          <span className="text-primary font-semibold">Log in instead</span>
                        </button>
                      ) : (
                        <button
                          className="text-sm text-muted-foreground"
                          onClick={() => { setError(""); setPhone(""); goTo("register_phone"); }}
                        >
                          Don't have an account?{" "}
                          <span className="text-primary font-semibold">Create one free</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────── OTP VERIFY (Register) ────────────── */}
              {mode === "register_otp" && (
                <div className="space-y-6 pt-14">
                  <StepHeader iconClass="gradient-send" icon={ShieldCheck}
                    title="Verify Number" subtitle="Enter the 6-digit code to verify your mobile number" />
                  <OtpSection value={otp} phone={phone}
                    onChange={(v) => handleOtpChange(v, handleRegisterOtp)} error={error} />
                  <button
                    className="w-full h-14 gradient-send text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                    onClick={handleRegisterOtp}
                    disabled={otp.length < 6}
                  >
                    Verify & Continue <ArrowRight size={17} />
                  </button>
                  <button className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground py-1"
                    onClick={() => { setOtp(""); setError(""); }}>
                    <RefreshCw size={13} /> Resend OTP
                  </button>
                </div>
              )}

              {/* ────────────── OTP VERIFY (Login) ────────────── */}
              {mode === "login_otp" && (
                <div className="space-y-6 pt-14">
                  <StepHeader iconClass="gradient-send" icon={ShieldCheck}
                    title="Verify Device" subtitle="Enter the 6-digit code to verify your device" />
                  <OtpSection value={otp} phone={phone}
                    onChange={(v) => handleOtpChange(v, handleLoginOtp)} error={error} />
                  <button
                    className="w-full h-14 gradient-send text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                    onClick={handleLoginOtp} disabled={otp.length < 6}
                  >
                    Verify Device <ArrowRight size={17} />
                  </button>
                  <button className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground py-1"
                    onClick={() => { setOtp(""); setError(""); }}>
                    <RefreshCw size={13} /> Resend OTP
                  </button>
                </div>
              )}

              {/* ────────────── SET PIN (Register) ────────────── */}
              {mode === "register_pin" && (
                <div className="space-y-6 pt-14">
                  <StepHeader iconClass="gradient-addmoney" icon={KeyRound}
                    title="Set Your PIN" subtitle="Choose a secure 4-digit PIN to protect your wallet" />

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] px-1">New PIN</label>
                      <PinDots pin={pin} error={!!error && !!pin} />
                      <PinInput value={pin} onChange={(v) => handlePinChange(v, setPin)}
                        show={showPin} onToggleShow={() => setShowPin(v => !v)} autoFocus />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] px-1">Confirm PIN</label>
                      <PinDots pin={confirmPin} error={!!error && pin !== confirmPin} />
                      <PinInput value={confirmPin}
                        onChange={(v) => handlePinChange(v, setConfirmPin, handleRegisterPin)}
                        show={showPin} onToggleShow={() => setShowPin(v => !v)} />
                    </div>

                    {/* PIN tips */}
                    <div className="p-3 rounded-2xl bg-muted/60 border border-border space-y-1">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">PIN tips</p>
                      <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                        <li>Avoid repeating digits (e.g. 1111)</li>
                        <li>Avoid sequential digits (e.g. 1234)</li>
                        <li>Never share your PIN with anyone</li>
                      </ul>
                    </div>

                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-destructive flex items-center justify-center gap-1.5">
                        <AlertCircle size={12} /> {error}
                      </motion.p>
                    )}

                    <button
                      className="w-full h-14 gradient-addmoney text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                      onClick={handleRegisterPin} disabled={pin.length < 4 || confirmPin.length < 4}
                    >
                      <CheckCircle2 size={17} /> Create Account
                    </button>
                  </div>
                </div>
              )}

              {/* ────────────── LOGIN PIN ────────────── */}
              {mode === "login_pin" && (
                <div className="space-y-6 pt-14">
                  <StepHeader iconClass="gradient-primary" icon={Fingerprint}
                    title="Enter PIN"
                    subtitle={getDeviceVerified()
                      ? "Device verified — enter your PIN to continue"
                      : "Enter your 4-digit security PIN"} />

                  <div className="space-y-4">
                    {getDeviceVerified() && (
                      <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-primary/8 border border-primary/20">
                        <ShieldCheck size={13} className="text-primary" />
                        <span className="text-xs font-semibold text-primary">Trusted device</span>
                      </div>
                    )}

                    <PinDots pin={pin} error={!!error} />

                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-destructive flex items-center justify-center gap-1.5">
                        <AlertCircle size={12} /> {error}
                      </motion.p>
                    )}

                    <PinInput value={pin}
                      onChange={(v) => handlePinChange(v, setPin, handleLoginPin)}
                      show={showPin} onToggleShow={() => setShowPin(v => !v)} autoFocus />

                    <button
                      className="w-full h-14 gradient-primary text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                      onClick={handleLoginPin} disabled={pin.length < 4}
                    >
                      <ArrowRight size={17} /> Log In
                    </button>

                    {/* Forgot PIN */}
                    <button
                      className="w-full text-sm text-center py-2"
                      onClick={() => { setPin(""); setOtp(""); goTo("forgot_otp"); }}
                    >
                      <span className="text-muted-foreground">Forgot your PIN? </span>
                      <span className="text-primary font-semibold">Reset via OTP</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ────────────── FORGOT PIN — OTP ────────────── */}
              {mode === "forgot_otp" && (
                <div className="space-y-6 pt-14">
                  <StepHeader iconClass="gradient-cashout" icon={ShieldCheck}
                    title="Reset PIN"
                    subtitle={`We'll send a 6-digit code to +880 ${getRegistered() || phone} to verify it's you`} />
                  <OtpSection value={otp} phone={getRegistered() || phone}
                    onChange={(v) => handleOtpChange(v, handleForgotOtp)} error={error} />
                  <button
                    className="w-full h-14 gradient-cashout text-white font-bold text-[15px] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                    onClick={handleForgotOtp} disabled={otp.length < 6}
                  >
                    Verify OTP <ArrowRight size={17} />
                  </button>
                  <button className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground py-1"
                    onClick={() => { setOtp(""); setError(""); }}>
                    <RefreshCw size={13} /> Resend OTP
                  </button>
                </div>
              )}

              {/* ────────────── FORGOT PIN — New PIN ────────────── */}
              {mode === "forgot_pin" && (
                <div className="space-y-6 pt-14">
                  <StepHeader iconClass="gradient-cashout" icon={KeyRound}
                    title="New PIN" subtitle="Choose a new 4-digit PIN you haven't used before" />

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] px-1">New PIN</label>
                      <PinDots pin={pin} error={!!error && !!pin} />
                      <PinInput value={pin} onChange={(v) => handlePinChange(v, setPin)}
                        show={showPin} onToggleShow={() => setShowPin(v => !v)} autoFocus />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em] px-1">Confirm PIN</label>
                      <PinDots pin={confirmPin} error={!!error && pin !== confirmPin} />
                      <PinInput value={confirmPin}
                        onChange={(v) => handlePinChange(v, setConfirmPin, handleForgotPin)}
                        show={showPin} onToggleShow={() => setShowPin(v => !v)} />
                    </div>

                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-destructive flex items-center justify-center gap-1.5">
                        <AlertCircle size={12} /> {error}
                      </motion.p>
                    )}

                    <button
                      className="w-full h-14 gradient-cashout text-white font-bold text-[15px] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                      onClick={handleForgotPin} disabled={pin.length < 4 || confirmPin.length < 4}
                    >
                      <CheckCircle2 size={17} /> Reset PIN & Log In
                    </button>
                  </div>
                </div>
              )}

              {/* ────────────── SUCCESS ────────────── */}
              {mode === "success" && (
                <div className="flex flex-col items-center gap-6 py-12 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="relative"
                  >
                    <div className="w-28 h-28 gradient-hero rounded-[32px] flex items-center justify-center text-white shadow-glow-lg">
                      <CheckCircle2 size={52} strokeWidth={1.5} />
                    </div>
                    {/* Pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-[32px] ring-2 ring-primary/40"
                      animate={{ scale: [1, 1.3, 1.6], opacity: [0.6, 0.3, 0] }}
                      transition={{ duration: 1.5, repeat: 2, ease: "easeOut" }}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-2"
                  >
                    <h2 className="text-3xl font-black text-foreground tracking-tight">All Set!</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your wallet is ready.<br />Opening your dashboard…
                    </p>
                  </motion.div>

                  {/* Loading bar */}
                  <motion.div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full gradient-hero rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                    />
                  </motion.div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
