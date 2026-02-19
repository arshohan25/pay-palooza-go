import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, AlertCircle, Eye, EyeOff, ArrowRight, RefreshCw,
  Shield, CheckCircle2, UserRound, Delete, Smartphone,
  Lock, Star, Zap, Globe,
} from "lucide-react";
import { haptics } from "@/lib/haptics";

// ─── Storage keys ──────────────────────────────────────────────────────────────
const SESSION_KEY    = "mfs_authenticated";
const PIN_KEY        = "mfs_user_pin";
const DEVICE_KEY     = "mfs_device_verified";
const REGISTERED_KEY = "mfs_registered_phone";
const USER_NAME_KEY  = "mfs_user_name";
const LANG_KEY       = "mfs_ui_lang";

const getStoredPin      = () => localStorage.getItem(PIN_KEY) ?? "";
const getDeviceVerified = () => localStorage.getItem(DEVICE_KEY) === "1";
const getRegistered     = () => localStorage.getItem(REGISTERED_KEY) ?? "";

const DEMO_OTP = "123456";

// ─── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    appName: "EasyPay", tagline: "বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট",
    users: "Users", encryption: "Encryption", transfer: "Transfer",
    balanceLabel: "Available Balance", walletSecurity: "Bank-grade encrypted wallet",
    createFree: "🎉 Create Free Account", loginWallet: "🔐 Log In to Wallet",
    alreadyHave: "Already have an account?", signIn: "Sign in →",
    newUser: "New user?", createOne: "Create an account →",
    terms: "By continuing you agree to our", termsLink: "Terms", privacy: "Privacy Policy",
    createAccount: "Create Account", welcomeBack: "Welcome Back",
    enterPhoneRegister: "Enter your mobile number to create your free wallet",
    enterPhoneLogin: "Enter your registered mobile number to continue",
    sendOtp: "Send OTP", continue: "Continue",
    alreadyRegistered: "Already registered?", logIn: "Log in",
    noAccount: "Don't have an account?", createOneFree: "Create one free",
    supportedNet: "Supported",
    verifyNumber: "Verify Number", resetPin: "Reset PIN",
    codeSent: "Code sent to", demoMode: "Demo mode — use OTP",
    resendOtp: "Resend OTP", verify: "Verify",
    setPin: "Set Your PIN", newPin: "New PIN", confirmPin: "Confirm PIN",
    choosePinHint: "Choose a secure 4-digit PIN to protect your wallet",
    reenterPin: "Re-enter your PIN to confirm",
    pinWeakHint: "Avoid 1234, 1111, or your birthday. Never share your PIN.",
    enterPin: "Enter PIN",
    trustedDevice: "Trusted device — enter your PIN to continue",
    trustedVerified: "Trusted Device Verified",
    forgotPin: "Forgot PIN?", reset: "Reset",
    showPin: "Show PIN", hidePin: "Hide PIN",
    yourName: "What's your name?", nameHint: "Friends will recognise you by this",
    namePlaceholder: "e.g. Tanvir Hasan",
    nameOptional: "Optional — you can skip and add it later from your profile.",
    createWallet: "Create My Wallet 🎉", skipCreate: "Skip & Create Wallet",
    allSet: "All Set! 🎊", walletReady: "Your wallet is ready.", openingDashboard: "Opening your dashboard…",
    instantTransfer: "Instant Transfer", bankSecurity: "Bank-Grade Security",
    available247: "24/7 Available", zeroFees: "Zero Fees",
    pinTooWeak: "PIN too weak. Avoid sequential/repeated digits.",
    pinsDontMatch: "PINs don't match. Try again.",
    incorrectPin: "Incorrect PIN. Try again.", incorrectOtp: "Incorrect OTP. Demo: 123456",
    validPhone: "Enter a valid 11-digit Bangladeshi mobile number.",
    alreadyRegisteredErr: "Already registered. Please log in.",
    notRegistered: "Number not registered. Create an account.",
    enterOtp: "Enter the 6-digit OTP.", enter4Digits: "Enter all 4 digits.",
    reenterPinErr: "Re-enter your PIN.",
  },
  bn: {
    appName: "ইজিপে", tagline: "বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট",
    users: "ব্যবহারকারী", encryption: "এনক্রিপশন", transfer: "ট্রান্সফার",
    balanceLabel: "উপলব্ধ ব্যালেন্স", walletSecurity: "ব্যাংক-গ্রেড এনক্রিপ্টেড ওয়ালেট",
    createFree: "🎉 বিনামূল্যে একাউন্ট খুলুন", loginWallet: "🔐 ওয়ালেটে লগইন করুন",
    alreadyHave: "ইতিমধ্যে একাউন্ট আছে?", signIn: "সাইন ইন →",
    newUser: "নতুন ব্যবহারকারী?", createOne: "একাউন্ট তৈরি করুন →",
    terms: "চালিয়ে যাওয়ার মাধ্যমে আপনি আমাদের", termsLink: "শর্তাবলী", privacy: "গোপনীয়তা নীতি",
    createAccount: "একাউন্ট তৈরি করুন", welcomeBack: "স্বাগতম",
    enterPhoneRegister: "বিনামূল্যে ওয়ালেট তৈরি করতে আপনার মোবাইল নম্বর দিন",
    enterPhoneLogin: "চালিয়ে যেতে আপনার নিবন্ধিত নম্বর দিন",
    sendOtp: "ওটিপি পাঠান", continue: "পরবর্তী",
    alreadyRegistered: "ইতিমধ্যে নিবন্ধিত?", logIn: "লগইন",
    noAccount: "একাউন্ট নেই?", createOneFree: "বিনামূল্যে তৈরি করুন",
    supportedNet: "সাপোর্টেড",
    verifyNumber: "নম্বর যাচাই করুন", resetPin: "পিন রিসেট করুন",
    codeSent: "কোড পাঠানো হয়েছে", demoMode: "ডেমো মোড — ওটিপি ব্যবহার করুন",
    resendOtp: "ওটিপি পুনরায় পাঠান", verify: "যাচাই করুন",
    setPin: "পিন সেট করুন", newPin: "নতুন পিন", confirmPin: "পিন নিশ্চিত করুন",
    choosePinHint: "আপনার ওয়ালেট রক্ষার জন্য একটি নিরাপদ ৪-সংখ্যার পিন বেছে নিন",
    reenterPin: "নিশ্চিত করতে পিন পুনরায় দিন",
    pinWeakHint: "১২৩৪, ১১১১ বা জন্মদিন ব্যবহার করবেন না। পিন কখনো শেয়ার করবেন না।",
    enterPin: "পিন দিন",
    trustedDevice: "বিশ্বস্ত ডিভাইস — চালিয়ে যেতে পিন দিন",
    trustedVerified: "বিশ্বস্ত ডিভাইস যাচাই হয়েছে",
    forgotPin: "পিন ভুলে গেছেন?", reset: "রিসেট",
    showPin: "পিন দেখুন", hidePin: "পিন লুকান",
    yourName: "আপনার নাম কি?", nameHint: "বন্ধুরা এই নামে আপনাকে চিনবে",
    namePlaceholder: "যেমন: তানভীর হাসান",
    nameOptional: "ঐচ্ছিক — পরে প্রোফাইল থেকে যোগ করতে পারবেন।",
    createWallet: "আমার ওয়ালেট তৈরি করুন 🎉", skipCreate: "এড়িয়ে যান এবং তৈরি করুন",
    allSet: "সব ঠিক আছে! 🎊", walletReady: "আপনার ওয়ালেট প্রস্তুত।", openingDashboard: "ড্যাশবোর্ড খোলা হচ্ছে…",
    instantTransfer: "তাৎক্ষণিক ট্রান্সফার", bankSecurity: "ব্যাংক-গ্রেড নিরাপত্তা",
    available247: "২৪/৭ উপলব্ধ", zeroFees: "শূন্য চার্জ",
    pinTooWeak: "পিন দুর্বল। ক্রমিক/একই সংখ্যা এড়িয়ে চলুন।",
    pinsDontMatch: "পিন মিলছে না। আবার চেষ্টা করুন।",
    incorrectPin: "ভুল পিন। আবার চেষ্টা করুন।", incorrectOtp: "ভুল ওটিপি। ডেমো: ১২৩৪৫৬",
    validPhone: "একটি বৈধ ১১-সংখ্যার বাংলাদেশী মোবাইল নম্বর দিন।",
    alreadyRegisteredErr: "ইতিমধ্যে নিবন্ধিত। অনুগ্রহ করে লগইন করুন।",
    notRegistered: "নম্বর নিবন্ধিত নয়। একটি একাউন্ট তৈরি করুন।",
    enterOtp: "৬-সংখ্যার ওটিপি দিন।", enter4Digits: "সব ৪টি সংখ্যা দিন।",
    reenterPinErr: "আপনার পিন পুনরায় দিন।",
  },
} as const;

type Lang = "en" | "bn";

type Mode =
  | "landing"
  | "register_phone" | "register_otp" | "register_pin" | "register_name"
  | "login_phone" | "login_otp" | "login_pin"
  | "forgot_otp" | "forgot_pin"
  | "success";

// ─── Step progress bar ────────────────────────────────────────────────────────
const REGISTER_STEPS = ["Phone", "OTP", "PIN", "Name"];
const LOGIN_STEPS    = ["Phone", "PIN"];

function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {steps.map((label, i) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            className="h-1 w-full rounded-full overflow-hidden bg-muted"
            initial={false}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "hsl(var(--primary))" }}
              initial={{ width: i < current ? "100%" : "0%" }}
              animate={{ width: i < current ? "100%" : i === current ? "60%" : "0%" }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </motion.div>
          <span className={`text-[9px] font-bold uppercase tracking-wide ${i <= current ? "text-primary" : "text-muted-foreground/40"}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Numeric Keypad ───────────────────────────────────────────────────────────
const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

function NumPad({ onKey, onDelete }: { onKey: (k: string) => void; onDelete: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map((k, idx) => {
        if (k === "") return <div key={idx} />;
        const isDel = k === "⌫";
        return (
          <motion.button
            key={k + idx}
            whileTap={{ scale: 0.88 }}
            onClick={() => { haptics.light(); isDel ? onDelete() : onKey(k); }}
            className={`h-14 rounded-2xl text-xl font-bold flex items-center justify-center transition-colors select-none
              ${isDel
                ? "bg-muted text-muted-foreground active:bg-destructive/10 active:text-destructive"
                : "bg-card border border-border shadow-card text-foreground active:bg-primary/10 active:text-primary"}`}
          >
            {isDel ? <Delete size={20} /> : k}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── OTP Big-Box Input ────────────────────────────────────────────────────────
function OtpBoxes({ value, error }: { value: string; error: boolean }) {
  return (
    <div className="flex justify-center gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <motion.div
            key={i}
            animate={{
              scale: active ? 1.08 : 1,
              borderColor: error
                ? "hsl(var(--destructive))"
                : filled
                ? "hsl(var(--primary))"
                : active
                ? "hsl(var(--primary) / 0.5)"
                : "hsl(var(--border))",
              backgroundColor: filled
                ? "hsl(var(--primary) / 0.08)"
                : "hsl(var(--card))",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="w-11 h-14 rounded-2xl border-2 flex items-center justify-center shadow-card"
          >
            {filled ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-xl font-black text-primary"
              >
                {value[i]}
              </motion.span>
            ) : active ? (
              <motion.div
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-0.5 h-5 rounded-full bg-primary/50"
              />
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── PIN Dots (large) ─────────────────────────────────────────────────────────
function PinCircles({ pin, error, length = 4 }: { pin: string; error: boolean; length?: number }) {
  return (
    <div className="flex justify-center gap-5">
      {Array.from({ length }).map((_, i) => {
        const filled = i < pin.length;
        return (
          <motion.div
            key={i}
            animate={{
              scale: filled ? 1.25 : 1,
              backgroundColor: error
                ? "hsl(var(--destructive))"
                : filled
                ? "hsl(var(--primary))"
                : "transparent",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              error && filled
                ? "border-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.5)]"
                : filled
                ? "border-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
                : "border-muted-foreground/25"
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── Hero wave SVG ────────────────────────────────────────────────────────────
function HeroWave() {
  return (
    <svg viewBox="0 0 390 80" preserveAspectRatio="none" className="w-full h-20 -mt-1" fill="none">
      <path d="M0 0 Q 97 80 195 40 Q 293 0 390 50 L390 80 L0 80 Z" fill="hsl(var(--background))" />
    </svg>
  );
}

// ─── Feature pill ─────────────────────────────────────────────────────────────
function Pill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white">
      <Icon size={11} strokeWidth={2.5} />
      <span className="text-[11px] font-semibold">{label}</span>
    </div>
  );
}

// ─── Phone input ──────────────────────────────────────────────────────────────
function PhoneInput({
  value, onChange, error, autoFocus = false,
}: { value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 100); }, [autoFocus]);
  return (
    <div className="space-y-2">
      <div className={`flex items-center h-16 bg-card border-2 rounded-2xl overflow-hidden transition-all shadow-card ${error ? "border-destructive" : "border-border focus-within:border-primary focus-within:shadow-glow"}`}>
        <div className="flex items-center gap-2 pl-4 pr-3 border-r border-border h-full shrink-0">
          <span className="text-2xl">🇧🇩</span>
          <span className="text-sm font-black text-foreground">+880</span>
        </div>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          placeholder="01XXXXXXXXX"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
          className="flex-1 h-full px-4 text-lg font-bold bg-transparent focus:outline-none placeholder:text-muted-foreground/30 placeholder:font-normal"
        />
        {value.length === 11 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="pr-4">
            <CheckCircle2 size={20} className="text-primary" />
          </motion.div>
        )}
      </div>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs text-destructive flex items-center gap-1.5 px-1">
          <AlertCircle size={12} /> {error}
        </motion.p>
      )}
    </div>
  );
}

// ─── Name input ───────────────────────────────────────────────────────────────
function NameInput({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);
  return (
    <input
      ref={ref}
      type="text"
      placeholder="e.g. Tanvir Hasan"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-16 px-5 text-lg font-bold bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary focus:shadow-glow transition-all placeholder:font-normal placeholder:text-muted-foreground/30 shadow-card"
    />
  );
}

// ─── Slide variants ───────────────────────────────────────────────────────────
const slideV = {
  enter:  (d: number) => ({ x: d > 0 ? "60%" : "-60%", opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit:   (d: number) => ({ x: d < 0 ? "60%" : "-60%", opacity: 0, scale: 0.96 }),
};

// ─── Main Component ───────────────────────────────────────────────────────────
interface AuthPageProps { onAuthenticated: () => void; }

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [lang, setLang]               = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) ?? "en");
  const t = T[lang];

  const toggleLang = () => {
    const next: Lang = lang === "en" ? "bn" : "en";
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const [mode, setMode]             = useState<Mode>("landing");
  const [direction, setDir]         = useState(1);
  const [phone, setPhone]           = useState("");
  const [otp, setOtp]               = useState("");
  const [pin, setPin]               = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [confirmStage, setConfirmStage] = useState(false);   // true = entering confirm PIN
  const [showPin, setShowPin]       = useState(false);
  const [error, setError]           = useState("");
  const [userName, setUserName]     = useState("");

  const goTo = useCallback((next: Mode, dir = 1) => {
    setDir(dir); setMode(next); setError(""); haptics.medium();
  }, []);

  const isValidPhone = (p: string) => /^01[3-9]\d{8}$/.test(p);
  const isNewUser    = !getRegistered();

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegisterPhone = () => {
    if (!isValidPhone(phone)) { setError(t.validPhone); return; }
    if (getRegistered() === phone) { setError(t.alreadyRegisteredErr); return; }
    goTo("register_otp");
  };

  const handleRegisterOtp = useCallback((val?: string) => {
    const v = val ?? otp;
    if (v.length < 6) { setError(t.enterOtp); return; }
    if (v !== DEMO_OTP) { setError(t.incorrectOtp); haptics.error(); return; }
    setPin(""); setConfirmPin(""); setConfirmStage(false);
    goTo("register_pin");
  }, [otp, goTo, t]);

  const handleRegisterPin = useCallback((currentPin: string, currentConfirm: string, stage: boolean) => {
    const seq = ["1234","2345","3456","4567","5678","6789","9876","8765","7654","6543","5432","4321"];
    const rep = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999"];
    if (!stage) {
      if (currentPin.length < 4) { setError(t.enter4Digits); return; }
      if (seq.includes(currentPin) || rep.includes(currentPin)) { setError(t.pinTooWeak); return; }
      setError(""); setConfirmStage(true); haptics.success();
    } else {
      if (currentConfirm.length < 4) { setError(t.reenterPinErr); return; }
      if (currentPin !== currentConfirm) {
        setError(t.pinsDontMatch); haptics.error(); setConfirmPin(""); return;
      }
      localStorage.setItem(PIN_KEY, currentPin);
      localStorage.setItem(DEVICE_KEY, "1");
      localStorage.setItem(REGISTERED_KEY, phone);
      haptics.success(); setConfirmStage(false); goTo("register_name");
    }
  }, [phone, goTo, t]);

  const handleRegisterName = () => {
    const trimmed = userName.trim();
    const finalName = trimmed || `+880 ${phone.slice(0, 3)}****${phone.slice(-3)}`;
    localStorage.setItem(USER_NAME_KEY, finalName);
    localStorage.setItem("mfs_registered_phone", phone);
    sessionStorage.setItem(SESSION_KEY, "1");
    haptics.success(); goTo("success"); setTimeout(onAuthenticated, 1500);
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLoginPhone = () => {
    if (!isValidPhone(phone)) { setError(t.validPhone); return; }
    const registered = getRegistered();
    if (registered && registered !== phone) { setError(t.notRegistered); return; }
    if (getDeviceVerified() && getStoredPin()) { goTo("login_pin"); }
    else { goTo("login_otp"); }
  };

  const handleLoginOtp = useCallback((val?: string) => {
    const v = val ?? otp;
    if (v.length < 6) { setError(t.enterOtp); return; }
    if (v !== DEMO_OTP) { setError(t.incorrectOtp); haptics.error(); return; }
    localStorage.setItem(DEVICE_KEY, "1"); setPin(""); goTo("login_pin");
  }, [otp, goTo, t]);

  const handleLoginPin = useCallback((entered: string) => {
    const stored = getStoredPin() || "1234";
    if (entered !== stored) {
      haptics.error(); setError(t.incorrectPin);
      setTimeout(() => { setPin(""); setError(""); }, 700); return;
    }
    sessionStorage.setItem(SESSION_KEY, "1"); haptics.success();
    goTo("success"); setTimeout(onAuthenticated, 1500);
  }, [goTo, onAuthenticated, t]);

  // ── Forgot PIN ─────────────────────────────────────────────────────────────
  const handleForgotOtp = useCallback((val?: string) => {
    const v = val ?? otp;
    if (v.length < 6) { setError(t.enterOtp); return; }
    if (v !== DEMO_OTP) { setError(t.incorrectOtp); haptics.error(); return; }
    setPin(""); setConfirmPin(""); setConfirmStage(false); goTo("forgot_pin");
  }, [otp, goTo, t]);

  const handleForgotPin = useCallback((currentPin: string, currentConfirm: string, stage: boolean) => {
    const seq = ["1234","2345","3456","4567","5678","6789","9876","8765","7654","6543","5432","4321"];
    const rep = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999"];
    if (!stage) {
      if (currentPin.length < 4) return;
      if (seq.includes(currentPin) || rep.includes(currentPin)) { setError(t.pinTooWeak); return; }
      setError(""); setConfirmStage(true); haptics.success();
    } else {
      if (currentConfirm.length < 4) return;
      if (currentPin !== currentConfirm) { setError(t.pinsDontMatch); haptics.error(); setConfirmPin(""); return; }
      localStorage.setItem(PIN_KEY, currentPin); localStorage.setItem(DEVICE_KEY, "1");
      haptics.success(); setConfirmStage(false); setPin(""); setConfirmPin(""); goTo("login_pin");
    }
  }, [goTo, t]);

  // ── OTP numeric keypad handler ─────────────────────────────────────────────
  const handleOtpKey = (k: string, onComplete: (val: string) => void) => {
    setOtp(prev => {
      const next = (prev + k).slice(0, 6);
      setError("");
      if (next.length === 6) setTimeout(() => onComplete(next), 260);
      return next;
    });
  };

  // ── PIN numeric keypad handler ─────────────────────────────────────────────
  const handlePinKey = (
    k: string,
    currentPin: string,
    currentConfirm: string,
    stage: boolean,
    onComplete: (p: string, c: string, s: boolean) => void,
  ) => {
    if (!stage) {
      const next = (currentPin + k).slice(0, 4);
      setPin(next);
      setError("");
      if (next.length === 4) setTimeout(() => onComplete(next, currentConfirm, false), 260);
    } else {
      const next = (currentConfirm + k).slice(0, 4);
      setConfirmPin(next);
      setError("");
      if (next.length === 4) setTimeout(() => onComplete(currentPin, next, true), 260);
    }
  };

  const handlePinDelete = (stage: boolean) => {
    if (!stage) setPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
  };

  // ── Back navigation ────────────────────────────────────────────────────────
  const handleBack = () => {
    setError("");
    if (mode === "register_phone" || mode === "login_phone") { goTo("landing", -1); return; }
    if (mode === "register_otp")  { setOtp(""); goTo("register_phone", -1); return; }
    if (mode === "register_pin")  {
      if (confirmStage) { setConfirmStage(false); setConfirmPin(""); return; }
      setPin(""); setConfirmPin(""); goTo("register_otp", -1); return;
    }
    if (mode === "register_name") { goTo("register_pin", -1); return; }
    if (mode === "login_otp")     { setOtp(""); goTo("login_phone", -1); return; }
    if (mode === "login_pin")     { setPin(""); goTo("login_phone", -1); return; }
    if (mode === "forgot_otp")    { setOtp(""); goTo("login_pin", -1); return; }
    if (mode === "forgot_pin")    {
      if (confirmStage) { setConfirmStage(false); setConfirmPin(""); return; }
      setPin(""); setConfirmPin(""); goTo("forgot_otp", -1); return;
    }
  };

  // ── Step index helpers ─────────────────────────────────────────────────────
  const registerStep = { register_phone: 0, register_otp: 1, register_pin: 2, register_name: 3 }[mode as string] ?? -1;
  const loginStep    = { login_phone: 0, login_otp: 0, login_pin: 1 }[mode as string] ?? -1;

  const showBack = mode !== "landing" && mode !== "success";
  const showHero = mode === "landing";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden">

      {/* ── Hero header (landing only) ── */}
      <AnimatePresence>
        {showHero && (
          <motion.div
            key="hero"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="relative shrink-0 gradient-hero overflow-hidden"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/8 pointer-events-none" />
            <div className="absolute -bottom-6 -left-8 w-32 h-32 rounded-full bg-white/6 pointer-events-none" />
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-white/4 pointer-events-none" />

            <div className="relative px-6 pt-12 pb-4 flex flex-col items-center gap-4 text-white">
              {/* Language toggle — top right */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={toggleLang}
                className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white text-xs font-bold"
              >
                <Globe size={11} />
                {lang === "en" ? "বাংলা" : "English"}
              </motion.button>

              {/* Logo */}
              <motion.div
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                className="relative"
              >
                <div className="w-20 h-20 rounded-[22px] bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-4xl font-black shadow-float">
                  ৳
                </div>
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-[22px] ring-2 ring-white/30"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="text-center"
              >
                <h1 className="text-3xl font-black tracking-tight leading-none">{t.appName}</h1>
                <p className="text-sm font-medium text-white/70 mt-1">{t.tagline}</p>
              </motion.div>

              {/* Feature pills */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap justify-center gap-2 pb-2"
              >
                <Pill icon={Zap} label={t.instantTransfer} />
                <Pill icon={Shield} label={t.bankSecurity} />
                <Pill icon={Globe} label={t.available247} />
                <Pill icon={Star} label={t.zeroFees} />
              </motion.div>
            </div>

            <HeroWave />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Non-landing top bar ── */}
      <AnimatePresence>
        {!showHero && mode !== "success" && (
          <motion.div
            key="topbar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="shrink-0 gradient-hero px-4 pt-12 pb-4 flex flex-col gap-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3rem)" }}
          >
            {/* Back button */}
            {showBack && (
              <button
                onClick={handleBack}
                className="self-start w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            {/* Step bar for register */}
            {registerStep >= 0 && (
              <div className="px-1">
                <StepBar steps={REGISTER_STEPS} current={registerStep} />
              </div>
            )}
            {/* Step bar for login */}
            {loginStep >= 0 && (
              <div className="px-1">
                <StepBar steps={LOGIN_STEPS} current={loginStep} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="min-h-full flex flex-col items-center justify-center px-5 py-6">
          <div className="w-full max-w-sm">
            <AnimatePresence custom={direction} mode="popLayout">
              <motion.div
                key={mode + (confirmStage ? "_confirm" : "")}
                custom={direction}
                variants={slideV}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 340, damping: 32 }}
                className="space-y-6"
              >

                {/* ──────────── LANDING ──────────── */}
                {mode === "landing" && (
                  <div className="space-y-5">
                    {/* Trust indicators */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 }}
                      className="grid grid-cols-3 gap-3"
                    >
                      {[
                        { emoji: "🏦", val: "10M+", label: t.users },
                        { emoji: "🔒", val: "256-bit", label: t.encryption },
                        { emoji: "⚡", val: "< 3s", label: t.transfer },
                      ].map(({ emoji, val, label }) => (
                        <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-card border border-border shadow-card">
                          <span className="text-xl">{emoji}</span>
                          <span className="text-sm font-black text-foreground">{val}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                        </div>
                      ))}
                    </motion.div>

                    {/* Wallet preview card */}
                    <motion.div
                      initial={{ opacity: 0, y: 16, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.55, type: "spring", stiffness: 200, damping: 24 }}
                      className="relative overflow-hidden gradient-hero rounded-3xl p-5 text-white shadow-glow-lg"
                    >
                      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/8" />
                      <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5" />
                      <div className="relative">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">{t.balanceLabel}</p>
                            <p className="text-2xl font-black tracking-tight">৳ •••,•••</p>
                          </div>
                          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                            <Smartphone size={18} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold opacity-75">
                          <Shield size={13} />
                          <span>{t.walletSecurity}</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* CTAs */}
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.62 }}
                      className="space-y-3"
                    >
                      <button
                        className="w-full h-14 gradient-hero text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
                        onClick={() => {
                          setPhone(""); setOtp(""); setPin(""); setConfirmPin(""); setConfirmStage(false);
                          if (!isNewUser && getDeviceVerified() && getStoredPin()) goTo("login_pin");
                          else goTo(isNewUser ? "register_phone" : "login_phone");
                        }}
                      >
                        {isNewUser ? t.createFree : t.loginWallet}
                        <ArrowRight size={17} />
                      </button>

                      {isNewUser ? (
                        <button
                          className="w-full h-12 bg-card border border-border rounded-2xl text-sm font-semibold text-foreground shadow-card active:scale-[0.98] transition-transform flex items-center justify-center gap-1"
                          onClick={() => {
                            setPhone(""); setOtp(""); setPin(""); setConfirmPin(""); setConfirmStage(false);
                            if (getDeviceVerified() && getStoredPin() && getRegistered()) goTo("login_pin");
                            else goTo("login_phone");
                          }}
                        >
                          {t.alreadyHave}{" "}
                          <span className="text-primary font-bold">{t.signIn}</span>
                        </button>
                      ) : (
                        <button
                          className="w-full text-sm text-center py-2 text-muted-foreground"
                          onClick={() => {
                            localStorage.removeItem(REGISTERED_KEY);
                            localStorage.removeItem(PIN_KEY);
                            localStorage.removeItem(DEVICE_KEY);
                            setPhone(""); goTo("register_phone");
                          }}
                        >
                          {t.newUser}{" "}
                          <span className="text-primary font-bold">{t.createOne}</span>
                        </button>
                      )}
                    </motion.div>

                    <p className="text-[10px] text-muted-foreground text-center">
                      {t.terms}{" "}
                      <span className="text-primary underline underline-offset-2">{t.termsLink}</span> &{" "}
                      <span className="text-primary underline underline-offset-2">{t.privacy}</span>
                    </p>
                  </div>
                )}

                {/* ──────────── PHONE ENTRY ──────────── */}
                {(mode === "register_phone" || mode === "login_phone") && (
                  <div className="space-y-6 pt-2">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-black text-foreground tracking-tight">
                        {mode === "register_phone" ? t.createAccount : t.welcomeBack}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {mode === "register_phone" ? t.enterPhoneRegister : t.enterPhoneLogin}
                      </p>
                    </div>

                    <PhoneInput
                      value={phone}
                      onChange={(v) => { setPhone(v); setError(""); }}
                      error={error}
                      autoFocus
                    />

                    <button
                      className="w-full h-14 gradient-hero text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
                      onClick={mode === "register_phone" ? handleRegisterPhone : handleLoginPhone}
                      disabled={phone.length < 11}
                    >
                      {mode === "register_phone" ? t.sendOtp : t.continue}
                      <ArrowRight size={17} />
                    </button>

                    <div className="text-center text-sm text-muted-foreground">
                      {mode === "register_phone" ? (
                        <button onClick={() => { setError(""); setPhone(""); goTo("login_phone"); }}>
                          {t.alreadyRegistered}{" "}
                          <span className="text-primary font-bold">{t.logIn}</span>
                        </button>
                      ) : (
                        <button onClick={() => { setError(""); setPhone(""); goTo("register_phone"); }}>
                          {t.noAccount}{" "}
                          <span className="text-primary font-bold">{t.createOneFree}</span>
                        </button>
                      )}
                    </div>

                    {/* Supported networks */}
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-muted/50 border border-border">
                      <span className="text-base">📱</span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t.supportedNet}: <strong className="text-foreground">GP · Robi · BL · Airtel · Teletalk · Banglalink</strong>
                      </p>
                    </div>
                  </div>
                )}

                {/* ──────────── OTP VERIFY ──────────── */}
                {(mode === "register_otp" || mode === "login_otp" || mode === "forgot_otp") && (() => {
                  const onComplete =
                    mode === "register_otp" ? handleRegisterOtp :
                    mode === "login_otp" ? handleLoginOtp : handleForgotOtp;

                  return (
                    <div className="space-y-6 pt-2">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-foreground tracking-tight">
                          {mode === "forgot_otp" ? t.resetPin : t.verifyNumber}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {t.codeSent}{" "}
                          <span className="font-bold text-foreground">+880 {phone || getRegistered()}</span>
                        </p>
                      </div>

                      {/* Big OTP boxes */}
                      <OtpBoxes value={otp} error={!!error} />

                      {error && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-destructive flex items-center justify-center gap-1.5">
                          <AlertCircle size={12} /> {error}
                        </motion.p>
                      )}

                      {/* Demo hint */}
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/25">
                        <span className="text-sm">💡</span>
                        <p className="text-[11px] text-muted-foreground">
                          {t.demoMode}{" "}
                          <strong className="text-foreground font-black text-sm">123456</strong>
                        </p>
                      </div>

                      {/* Numeric keypad */}
                      <NumPad
                        onKey={(k) => handleOtpKey(k, onComplete)}
                        onDelete={() => { setOtp(p => p.slice(0, -1)); setError(""); }}
                      />

                      <div className="flex items-center justify-between pt-1">
                        <button
                          className="flex items-center gap-1.5 text-sm text-muted-foreground"
                          onClick={() => { setOtp(""); setError(""); }}
                        >
                          <RefreshCw size={13} /> {t.resendOtp}
                        </button>
                        <button
                          className="h-12 px-6 gradient-hero text-white font-bold text-sm rounded-xl shadow-glow flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-40"
                          onClick={() => onComplete()}
                          disabled={otp.length < 6}
                        >
                          {t.verify} <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ──────────── SET / CONFIRM PIN ──────────── */}
                {(mode === "register_pin" || mode === "forgot_pin") && (() => {
                  const onComplete = mode === "register_pin" ? handleRegisterPin : handleForgotPin;
                  const currentVal = confirmStage ? confirmPin : pin;

                  return (
                    <div className="space-y-6 pt-2">
                      <div className="space-y-1">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={confirmStage ? "confirm" : "set"}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                          >
                            <h2 className="text-2xl font-black text-foreground tracking-tight">
                              {confirmStage ? t.confirmPin : (mode === "forgot_pin" ? t.newPin : t.setPin)}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {confirmStage ? t.reenterPin : t.choosePinHint}
                            </p>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Lock icon when confirming */}
                      <AnimatePresence mode="wait">
                        {confirmStage && (
                          <motion.div
                            key="lock"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="flex justify-center"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <Lock size={22} className="text-primary" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* PIN circles */}
                      <PinCircles pin={currentVal} error={!!error} />

                      {error && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-destructive flex items-center justify-center gap-1.5">
                          <AlertCircle size={12} /> {error}
                        </motion.p>
                      )}

                      {!confirmStage && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 border border-border">
                          <Shield size={13} className="text-muted-foreground shrink-0" />
                          <p className="text-[11px] text-muted-foreground">{t.pinWeakHint}</p>
                        </div>
                      )}

                      {/* Numeric keypad */}
                      <NumPad
                        onKey={(k) => handlePinKey(k, pin, confirmPin, confirmStage, onComplete)}
                        onDelete={() => handlePinDelete(confirmStage)}
                      />
                    </div>
                  );
                })()}

                {/* ──────────── LOGIN PIN ──────────── */}
                {mode === "login_pin" && (
                  <div className="space-y-6 pt-2">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-black text-foreground tracking-tight">{t.enterPin}</h2>
                      <p className="text-sm text-muted-foreground">
                        {getDeviceVerified() ? t.trustedDevice : t.enterPin}
                      </p>
                    </div>

                    {getDeviceVerified() && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/8 border border-primary/20">
                        <CheckCircle2 size={14} className="text-primary" />
                        <span className="text-xs font-semibold text-primary">{t.trustedVerified}</span>
                      </div>
                    )}

                    <PinCircles pin={pin} error={!!error} />

                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-destructive flex items-center justify-center gap-1.5">
                        <AlertCircle size={12} /> {error}
                      </motion.p>
                    )}

                    {/* Numeric keypad */}
                    <NumPad
                      onKey={(k) => {
                        setPin(prev => {
                          const next = (prev + k).slice(0, 4);
                          setError("");
                          if (next.length === 4) setTimeout(() => handleLoginPin(next), 260);
                          return next;
                        });
                      }}
                      onDelete={() => setPin(p => p.slice(0, -1))}
                    />

                    <div className="flex items-center justify-between pt-1">
                      <button
                        className="text-sm"
                        onClick={() => { setPin(""); setOtp(""); goTo("forgot_otp"); }}
                      >
                        <span className="text-muted-foreground">{t.forgotPin} </span>
                        <span className="text-primary font-bold">{t.reset}</span>
                      </button>

                      {/* Show/hide pin toggle */}
                      <button
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        onClick={() => setShowPin(v => !v)}
                      >
                        {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                        {showPin ? t.hidePin : t.showPin}
                      </button>
                    </div>

                    {/* Show actual pin digits if showPin toggled */}
                    {showPin && pin.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                      >
                        <span className="text-4xl font-black tracking-[0.8em] text-primary pl-[0.8em]">
                          {pin}
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ──────────── NAME ENTRY ──────────── */}
                {mode === "register_name" && (
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <UserRound size={22} className="text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight">{t.yourName}</h2>
                        <p className="text-sm text-muted-foreground">{t.nameHint}</p>
                      </div>
                    </div>

                    <NameInput value={userName} onChange={setUserName} />

                    <p className="text-[11px] text-muted-foreground px-1">{t.nameOptional}</p>

                    <button
                      className="w-full h-14 gradient-hero text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      onClick={handleRegisterName}
                    >
                      <CheckCircle2 size={17} />
                      {userName.trim() ? t.createWallet : t.skipCreate}
                    </button>
                  </div>
                )}

                {/* ──────────── SUCCESS ──────────── */}
                {mode === "success" && (
                  <div className="flex flex-col items-center gap-6 py-8 text-center">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 240, damping: 18 }}
                      className="relative"
                    >
                      <div className="w-28 h-28 gradient-hero rounded-[32px] flex items-center justify-center text-white shadow-glow-lg">
                        <CheckCircle2 size={52} strokeWidth={1.5} />
                      </div>
                      {[1, 1.35, 1.6].map((s, i) => (
                        <motion.div
                          key={i}
                          className="absolute inset-0 rounded-[32px] ring-2 ring-primary/30"
                          animate={{ scale: [1, s], opacity: [0.6, 0] }}
                          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
                        />
                      ))}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22 }}
                    >
                      <h2 className="text-3xl font-black text-foreground tracking-tight">{t.allSet}</h2>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {t.walletReady}<br />{t.openingDashboard}
                      </p>
                    </motion.div>

                    <motion.div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full gradient-hero rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.3, ease: "easeInOut" }}
                      />
                    </motion.div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
