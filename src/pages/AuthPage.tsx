import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, KeyRound, ShieldCheck, ChevronLeft,
  AlertCircle, Eye, EyeOff, ArrowRight, RefreshCw,
  Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SESSION_KEY      = "mfs_authenticated";
const PIN_KEY          = "mfs_user_pin";
const DEVICE_KEY       = "mfs_device_verified";  // persists across sessions
const REGISTERED_KEY   = "mfs_registered_phone";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStoredPin      = () => localStorage.getItem(PIN_KEY) ?? "";
const getDeviceVerified = () => localStorage.getItem(DEVICE_KEY) === "1";
const getRegistered     = () => localStorage.getItem(REGISTERED_KEY) ?? "";

// OTP is always "123456" in demo
const DEMO_OTP = "123456";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = "landing" | "register_phone" | "register_otp" | "register_pin" | "login_phone" | "login_otp" | "login_pin" | "success";

// ─── Sub-components ───────────────────────────────────────────────────────────
const PinDots = ({ pin, error, length = 4 }: { pin: string; error: boolean; length?: number }) => (
  <div className="flex justify-center gap-4">
    {Array.from({ length }).map((_, i) => (
      <motion.div
        key={i}
        animate={{
          scale: pin.length > i ? 1.2 : 1,
          backgroundColor: error
            ? "hsl(var(--destructive))"
            : pin.length > i
            ? "hsl(var(--primary))"
            : "transparent",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"
      />
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
interface AuthPageProps {
  onAuthenticated: () => void;
}

const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode]         = useState<Mode>("landing");
  const [direction, setDir]     = useState(1);
  const [phone, setPhone]       = useState("");
  const [otp, setOtp]           = useState("");
  const [pin, setPin]           = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin]   = useState(false);
  const [error, setError]       = useState("");
  const [otpSent, setOtpSent]   = useState(false);

  const goTo = useCallback((next: Mode, dir = 1) => {
    setDir(dir);
    setMode(next);
    setError("");
    haptics.medium();
  }, []);

  // ── Formatting ──────────────────────────────────────────────────────────────
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    return digits;
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const isValidPhone = (p: string) => /^01[3-9]\d{8}$/.test(p);

  // ── Register flow ───────────────────────────────────────────────────────────
  const handleRegisterPhone = () => {
    if (!isValidPhone(phone)) {
      setError("Enter a valid 11-digit Bangladeshi mobile number.");
      return;
    }
    // Check if already registered
    if (getRegistered() === phone) {
      setError("This number is already registered. Please log in.");
      return;
    }
    setOtpSent(true);
    goTo("register_otp");
  };

  const handleRegisterOtp = () => {
    if (otp.length < 6) { setError("Enter the 6-digit OTP."); return; }
    if (otp !== DEMO_OTP) { setError("Incorrect OTP. Demo OTP is 123456."); return; }
    goTo("register_pin");
  };

  const handleRegisterPin = () => {
    if (pin.length < 4) { setError("PIN must be 4 digits."); return; }
    if (pin === "1234" || pin === "0000" || /^(.)\1{3}$/.test(pin)) {
      setError("PIN is too weak. Avoid repeating or sequential digits.");
      return;
    }
    if (confirmPin.length < 4) { setError("Re-enter your PIN to confirm."); return; }
    if (pin !== confirmPin) { setError("PINs do not match."); return; }
    // Persist
    localStorage.setItem(PIN_KEY, pin);
    localStorage.setItem(DEVICE_KEY, "1");
    localStorage.setItem(REGISTERED_KEY, phone);
    sessionStorage.setItem(SESSION_KEY, "1");
    haptics.success();
    goTo("success");
    setTimeout(onAuthenticated, 1200);
  };

  // ── Login flow ──────────────────────────────────────────────────────────────
  const handleLoginPhone = () => {
    if (!isValidPhone(phone)) {
      setError("Enter a valid 11-digit Bangladeshi mobile number.");
      return;
    }
    const registered = getRegistered();
    if (registered && registered !== phone) {
      setError("This number is not registered. Please sign up.");
      return;
    }
    // If device is already verified, go straight to PIN
    if (getDeviceVerified() && getStoredPin()) {
      goTo("login_pin");
    } else {
      setOtpSent(true);
      goTo("login_otp");
    }
  };

  const handleLoginOtp = () => {
    if (otp.length < 6) { setError("Enter the 6-digit OTP."); return; }
    if (otp !== DEMO_OTP) { setError("Incorrect OTP. Demo OTP is 123456."); return; }
    localStorage.setItem(DEVICE_KEY, "1");
    goTo("login_pin");
  };

  const handleLoginPin = () => {
    const stored = getStoredPin() || "1234";
    if (pin !== stored) {
      haptics.light();
      setError("Incorrect PIN. Try again.");
      setTimeout(() => { setPin(""); setError(""); }, 600);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "1");
    haptics.success();
    goTo("success");
    setTimeout(onAuthenticated, 1200);
  };

  // ── OTP auto-advance ────────────────────────────────────────────────────────
  const handleOtpChange = (val: string, isLogin: boolean) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    setError("");
    if (digits.length === 6) {
      setTimeout(() => {
        if (isLogin) handleLoginOtp();
        else handleRegisterOtp();
      }, 200);
    }
  };

  // ── PIN auto-advance ─────────────────────────────────────────────────────────
  const handlePinChange = (val: string, setter: (v: string) => void, cb?: () => void) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setter(digits);
    setError("");
    if (cb && digits.length === 4) setTimeout(cb, 200);
  };

  const isNewUser = !getRegistered();

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/8" />
        <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/3" />
      </div>

      {/* Header back button */}
      {mode !== "landing" && mode !== "success" && (
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => {
            if (mode === "register_phone" || mode === "login_phone") goTo("landing", -1);
            else if (mode === "register_otp")  goTo("register_phone", -1);
            else if (mode === "register_pin")  goTo("register_otp", -1);
            else if (mode === "login_otp")     goTo("login_phone", -1);
            else if (mode === "login_pin")     goTo("login_phone", -1);
          }}
          className="absolute top-12 left-5 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-card flex items-center justify-center tap-target"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </motion.button>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="w-full max-w-sm">
          <AnimatePresence custom={direction} mode="popLayout">
            <motion.div
              key={mode}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >

              {/* ── Landing ── */}
              {mode === "landing" && (
                <div className="flex flex-col items-center gap-8">
                  {/* Logo */}
                  <div className="flex flex-col items-center gap-3">
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                      className="w-20 h-20 gradient-hero rounded-3xl flex items-center justify-center text-primary-foreground text-4xl font-extrabold shadow-glow-lg"
                    >
                      ৳
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="text-center"
                    >
                      <h1 className="text-3xl font-extrabold text-foreground tracking-tight">MFS Wallet</h1>
                      <p className="text-sm text-muted-foreground mt-1">Fast, secure mobile banking</p>
                    </motion.div>
                  </div>

                  {/* Feature pills */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="flex flex-wrap justify-center gap-2"
                  >
                    {["Send Money", "Pay Bills", "Cash Out", "Recharge"].map((f) => (
                      <span key={f} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {f}
                      </span>
                    ))}
                  </motion.div>

                  {/* Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="w-full space-y-3"
                  >
                    <Button
                      className="w-full h-13 gradient-hero border-0 text-white font-bold text-base rounded-2xl shadow-glow py-3"
                      onClick={() => {
                        setPhone(""); setOtp(""); setPin(""); setConfirmPin("");
                        goTo(isNewUser ? "register_phone" : "login_phone");
                      }}
                    >
                      {isNewUser ? "Create Account" : "Log In"}
                      <ArrowRight size={18} />
                    </Button>
                    {!isNewUser && (
                      <button
                        className="w-full text-sm text-muted-foreground font-medium text-center py-2"
                        onClick={() => {
                          // Clear registration to allow new account
                          localStorage.removeItem(REGISTERED_KEY);
                          localStorage.removeItem(PIN_KEY);
                          localStorage.removeItem(DEVICE_KEY);
                          setPhone(""); setOtp(""); setPin(""); setConfirmPin("");
                          goTo("register_phone");
                        }}
                      >
                        Don't have an account? <span className="text-primary font-semibold">Sign up</span>
                      </button>
                    )}
                    {isNewUser && (
                      <button
                        className="w-full text-sm text-muted-foreground font-medium text-center py-2"
                        onClick={() => {
                          setPhone(""); setOtp(""); setPin(""); setConfirmPin("");
                          goTo("login_phone");
                        }}
                      >
                        Already have an account? <span className="text-primary font-semibold">Log in</span>
                      </button>
                    )}
                  </motion.div>
                </div>
              )}

              {/* ── Register / Login: Phone ── */}
              {(mode === "register_phone" || mode === "login_phone") && (
                <div className="space-y-6 pt-10">
                  <div className="text-center">
                    <div className="w-14 h-14 gradient-hero rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-glow">
                      <Phone size={26} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-foreground">
                      {mode === "register_phone" ? "Create Account" : "Welcome Back"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {mode === "register_phone"
                        ? "Enter your mobile number to get started"
                        : "Enter your registered mobile number"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-sm font-semibold">+880</span>
                        <div className="w-px h-4 bg-border" />
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="01XXXXXXXXX"
                        value={phone}
                        onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(""); }}
                        autoFocus
                        className="w-full pl-20 pr-4 h-14 text-base font-semibold bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors placeholder:font-normal placeholder:text-muted-foreground/50"
                      />
                    </div>
                    {error && (
                      <p className="text-xs text-destructive flex items-center gap-1.5">
                        <AlertCircle size={12} /> {error}
                      </p>
                    )}
                    <Button
                      className="w-full h-12 gradient-hero border-0 text-white font-bold rounded-2xl"
                      onClick={mode === "register_phone" ? handleRegisterPhone : handleLoginPhone}
                      disabled={phone.length < 11}
                    >
                      {mode === "register_phone" ? "Send OTP" : "Continue"}
                      <ArrowRight size={16} />
                    </Button>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    By continuing, you agree to our <span className="text-primary">Terms of Service</span> and <span className="text-primary">Privacy Policy</span>
                  </p>
                </div>
              )}

              {/* ── OTP Verification ── */}
              {(mode === "register_otp" || mode === "login_otp") && (
                <div className="space-y-6 pt-10">
                  <div className="text-center">
                    <div className="w-14 h-14 gradient-send rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-card">
                      <ShieldCheck size={26} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-foreground">Verify OTP</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter the 6-digit code sent to
                    </p>
                    <p className="text-sm font-bold text-foreground mt-0.5">+880 {phone}</p>
                  </div>

                  {/* Demo hint */}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/8 border border-primary/20">
                    <ShieldCheck size={14} className="text-primary shrink-0" />
                    <p className="text-xs text-primary/80">
                      <span className="font-semibold">Demo mode:</span> Use OTP <strong>123456</strong>
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* 6 OTP dots */}
                    <div className="flex justify-center gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            scale: otp.length > i ? 1.15 : 1,
                            backgroundColor: otp.length > i ? "hsl(var(--primary))" : "transparent",
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"
                        />
                      ))}
                    </div>

                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => handleOtpChange(e.target.value, mode === "login_otp")}
                      autoFocus
                      className="w-full h-14 text-center text-3xl font-bold tracking-[0.8rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30 placeholder:tracking-normal"
                      placeholder="······"
                    />

                    {error && (
                      <p className="text-xs text-destructive flex items-center justify-center gap-1.5">
                        <AlertCircle size={12} /> {error}
                      </p>
                    )}

                    <Button
                      className="w-full h-12 gradient-send border-0 text-white font-bold rounded-2xl"
                      onClick={mode === "register_otp" ? handleRegisterOtp : handleLoginOtp}
                      disabled={otp.length < 6}
                    >
                      Verify OTP
                    </Button>

                    <button
                      className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground font-medium py-1"
                      onClick={() => { setOtp(""); setError(""); }}
                    >
                      <RefreshCw size={13} />
                      Resend OTP
                    </button>
                  </div>
                </div>
              )}

              {/* ── Set PIN (Register) ── */}
              {mode === "register_pin" && (
                <div className="space-y-6 pt-10">
                  <div className="text-center">
                    <div className="w-14 h-14 gradient-addmoney rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-card">
                      <KeyRound size={26} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-foreground">Set Your PIN</h2>
                    <p className="text-sm text-muted-foreground mt-1">Choose a secure 4-digit PIN</p>
                  </div>

                  <div className="space-y-5">
                    {/* New PIN */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New PIN</label>
                      <PinDots pin={pin} error={!!error && !!pin} />
                      <div className="relative">
                        <input
                          type={showPin ? "text" : "password"}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={pin}
                          onChange={(e) => handlePinChange(e.target.value, setPin)}
                          autoFocus
                          className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors pr-12"
                          placeholder="••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm PIN */}
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirm PIN</label>
                      <PinDots pin={confirmPin} error={!!error && pin !== confirmPin} />
                      <input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={confirmPin}
                        onChange={(e) => handlePinChange(e.target.value, setConfirmPin, handleRegisterPin)}
                        className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors"
                        placeholder="••••"
                      />
                    </div>

                    {error && (
                      <p className="text-xs text-destructive flex items-center gap-1.5 justify-center">
                        <AlertCircle size={12} /> {error}
                      </p>
                    )}

                    <Button
                      className="w-full h-12 gradient-addmoney border-0 text-white font-bold rounded-2xl"
                      onClick={handleRegisterPin}
                      disabled={pin.length < 4 || confirmPin.length < 4}
                    >
                      Set PIN &amp; Create Account
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Login PIN ── */}
              {mode === "login_pin" && (
                <div className="space-y-6 pt-10">
                  <div className="text-center">
                    <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-glow">
                      <Fingerprint size={26} />
                    </div>
                    <h2 className="text-2xl font-extrabold text-foreground">Enter PIN</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getDeviceVerified()
                        ? "Device verified — enter your PIN to continue"
                        : "Enter your 4-digit security PIN"}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Device verified badge */}
                    {getDeviceVerified() && (
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-primary/8 border border-primary/20">
                        <ShieldCheck size={13} className="text-primary" />
                        <span className="text-xs font-semibold text-primary">This device is trusted</span>
                      </div>
                    )}

                    <PinDots pin={pin} error={!!error} />

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-destructive flex items-center justify-center gap-1.5"
                      >
                        <AlertCircle size={12} /> {error}
                      </motion.p>
                    )}

                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => handlePinChange(e.target.value, setPin, handleLoginPin)}
                        autoFocus
                        className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors pr-12"
                        placeholder="••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <Button
                      className="w-full h-12 gradient-primary border-0 text-white font-bold rounded-2xl"
                      onClick={handleLoginPin}
                      disabled={pin.length < 4}
                    >
                      Log In
                    </Button>

                    <button
                      className="w-full text-sm text-muted-foreground text-center py-1"
                      onClick={() => { setPin(""); setOtp(""); goTo("login_otp", -1); }}
                    >
                      Forgot PIN? <span className="text-primary font-semibold">Verify with OTP</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Success ── */}
              {mode === "success" && (
                <div className="flex flex-col items-center gap-5 py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    className="w-24 h-24 gradient-addmoney rounded-full flex items-center justify-center shadow-glow"
                  >
                    <ShieldCheck size={48} className="text-white" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-foreground">All set!</p>
                    <p className="text-sm text-muted-foreground mt-1">Opening your wallet…</p>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
