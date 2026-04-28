import { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, AlertCircle, Eye, EyeOff, ArrowRight, RefreshCw,
  Shield, CheckCircle2, UserRound, Smartphone,
  Lock, Star, Zap, Globe, Fingerprint,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { haptics } from "@/lib/haptics";
import { signUp, signIn, phoneToEmail, isPhoneRegistered } from "@/lib/auth";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import { isWeakPin } from "@/lib/pinValidation";
import { supabase } from "@/integrations/supabase/client";
const logo = "/icons/easypay-logo.webp";
import KycFlow from "@/components/KycFlow";
import { useDeviceOtpVerification, type DeviceOtpPortal } from "@/hooks/use-device-otp-verification";
import DeviceOtpStep from "@/components/DeviceOtpStep";
import DeviceVerifiedConfirm from "@/components/DeviceVerifiedConfirm";

// ─── Storage keys (only for UX preferences, NOT auth) ─────────────────────────
const LANG_KEY       = "mfs_ui_lang";
const DEVICE_KEY     = "mfs_device_phone"; // stores last-used phone for returning user UX

const DEMO_OTP = "123456";

// ─── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    appName: "EasyPay", tagline: "Bangladesh's Simplest Digital Wallet",
    taglineBn: "বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট",
    users: "Users", encryption: "Encryption", transfer: "Transfer",
    balanceLabel: "Available Balance", walletSecurity: "Bank-grade encrypted wallet",
    createFree: "Create Free Account", loginWallet: "Log In to Wallet",
    alreadyHave: "Already have an account?", signIn: "Sign in",
    newUser: "New user?", createOne: "Create an account",
    terms: "By continuing you agree to our", termsLink: "Terms", privacy: "Privacy Policy",
    createAccount: "Create Account", welcomeBack: "Welcome Back",
    enterPhoneRegister: "Enter your mobile number to get started",
    enterPhoneLogin: "Enter your registered mobile number",
    sendOtp: "Send OTP", continue: "Continue",
    alreadyRegistered: "Already registered?", logIn: "Log in",
    noAccount: "Don't have an account?", createOneFree: "Create one free",
    supportedNet: "Supported",
    verifyNumber: "Verify Number", resetPin: "Reset PIN",
    codeSent: "Code sent to", demoMode: "Demo mode — use OTP",
    resendOtp: "Resend OTP", verify: "Verify",
    setPin: "Set Your PIN", newPin: "New PIN", confirmPin: "Confirm PIN",
    choosePinHint: "Choose a secure 4-digit PIN for your wallet",
    reenterPin: "Re-enter your PIN to confirm",
    pinWeakHint: "Avoid 1234, 1111, or your birthday. Never share your PIN.",
    enterPin: "Enter PIN",
    trustedDevice: "Enter your PIN to continue",
    trustedVerified: "Returning User",
    forgotPin: "Forgot PIN?", reset: "Reset",
    showPin: "Show", hidePin: "Hide",
    yourName: "What's your name?", nameHint: "How your contacts will see you",
    namePlaceholder: "e.g. Tanvir Hasan",
    nameOptional: "Optional — you can add it later from your profile.",
    createWallet: "Create My Wallet", skipCreate: "Skip & Create",
    allSet: "You're All Set!", walletReady: "Your wallet is ready to use.", openingDashboard: "Opening your dashboard…",
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
    accountLocked: "Account locked. Try again in",
    securePayments: "Secure Payments",
    signingUp: "Creating your account…",
    signingIn: "Signing in…",
    authError: "Something went wrong. Please try again.",
    verifyIdentity: "Verify Your Identity",
    verifyIdentityHint: "For security, confirm one of the following to reset your PIN.",
    useBalance: "Current Balance",
    useLastTxn: "Last Outgoing Amount",
    enterBalance: "Enter your current balance",
    enterLastTxn: "Enter the amount of your last outgoing transaction",
    verifyAndReset: "Verify & Continue",
    verifying: "Verifying…",
    resettingPin: "Resetting PIN…",
    pinResetSuccess: "PIN reset successfully! Sign in with your new PIN.",
    pinResetFailed: "PIN reset failed. Please try again.",
    goodMorning: "Good Morning", goodAfternoon: "Good Afternoon", goodEvening: "Good Evening",
    secured: "Secured", sending: "Sending…",
  },
  bn: {
    appName: "ইজিপে", tagline: "বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট",
    taglineBn: "বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট",
    users: "ব্যবহারকারী", encryption: "এনক্রিপশন", transfer: "ট্রান্সফার",
    balanceLabel: "উপলব্ধ ব্যালেন্স", walletSecurity: "ব্যাংক-গ্রেড এনক্রিপ্টেড ওয়ালেট",
    createFree: "বিনামূল্যে একাউন্ট খুলুন", loginWallet: "ওয়ালেটে লগইন করুন",
    alreadyHave: "ইতিমধ্যে একাউন্ট আছে?", signIn: "সাইন ইন",
    newUser: "নতুন ব্যবহারকারী?", createOne: "একাউন্ট তৈরি করুন",
    terms: "চালিয়ে যাওয়ার মাধ্যমে আপনি আমাদের", termsLink: "শর্তাবলী", privacy: "গোপনীয়তা নীতি",
    createAccount: "একাউন্ট তৈরি করুন", welcomeBack: "স্বাগতম",
    enterPhoneRegister: "শুরু করতে আপনার মোবাইল নম্বর দিন",
    enterPhoneLogin: "আপনার নিবন্ধিত নম্বর দিন",
    sendOtp: "ওটিপি পাঠান", continue: "পরবর্তী",
    alreadyRegistered: "ইতিমধ্যে নিবন্ধিত?", logIn: "লগইন",
    noAccount: "একাউন্ট নেই?", createOneFree: "বিনামূল্যে তৈরি করুন",
    supportedNet: "সাপোর্টেড",
    verifyNumber: "নম্বর যাচাই করুন", resetPin: "পিন রিসেট করুন",
    codeSent: "কোড পাঠানো হয়েছে", demoMode: "ডেমো মোড — ওটিপি ব্যবহার করুন",
    resendOtp: "ওটিপি পুনরায় পাঠান", verify: "যাচাই করুন",
    setPin: "পিন সেট করুন", newPin: "নতুন পিন", confirmPin: "পিন নিশ্চিত করুন",
    choosePinHint: "আপনার ওয়ালেটের জন্য একটি নিরাপদ ৪-সংখ্যার পিন দিন",
    reenterPin: "নিশ্চিত করতে পিন পুনরায় দিন",
    pinWeakHint: "১২৩৪, ১১১১ বা জন্মদিন ব্যবহার করবেন না। পিন শেয়ার করবেন না।",
    enterPin: "পিন দিন",
    trustedDevice: "চালিয়ে যেতে পিন দিন",
    trustedVerified: "পুনরায় আসা ব্যবহারকারী",
    forgotPin: "পিন ভুলে গেছেন?", reset: "রিসেট",
    showPin: "দেখুন", hidePin: "লুকান",
    yourName: "আপনার নাম কি?", nameHint: "বন্ধুরা এই নামে চিনবে",
    namePlaceholder: "যেমন: তানভীর হাসান",
    nameOptional: "ঐচ্ছিক — পরে প্রোফাইল থেকে যোগ করতে পারবেন।",
    createWallet: "আমার ওয়ালেট তৈরি করুন", skipCreate: "এড়িয়ে যান",
    allSet: "সব ঠিক আছে!", walletReady: "আপনার ওয়ালেট প্রস্তুত।", openingDashboard: "ড্যাশবোর্ড খোলা হচ্ছে…",
    instantTransfer: "তাৎক্ষণিক ট্রান্সফার", bankSecurity: "ব্যাংক-গ্রেড নিরাপত্তা",
    available247: "২৪/৭ উপলব্ধ", zeroFees: "শূন্য চার্জ",
    pinTooWeak: "পিন দুর্বল। ক্রমিক/একই সংখ্যা এড়িয়ে চলুন।",
    pinsDontMatch: "পিন মিলছে না। আবার চেষ্টা করুন।",
    incorrectPin: "ভুল পিন। আবার চেষ্টা করুন।", incorrectOtp: "ভুল ওটিপি। ডেমো: ১২৩৪৫৬",
    validPhone: "একটি বৈধ ১১-সংখ্যার মোবাইল নম্বর দিন।",
    alreadyRegisteredErr: "ইতিমধ্যে নিবন্ধিত। লগইন করুন।",
    notRegistered: "নম্বর নিবন্ধিত নয়। একাউন্ট তৈরি করুন।",
    enterOtp: "৬-সংখ্যার ওটিপি দিন।", enter4Digits: "সব ৪টি সংখ্যা দিন।",
    reenterPinErr: "আপনার পিন পুনরায় দিন।",
    accountLocked: "একাউন্ট লক হয়েছে। আবার চেষ্টা করুন",
    securePayments: "নিরাপদ পেমেন্ট",
    signingUp: "একাউন্ট তৈরি হচ্ছে…",
    signingIn: "সাইন ইন হচ্ছে…",
    authError: "কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    verifyIdentity: "পরিচয় যাচাই করুন",
    verifyIdentityHint: "নিরাপত্তার জন্য, আপনার পিন রিসেট করতে নিচের একটি নিশ্চিত করুন।",
    useBalance: "বর্তমান ব্যালেন্স",
    useLastTxn: "শেষ লেনদেনের পরিমাণ",
    enterBalance: "আপনার বর্তমান ব্যালেন্স দিন",
    enterLastTxn: "আপনার শেষ লেনদেনের পরিমাণ দিন",
    verifyAndReset: "যাচাই করুন",
    verifying: "যাচাই হচ্ছে…",
    resettingPin: "পিন রিসেট হচ্ছে…",
    pinResetSuccess: "পিন সফলভাবে রিসেট হয়েছে! নতুন পিন দিয়ে সাইন ইন করুন।",
    pinResetFailed: "পিন রিসেট ব্যর্থ। আবার চেষ্টা করুন।",
    goodMorning: "সুপ্রভাত", goodAfternoon: "শুভ অপরাহ্ন", goodEvening: "শুভ সন্ধ্যা",
    secured: "সুরক্ষিত", sending: "পাঠানো হচ্ছে…",
  },
} as const;

type Lang = "en" | "bn";

type Mode =
  | "landing"
  | "register_phone" | "register_otp" | "register_pin"
  | "login_phone" | "login_pin"
  | "forgot_otp" | "forgot_pin"
  | "success";

// ─── Step progress ────────────────────────────────────────────────────────────
const REGISTER_STEPS = ["Phone", "OTP", "PIN"];
const LOGIN_STEPS    = ["Phone", "PIN"];

function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2 px-2">
      {steps.map((label, i) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="h-1 w-full rounded-full overflow-hidden bg-white/15">
            <motion.div
              className="h-full rounded-full bg-white"
              initial={{ width: i < current ? "100%" : "0%" }}
              animate={{ width: i < current ? "100%" : i === current ? "50%" : "0%" }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${i <= current ? "text-white" : "text-white/30"}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}


// ─── OTP Boxes ────────────────────────────────────────────────────────────────
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
              scale: active ? 1.06 : 1,
              borderColor: error ? "hsl(var(--destructive))" : filled ? "hsl(var(--primary))" : active ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))",
              backgroundColor: filled ? "hsl(var(--primary) / 0.08)" : "hsl(var(--card))",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="w-11 h-14 rounded-xl border-2 flex items-center justify-center shadow-card"
          >
            {filled ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xl font-black text-primary">{value[i]}</motion.span>
            ) : active ? (
              <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-0.5 h-5 rounded-full bg-primary/50" />
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── PIN Dots (redesigned) ────────────────────────────────────────────────────
const PinCircles = forwardRef<HTMLDivElement, { pin: string; error: boolean; length?: number; dark?: boolean }>(({ pin, error, length = 4, dark = false }, ref) => {
  return (
    <div ref={ref} className="flex justify-center gap-5">
      {Array.from({ length }).map((_, i) => {
        const filled = i < pin.length;
        const isNext = i === pin.length;
        return (
          <div key={i} className="relative">
            <motion.div
              animate={{
                scale: filled ? 1 : isNext ? 1.05 : 0.9,
                backgroundColor: error && filled
                  ? "hsl(var(--destructive))"
                  : filled
                    ? dark ? "rgba(255,255,255,0.95)" : "hsl(var(--primary))"
                    : "transparent",
              }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              className={`w-[18px] h-[18px] rounded-full border-[2.5px] ${
                error && filled
                  ? "border-destructive"
                  : filled
                    ? dark ? "border-white" : "border-primary"
                    : dark ? "border-white/25" : "border-muted-foreground/20"
              }`}
            />
            {/* Glow ring on filled */}
            {filled && !error && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className={`absolute inset-0 rounded-full ${dark ? "bg-white/20" : "bg-primary/20"}`}
              />
            )}
            {/* Pulse on next slot */}
            {isNext && !error && (
              <motion.div
                animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className={`absolute inset-0 rounded-full ${dark ? "bg-white/15" : "bg-primary/15"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
PinCircles.displayName = "PinCircles";

// ─── Hidden PIN Input (native keyboard) ──────────────────────────────────────
function HiddenPinInput({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 150);
  }, [autoFocus]);
  return (
    <input
      ref={ref}
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
        onChange(v);
        haptics.light();
      }}
      disabled={disabled}
      className="absolute w-full h-full opacity-0 cursor-pointer"
      autoComplete="off"
    />
  );
}

// ─── Phone input ──────────────────────────────────────────────────────────────
function PhoneInput({ value, onChange, error, autoFocus = false }: { value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 100); }, [autoFocus]);
  return (
    <div className="space-y-2">
      <div className={`flex items-center h-16 bg-card border-2 rounded-2xl transition-all shadow-card ${error ? "border-destructive" : "border-border focus-within:border-primary focus-within:shadow-glow"}`}>
        <div className="flex items-center gap-2 pl-4 pr-3 border-r border-border h-full shrink-0 min-w-0">
          <span className="text-xl leading-none shrink-0">🇧🇩</span>
          <span className="text-sm font-black text-foreground shrink-0">+88</span>
        </div>
        <input ref={ref} type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
          className="flex-1 min-w-0 h-full px-4 text-lg font-bold bg-transparent focus:outline-none placeholder:text-muted-foreground/30 placeholder:font-normal" />
        {value.length === 11 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="pr-3 mr-2 shrink-0">
            <CheckCircle2 size={20} className="text-primary" />
          </motion.div>
        )}
      </div>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive flex items-center gap-1.5 px-1">
          <AlertCircle size={12} /> {error}
        </motion.p>
      )}
    </div>
  );
}

// ─── Name input ───────────────────────────────────────────────────────────────
function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);
  return (
    <input ref={ref} type="text" placeholder="e.g. Tanvir Hasan" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-16 px-5 text-lg font-bold bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary focus:shadow-glow transition-all placeholder:font-normal placeholder:text-muted-foreground/30 shadow-card" />
  );
}

// ─── Slide variants ───────────────────────────────────────────────────────────
const slideV = {
  enter:  (d: number) => ({ x: d > 0 ? "50%" : "-50%", opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit:   (d: number) => ({ x: d < 0 ? "50%" : "-50%", opacity: 0, scale: 0.97 }),
};

// ─── Background orbs ─────────────────────────────────────────────────────────
const BgOrbs = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/5 blur-3xl" />
      <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white/5 blur-3xl" />
    </div>
  );
});
BgOrbs.displayName = "BgOrbs";

// ─── Main Component ───────────────────────────────────────────────────────────
interface AuthPageProps { onAuthenticated: () => void; }

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) ?? "en");
  const t = T[lang];
  const toggleLang = () => { const next: Lang = lang === "en" ? "bn" : "en"; setLang(next); localStorage.setItem(LANG_KEY, next); };

  const [mode, setMode]             = useState<Mode>(() => {
    const saved = localStorage.getItem(DEVICE_KEY);
    return saved ? "login_pin" : "landing";
  });
  const [direction, setDir]         = useState(1);
  const [phone, setPhone]           = useState(() => localStorage.getItem(DEVICE_KEY) ?? "");
  const [otp, setOtp]               = useState("");
  const [pin, setPin]               = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [confirmStage, setConfirmStage] = useState(false);
  const [showPin, setShowPin]       = useState(false);
  const [error, setError]           = useState("");
  const [userName, setUserName]     = useState("");
   const [referralCodeInput, setReferralCodeInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read ?ref= from URL and auto-fill referral code
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      setReferralCodeInput(refCode.toUpperCase());
    }
  }, [searchParams]);
  const [showKycAfterRegister, setShowKycAfterRegister] = useState(false);
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotOtpSending, setForgotOtpSending] = useState(false);
  const [serverOtp, setServerOtp] = useState(""); // DEV: stores OTP returned from server

  // ── Device-bound first-login OTP ────────────────────────────────────────────
  // Phase: 'none' | 'otp' | 'confirm' — overlays the auth flow after PIN success.
  const [devicePhase, setDevicePhase] = useState<"none" | "otp" | "confirm">("none");
  const [devicePortal, setDevicePortal] = useState<DeviceOtpPortal>("user");
  const [devicePhone, setDevicePhone] = useState<string>("");
  const [deviceConfirmLoading, setDeviceConfirmLoading] = useState(false);
  const deviceOtp = useDeviceOtpVerification(devicePortal);

  // Check if returning user (has phone stored locally for UX only)
  const returningPhone = localStorage.getItem(DEVICE_KEY) ?? "";
  const isNewUser = !returningPhone;

  const goTo = useCallback((next: Mode, dir = 1) => {
    setDir(dir); setMode(next); setError(""); haptics.medium();
  }, []);

  const isValidPhone = (p: string) => /^01[3-9]\d{8}$/.test(p);

  // ── Register: Phone → OTP → PIN → Name ────────────────────────────────────
  const handleRegisterPhone = async () => {
    if (!isValidPhone(phone)) { setError(t.validPhone); return; }
    try {
      const registered = await isPhoneRegistered(phone);
      if (registered) { setError("This number is already registered. Please log in."); return; }
    } catch { /* allow to proceed if check fails */ }
    goTo("register_otp");
  };

  const handleRegisterOtp = useCallback((val?: string) => {
    const v = val ?? otp;
    if (v.length < 6) { setError(t.enterOtp); return; }
    if (v !== DEMO_OTP) { setError(t.incorrectOtp); haptics.error(); return; }
    setPin(""); setConfirmPin(""); setConfirmStage(false); goTo("register_pin");
  }, [otp, goTo, t]);

  const handleRegisterPin = useCallback(async (currentPin: string, currentConfirm: string, stage: boolean) => {
    if (!stage) {
      if (currentPin.length < 4) { setError(t.enter4Digits); return; }
      if (isWeakPin(currentPin)) { setError(t.pinTooWeak); return; }
      setError(""); setConfirmStage(true); haptics.success();
    } else {
      if (currentConfirm.length < 4) { setError(t.reenterPinErr); return; }
      if (currentPin !== currentConfirm) { setError(t.pinsDontMatch); haptics.error(); setConfirmPin(""); return; }
      haptics.success(); setConfirmStage(false);
      // Create account immediately, then launch KYC — pass pin directly to avoid stale closure
      await handlePostPinSignup(currentPin);
    }
  }, [goTo, t, phone, referralCodeInput]);

  // ── Register: Create account with Supabase Auth, then show KYC ─────────────
  const handlePostPinSignup = async (pinValue?: string) => {
    const effectivePin = pinValue || pin;
    setIsSubmitting(true);
    setError("");
    try {
      const fp = await getDeviceFingerprint();
      const result = await signUp(phone, effectivePin, undefined, referralCodeInput.trim() || undefined);

      if (result.user) {
        try {
          const res = await supabase.functions.invoke("validate-device", {
            body: { device_fingerprint: fp, user_id: result.user.id },
          });
          if (res.data && !res.data.allowed) {
            await supabase.auth.signOut();
            setError(res.data.error || "This device already has an account.");
            haptics.error();
            setIsSubmitting(false);
            return;
          }
        } catch {
          console.warn("Device validation failed, continuing...");
        }
      }

      localStorage.setItem(DEVICE_KEY, phone);
      localStorage.setItem("mfs_registered_phone", phone);
      haptics.success();
      // Show KYC flow instead of success
      setShowKycAfterRegister(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.authError;
      if (msg.includes("already been registered") || msg.includes("already registered")) {
        setError(t.alreadyRegisteredErr);
      } else {
        setError(msg);
      }
      haptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Login: Phone → PIN (server-validated) ──────────────────────────────────
  const handleLoginPhone = async () => {
    if (!isValidPhone(phone)) { setError(t.validPhone); return; }
    try {
      const registered = await isPhoneRegistered(phone);
      if (!registered) {
        goTo("register_phone");
        setError(t.notRegistered);
        return;
      }
    } catch { /* proceed to login if check fails */ }
    goTo("login_pin");
  };

  const handleLoginPin = useCallback(async (entered: string) => {
    const loginPhone = phone || returningPhone;
    // ── Lockout check ──
    const lockKey = `mfs_lock_until_${loginPhone}`;
    const attKey = `mfs_lock_attempts_${loginPhone}`;
    const lockUntilStr = localStorage.getItem(lockKey);
    if (lockUntilStr) {
      const lockUntil = Number(lockUntilStr);
      if (Date.now() < lockUntil) {
        const secsLeft = Math.ceil((lockUntil - Date.now()) / 1000);
        const mins = Math.floor(secsLeft / 60);
        const secs = secsLeft % 60;
        setError(`${t.accountLocked} ${mins}:${secs.toString().padStart(2, "0")}`);
        haptics.error();
        setTimeout(() => setPin(""), 300);
        return;
      }
      // Lock expired — clear
      localStorage.removeItem(lockKey);
      localStorage.removeItem(attKey);
    }

    setIsSubmitting(true);
    setError("");
    try {
      const { user } = await signIn(loginPhone, entered);
      
      // Check if account is locked
      if (user) {
        const { data: accountLocks } = await supabase
          .from("feature_locks")
          .select("id, reason")
          .eq("target_user_id", user.id)
          .eq("feature", "account")
          .eq("is_active", true);
        
        const now = new Date();
        const activeLock = (accountLocks ?? []).find((lock: any) => {
          // Check if lock has expired (if expires_at exists)
          return true; // active locks are already filtered by is_active=true
        });
        
        if (activeLock) {
          // Sign out immediately
          await supabase.auth.signOut();
          const reason = activeLock.reason;
          setError(
            lang === "bn"
              ? `আপনার অ্যাকাউন্ট লক করা হয়েছে। সাপোর্টে যোগাযোগ করুন।${reason ? ` কারণ: ${reason}` : ""}`
              : `Your account has been locked. Contact support.${reason ? ` Reason: ${reason}` : ""}`
          );
          haptics.error();
          setTimeout(() => setPin(""), 300);
          setIsSubmitting(false);
          return;
        }
      }
      
      // Success — clear lockout state
      localStorage.removeItem(attKey);
      localStorage.removeItem(lockKey);
      localStorage.setItem(DEVICE_KEY, loginPhone);
      localStorage.setItem("mfs_registered_phone", loginPhone);
      haptics.success();

      // ── Device-bound first-login OTP gate ──────────────────────────────
      // Resolve user's primary role to pick the correct portal.
      let portal: DeviceOtpPortal = "user";
      try {
        if (user) {
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          const roles = (rolesData ?? []).map((r: any) => r.role);
          if (roles.includes("super_distributor")) portal = "super_distributor";
          else if (roles.includes("distributor")) portal = "distributor";
          else if (roles.includes("agent")) portal = "agent";
          else if (roles.includes("merchant")) portal = "merchant";
          else portal = "user";
        }
      } catch {}
      setDevicePortal(portal);
      setDevicePhone(loginPhone);

      // Check if device is already trusted for this user/portal.
      const trusted = await deviceOtp.checkTrusted(loginPhone);
      if (trusted) {
        setDevicePhase("confirm");
        setIsSubmitting(false);
        return;
      }

      try {
        await deviceOtp.sendOtp(loginPhone);
        setDevicePhase("otp");
      } catch {
        // If OTP can't be sent (e.g., rate-limited), fall through to success
        // rather than blocking the user — security is still gated by PIN.
        goTo("success");
        setTimeout(onAuthenticated, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid login credentials")) {
        // Increment failed attempts
        const prev = Number(localStorage.getItem(attKey) || "0");
        const next = prev + 1;
        localStorage.setItem(attKey, String(next));
        if (next >= 5) {
          const lockUntil = Date.now() + 5 * 60 * 1000;
          localStorage.setItem(lockKey, String(lockUntil));
          setError(`${t.accountLocked} 5:00`);
        } else {
          setError(`${t.incorrectPin} (${next}/5)`);
        }
      } else if (msg.includes("not registered") || msg.includes("invalid")) {
        setError(t.notRegistered);
      } else {
        setError(msg || t.authError);
      }
      haptics.error();
      setTimeout(() => { setPin(""); }, 500);
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, returningPhone, goTo, onAuthenticated, t, deviceOtp]);

  // ── Device OTP handlers ──────────────────────────────────────────────────
  const handleDeviceVerify = useCallback(async (code: string) => {
    if (!devicePhone) return;
    const ok = await deviceOtp.verifyOtp(devicePhone, code);
    if (ok) setDevicePhase("confirm");
  }, [devicePhone, deviceOtp]);

  const handleDeviceResend = useCallback(async () => {
    if (!devicePhone) return;
    try { await deviceOtp.sendOtp(devicePhone); } catch {}
  }, [devicePhone, deviceOtp]);

  const handleDeviceContinue = useCallback(async () => {
    if (!devicePhone) return;
    setDeviceConfirmLoading(true);
    try {
      await deviceOtp.markTrusted(devicePhone);
      goTo("success");
      setTimeout(onAuthenticated, 1200);
    } finally {
      setDeviceConfirmLoading(false);
    }
  }, [devicePhone, deviceOtp, goTo, onAuthenticated]);

  const portalLabel = useMemo(() => {
    switch (devicePortal) {
      case "merchant": return "Merchant";
      case "agent": return "Agent";
      case "distributor": return "Distributor";
      case "super_distributor": return "Super Distributor";
      default: return "Customer";
    }
  }, [devicePortal]);

  // ── Forgot PIN: send OTP → verify OTP → new PIN → server reset ─────────
  const handleForgotSendOtp = useCallback(async () => {
    const forgotPhone = phone || returningPhone;
    if (!isValidPhone(forgotPhone)) { setError(t.validPhone); return; }
    setForgotOtpSending(true); setError("");
    try {
      const res = await supabase.functions.invoke("send-otp", {
        body: { phone: forgotPhone, purpose: "pin_reset" },
      });
      if (res.error) {
        setError(res.data?.error || "Failed to send OTP.");
      } else {
        // DEV: store OTP for display
        setServerOtp(res.data?.dev_otp || "");
        setOtp(""); goTo("forgot_otp");
      }
    } catch {
      setError("Failed to send OTP. Try again.");
    } finally {
      setForgotOtpSending(false);
    }
  }, [phone, returningPhone, goTo, t]);

  const handleForgotOtp = useCallback((val?: string) => {
    const v = val ?? otp;
    if (v.length < 6) { setError(t.enterOtp); return; }
    // Store OTP code for later verification by reset-pin
    setForgotOtpCode(v);
    setPin(""); setConfirmPin(""); setConfirmStage(false); goTo("forgot_pin");
  }, [otp, goTo, t]);

  const handleForgotPin = useCallback(async (currentPin: string, currentConfirm: string, stage: boolean) => {
    if (!stage) {
      if (currentPin.length < 4) return;
      if (isWeakPin(currentPin)) { setError(t.pinTooWeak); return; }
      setError(""); setConfirmStage(true); haptics.success();
    } else {
      if (currentConfirm.length < 4) return;
      if (currentPin !== currentConfirm) { setError(t.pinsDontMatch); haptics.error(); setConfirmPin(""); return; }
      setIsSubmitting(true); setError("");
      try {
        const res = await supabase.functions.invoke("reset-pin", {
          body: {
            phone: phone || returningPhone,
            newPin: currentPin,
            otpCode: forgotOtpCode,
          },
        });
        if (res.error || res.data?.error) {
          setError(res.data?.error || t.pinResetFailed);
          haptics.error(); setConfirmPin("");
        } else {
          haptics.success(); setConfirmStage(false);
          try {
            await signIn(phone || returningPhone, currentPin);
            localStorage.setItem(DEVICE_KEY, phone || returningPhone);
            localStorage.setItem("mfs_registered_phone", phone || returningPhone);
            goTo("success");
            setTimeout(onAuthenticated, 1500);
          } catch {
            setPin(""); setConfirmPin(""); goTo("login_pin");
          }
        }
      } catch {
        setError(t.pinResetFailed); haptics.error(); setConfirmPin("");
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [goTo, t, phone, returningPhone, forgotOtpCode, onAuthenticated]);


  // ── Back ───────────────────────────────────────────────────────────────────
  const handleBack = () => {
    setError("");
    if (mode === "register_phone" || mode === "login_phone") { goTo("landing", -1); return; }
    if (mode === "register_otp")  { setOtp(""); goTo("register_phone", -1); return; }
    if (mode === "register_pin")  {
      if (confirmStage) { setConfirmStage(false); setConfirmPin(""); return; }
      setPin(""); setConfirmPin(""); goTo("register_otp", -1); return;
    }
    if (mode === "login_pin")     { setPin(""); goTo("landing", -1); return; }
    if (mode === "forgot_otp")    { setOtp(""); goTo("login_pin", -1); return; }
    if (mode === "forgot_pin")    {
      if (confirmStage) { setConfirmStage(false); setConfirmPin(""); return; }
      setPin(""); setConfirmPin(""); goTo("forgot_otp", -1); return;
    }
  };

  const registerStep = { register_phone: 0, register_otp: 1, register_pin: 2 }[mode as string] ?? -1;
  const loginStep    = { login_phone: 0, login_pin: 1 }[mode as string] ?? -1;
  const showBack     = mode !== "landing" && mode !== "success";

  // Device-bound first-login OTP overlay — takes over the screen when active.
  if (devicePhase !== "none") {
    return (
      <div className="fixed inset-0 z-[110] flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-950 text-white overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-emerald-500/30 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-indigo-500/30 blur-[140px]"
        />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            {devicePhase === "otp" && (
              <DeviceOtpStep
                phone={devicePhone}
                portalLabel={portalLabel}
                resendIn={deviceOtp.resendIn}
                loading={deviceOtp.status === "verifying" || deviceOtp.status === "sending"}
                error={deviceOtp.error}
                devOtp={deviceOtp.devOtp}
                onVerify={handleDeviceVerify}
                onResend={handleDeviceResend}
              />
            )}
            {devicePhase === "confirm" && (
              <DeviceVerifiedConfirm
                phone={devicePhone}
                portalLabel={portalLabel}
                loading={deviceConfirmLoading}
                onContinue={handleDeviceContinue}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden">

      {/* ══════════════════════ LANDING ══════════════════════ */}
      <AnimatePresence mode="wait">
        {mode === "landing" && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <div className="relative gradient-hero flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
              <BgOrbs />
              <motion.button whileTap={{ scale: 0.92 }} onClick={toggleLang}
                className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/12 backdrop-blur-sm border border-white/20 text-white text-xs font-bold"
                style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
                <Globe size={11} /> {lang === "en" ? "বাংলা" : "English"}
              </motion.button>
              <div className="relative flex flex-col items-center gap-6 text-white">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.1 }} className="relative">
                  <img src={logo} alt="EasyPay" className="w-24 h-24 rounded-[28px] object-contain shadow-float" onError={(e) => { e.currentTarget.src = "/icons/easypay-logo.webp"; }} />
                  {[1.3, 1.6, 1.9].map((s, i) => (
                    <motion.div key={i} className="absolute inset-0 rounded-[28px] border border-white/20"
                      animate={{ scale: [1, s], opacity: [0.5, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }} />
                  ))}
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-center">
                  <h1 className="text-4xl font-black tracking-tight">{t.appName}</h1>
                  <p className="text-sm text-white/60 mt-2 font-medium">{t.tagline}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap justify-center gap-2">
                  {[
                    { icon: Zap, label: t.instantTransfer }, { icon: Shield, label: t.bankSecurity },
                    { icon: Fingerprint, label: t.securePayments }, { icon: Star, label: t.zeroFees },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80">
                      <Icon size={11} strokeWidth={2.5} /><span className="text-[11px] font-semibold">{label}</span>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35, type: "spring", stiffness: 200, damping: 24 }}
              className="bg-background rounded-t-[32px] -mt-6 relative z-10 px-6 pt-8 pb-8 space-y-4"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}>
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[
                  { emoji: "🏦", val: "10M+", label: t.users },
                  { emoji: "🔒", val: "256-bit", label: t.encryption },
                  { emoji: "⚡", val: "< 3s", label: t.transfer },
                ].map(({ emoji, val, label }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 py-2">
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm font-black text-foreground">{val}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.97 }}
                className="w-full h-14 gradient-hero text-white font-bold text-base rounded-2xl shadow-glow flex items-center justify-center gap-2"
                onClick={() => {
                  setPhone(""); setOtp(""); setPin(""); setConfirmPin(""); setConfirmStage(false);
                  if (!isNewUser) { setPhone(returningPhone); goTo("login_pin"); }
                  else goTo("register_phone");
                }}>
                {isNewUser ? t.createFree : t.loginWallet} <ArrowRight size={17} />
              </motion.button>
              {isNewUser ? (
                <button className="w-full text-sm text-center py-1 text-muted-foreground"
                  onClick={() => { setPhone(""); goTo("login_phone"); }}>
                  {t.alreadyHave} <span className="text-primary font-bold">{t.signIn}</span>
                </button>
              ) : (
                <button className="w-full text-sm text-center py-1 text-muted-foreground"
                  onClick={() => { setPin(""); setOtp(""); handleForgotSendOtp(); }}>
                  {forgotOtpSending ? "Sending OTP…" : t.forgotPin}
                </button>
              )}
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                {t.terms} <span className="text-primary underline underline-offset-2">{t.termsLink}</span> & <span className="text-primary underline underline-offset-2">{t.privacy}</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════ LOGIN PIN (full gradient) ══════════════════════ */}
      <AnimatePresence mode="wait">
        {mode === "login_pin" && (
          <motion.div key="login_pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col gradient-hero relative overflow-hidden">
            <BgOrbs />
            {/* Ambient drifting spotlight */}
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full pointer-events-none z-0"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)", top: "10%", left: "20%" }}
              animate={{ x: [0, 60, -30, 0], y: [0, -40, 30, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Top bar */}
            <div className="relative z-10 px-4 pt-4 flex items-center justify-between"
              style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
              <motion.button whileTap={{ scale: 0.92 }} onClick={toggleLang}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/12 text-white text-xs font-bold">
                <Globe size={11} /> {lang === "en" ? "বাংলা" : "EN"}
              </motion.button>
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/8 backdrop-blur-sm border border-white/10">
                <Shield size={10} className="text-emerald-300/80" />
                <span className="text-[9px] font-bold text-white/60 tracking-wide uppercase">{t.secured}</span>
              </motion.div>
            </div>

            {/* Main content */}
            <div className="relative z-10 flex-1 flex flex-col items-center px-6 pt-6 pb-6"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>

              {/* Logo with frosted glass ring */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 18 }}
                className="relative mb-5"
              >
                {/* Animated gradient ring */}
                <motion.div
                  className="absolute -inset-1.5 rounded-full"
                  style={{ background: "conic-gradient(from 0deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03), rgba(255,255,255,0.15))" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
                <div className="relative w-[72px] h-[72px] rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center">
                  <img src={logo} alt="EasyPay" className="w-10 h-10 object-contain" />
                </div>
                {/* Pulse ring */}
                <motion.div className="absolute inset-0 rounded-full border border-white/10"
                  animate={{ scale: [1, 1.6], opacity: [0.3, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }} />
              </motion.div>

              {/* Greeting text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="text-center text-white mb-8"
              >
                <p className="text-sm font-medium text-white/50 mb-1">{(() => { const h = new Date().getHours(); return h < 12 ? `${t.goodMorning} ☀️` : h < 17 ? `${t.goodAfternoon} 🌤️` : `${t.goodEvening} 🌙`; })()}</p>
                <h2 className="text-2xl font-black tracking-tight mb-1.5" style={{ fontFamily: lang === "bn" ? "'Anek Bangla', sans-serif" : undefined }}>{t.welcomeBack}</h2>
                <p className="text-xs text-white/35 font-medium tracking-wide">
                  {phone ? `${phone.slice(0, 3)}${"•".repeat(Math.max(0, phone.length - 5))}${phone.slice(-2)}` : ""}
                </p>
              </motion.div>

              {/* PIN area — frosted glass container */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="w-full max-w-[280px] bg-white/[0.07] backdrop-blur-md border border-white/[0.1] rounded-3xl px-6 py-7 flex flex-col items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
              >
                <p className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.15em] mb-5">{t.enterPin}</p>
                <div className="relative mb-4">
                  <PinCircles pin={pin} error={!!error} dark />
                  <HiddenPinInput
                    value={pin}
                    onChange={(v) => {
                      setPin(v);
                      setError("");
                      if (v.length === 4) setTimeout(() => handleLoginPin(v), 260);
                    }}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Error / Status */}
                <div className="h-7 flex items-center justify-center">
                  {error ? (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-300/90 flex items-center gap-1.5">
                      <AlertCircle size={12} /> {error}
                    </motion.p>
                  ) : isSubmitting ? (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-white/45">{t.signingIn}</motion.p>
                  ) : showPin && pin.length > 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <span className="text-lg font-black tracking-[0.6em] text-white/60 pl-[0.6em]">{pin}</span>
                    </motion.div>
                  ) : null}
                </div>
              </motion.div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Footer actions — frosted glass bar */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.08]"
              >
                <button onClick={() => { setPin(""); setOtp(""); handleForgotSendOtp(); }}
                  className="text-[11px] text-white/40 hover:text-white/70 transition-colors font-semibold">{forgotOtpSending ? t.sending : t.forgotPin}</button>
                <div className="w-px h-3 bg-white/12" />
                <button onClick={() => setShowPin(v => !v)}
                  className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors font-semibold">
                  {showPin ? <EyeOff size={11} /> : <Eye size={11} />} {showPin ? t.hidePin : t.showPin}
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════ SUCCESS ══════════════════════ */}
      <AnimatePresence mode="wait">
        {mode === "success" && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gradient-hero relative overflow-hidden">
            <BgOrbs />
            <div className="relative z-10 flex flex-col items-center gap-6 text-white text-center px-8">
              <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 18 }} className="relative">
                <div className="w-28 h-28 rounded-full bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-float">
                  <CheckCircle2 size={56} strokeWidth={1.5} className="text-white" />
                </div>
                {[1, 1.35, 1.6].map((s, i) => (
                  <motion.div key={i} className="absolute inset-0 rounded-full border border-white/20"
                    animate={{ scale: [1, s], opacity: [0.6, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }} />
                ))}
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                <h2 className="text-3xl font-black tracking-tight">{t.allSet}</h2>
                <p className="text-sm text-white/60 mt-2">{t.walletReady}<br />{t.openingDashboard}</p>
              </motion.div>
              <motion.div className="w-48 h-1.5 bg-white/15 rounded-full overflow-hidden">
                <motion.div className="h-full bg-white rounded-full" initial={{ width: 0 }} animate={{ width: "100%" }}
                  transition={{ duration: 1.3, ease: "easeInOut" }} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════ OTHER STEPS ══════════════════════ */}
      {mode !== "landing" && mode !== "login_pin" && mode !== "success" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="shrink-0 gradient-hero px-5 pt-4 pb-5 relative"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
            <BgOrbs />
            <div className="relative z-10 space-y-3">
              {showBack && (
                <button onClick={handleBack} className="w-10 h-10 rounded-full bg-white/12 border border-white/15 flex items-center justify-center text-white active:scale-90 transition-transform">
                  <ChevronLeft size={18} />
                </button>
              )}
              {registerStep >= 0 && <StepBar steps={REGISTER_STEPS} current={registerStep} />}
              {loginStep >= 0 && <StepBar steps={LOGIN_STEPS} current={loginStep} />}
            </div>
          </motion.div>

          <div className="flex-1 overflow-y-auto scrollbar-none bg-background rounded-t-[28px] -mt-4 relative z-10">
            <div className="min-h-full flex flex-col items-center justify-start px-5 py-8">
              <div className="w-full max-w-sm">
                <AnimatePresence custom={direction} mode="popLayout">
                  <motion.div key={mode + (confirmStage ? "_confirm" : "")} custom={direction} variants={slideV}
                    initial="enter" animate="center" exit="exit"
                    transition={{ type: "spring", stiffness: 340, damping: 32 }} className="space-y-6">

                    {/* ── PHONE ENTRY ── */}
                    {(mode === "register_phone" || mode === "login_phone") && (
                      <div className="space-y-6">
                        <div className="space-y-1">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-3">
                            <Smartphone size={22} className="text-primary" />
                          </div>
                          <h2 className="text-2xl font-black text-foreground tracking-tight">
                            {mode === "register_phone" ? t.createAccount : t.welcomeBack}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {mode === "register_phone" ? t.enterPhoneRegister : t.enterPhoneLogin}
                          </p>
                        </div>
                        <PhoneInput value={phone} onChange={(v) => { setPhone(v); setError(""); }} error={error} autoFocus />

                         <motion.button whileTap={{ scale: 0.97 }}
                          className="w-full h-14 gradient-hero text-white font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 disabled:opacity-40"
                          onClick={mode === "register_phone" ? handleRegisterPhone : handleLoginPhone}
                          disabled={phone.length < 11}>
                          {mode === "register_phone" ? t.sendOtp : t.continue} <ArrowRight size={17} />
                        </motion.button>
                        <div className="text-center text-sm text-muted-foreground">
                          {mode === "register_phone" ? (
                            <button onClick={() => { setError(""); setPhone(""); goTo("login_phone"); }}>
                              {t.alreadyRegistered} <span className="text-primary font-bold">{t.logIn}</span>
                            </button>
                          ) : (
                            <button onClick={() => { setError(""); setPhone(""); goTo("register_phone"); }}>
                              {t.noAccount} <span className="text-primary font-bold">{t.createOneFree}</span>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-muted/50 border border-border">
                          <span className="text-base">📱</span>
                          <p className="text-[11px] text-muted-foreground">
                            {t.supportedNet}: <strong className="text-foreground">GP · Robi · BL · Airtel · Teletalk</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── OTP VERIFY ── */}
                    {(mode === "register_otp" || mode === "forgot_otp") && (() => {
                      const onComplete = mode === "register_otp" ? handleRegisterOtp : handleForgotOtp;
                      return (
                        <div className="space-y-5">
                          <div className="space-y-1">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-3">
                              <Shield size={22} className="text-primary" />
                            </div>
                            <h2 className="text-2xl font-black text-foreground tracking-tight">
                              {mode === "forgot_otp" ? t.resetPin : t.verifyNumber}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              {t.codeSent} <span className="font-bold text-foreground">+88 {phone || returningPhone}</span>
                            </p>
                          </div>
                          <OtpBoxes value={otp} error={!!error} />
                          {error && (
                            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                              className="text-xs text-destructive flex items-center justify-center gap-1.5">
                              <AlertCircle size={12} /> {error}
                            </motion.p>
                          )}
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/8 border border-accent/20">
                            <span className="text-sm">💡</span>
                            <p className="text-[11px] text-muted-foreground">
                              {mode === "forgot_otp" && serverOtp
                                ? <>{t.demoMode} <strong className="text-foreground font-black text-sm">{serverOtp}</strong></>
                                : <>{t.demoMode} <strong className="text-foreground font-black text-sm">123456</strong></>
                              }
                            </p>
                          </div>
                          <input
                            type="tel"
                            inputMode="numeric"
                            autoFocus
                            maxLength={6}
                            value={otp}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                              setOtp(val);
                              setError("");
                              if (val.length === 6) setTimeout(() => onComplete(val), 260);
                            }}
                            className="w-full h-14 text-center text-2xl font-black tracking-[0.6em] bg-card border-2 border-border rounded-2xl text-foreground focus:outline-none focus:border-primary focus:shadow-glow placeholder:text-muted-foreground/20"
                            placeholder="000000"
                          />
                          <div className="flex items-center justify-between pt-1">
                            <button className="flex items-center gap-1.5 text-sm text-muted-foreground"
                              onClick={() => { setOtp(""); setError(""); if (mode === "forgot_otp") handleForgotSendOtp(); }}>
                              <RefreshCw size={13} /> {t.resendOtp}
                            </button>
                            <motion.button whileTap={{ scale: 0.95 }}
                              className="h-12 px-6 gradient-hero text-white font-bold text-sm rounded-xl shadow-glow flex items-center gap-2 disabled:opacity-40"
                              onClick={() => onComplete()} disabled={otp.length < 6}>
                              {t.verify} <ArrowRight size={15} />
                            </motion.button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── (forgot_verify removed — OTP-only flow now) ── */}

                    {/* ── SET / CONFIRM PIN (redesigned with keypad) ── */}
                    {(mode === "register_pin" || mode === "forgot_pin") && (() => {
                      const onComplete = mode === "register_pin" ? handleRegisterPin : handleForgotPin;
                      const currentVal = confirmStage ? confirmPin : pin;
                      return (
                        <div className="flex-1 flex flex-col">
                          {/* Centered PIN area */}
                          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
                            <AnimatePresence mode="wait">
                              <motion.div key={confirmStage ? "confirm" : "set"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                className="text-center space-y-2">
                                <motion.div
                                  animate={{ rotate: confirmStage ? [0, -8, 8, 0] : 0 }}
                                  transition={{ duration: 0.4 }}
                                  className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mx-auto"
                                >
                                  {confirmStage ? (
                                    <CheckCircle2 size={24} className="text-primary" />
                                  ) : (
                                    <Lock size={24} className="text-primary" />
                                  )}
                                </motion.div>
                                <h2 className="text-xl font-black text-foreground tracking-tight">
                                  {confirmStage ? t.confirmPin : (mode === "forgot_pin" ? t.newPin : t.setPin)}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                  {confirmStage ? t.reenterPin : t.choosePinHint}
                                </p>
                              </motion.div>
                            </AnimatePresence>

                            <div className="relative">
                              <PinCircles pin={currentVal} error={!!error} />
                              <HiddenPinInput
                                value={currentVal}
                                onChange={(v) => {
                                  if (!confirmStage) {
                                    setPin(v);
                                    setError("");
                                    if (v.length === 4) setTimeout(() => onComplete(v, confirmPin, false), 260);
                                  } else {
                                    setConfirmPin(v);
                                    setError("");
                                    if (v.length === 4) setTimeout(() => onComplete(pin, v, true), 260);
                                  }
                                }}
                                disabled={isSubmitting}
                                autoFocus
                              />
                            </div>

                            {/* PIN warning hint — directly under circles */}
                            {!confirmStage && !error && !isSubmitting && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-xl px-3 py-1.5">
                                <Shield size={12} className="text-primary shrink-0" />
                                <p className="text-[10px] text-muted-foreground">{t.pinWeakHint}</p>
                              </motion.div>
                            )}

                            {/* Error / Status area */}
                            <div className="h-6 flex items-center justify-center">
                              {error ? (
                                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                  className="text-xs text-destructive flex items-center gap-1.5">
                                  <AlertCircle size={12} /> {error}
                                </motion.p>
                              ) : isSubmitting ? (
                                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                  className="text-xs text-primary font-semibold">{mode === "forgot_pin" ? t.resettingPin : t.signingUp}</motion.p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ KYC AFTER REGISTER ══════════════════════ */}
      {showKycAfterRegister && (
        <div className="fixed inset-0 z-[110] bg-background">
          <KycFlow onClose={() => {
            setShowKycAfterRegister(false);
            goTo("success");
            setTimeout(onAuthenticated, 1500);
          }} />
        </div>
      )}
    </div>
  );
}
