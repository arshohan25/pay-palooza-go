import { useState, useRef, useEffect } from "react";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { recordTransaction } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { checkDailyLimit } from "@/lib/dailyLimits";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";
import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import {
  ChevronLeft, CheckCircle2, AlertCircle,
  Landmark, CreditCard, Lock, ChevronRight,
  Copy, CheckCheck, Shield, Info, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import FeatureGuard from "@/components/FeatureGuard";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "amount" | "source" | "details" | "pin" | "processing" | "success";
type Source = "bank" | "card" | "mfs";

// ─── MFS Providers ───────────────────────────────────────────────────────────
interface MfsProvider {
  id: string;
  name: string;
  short: string;
  color: string;
  gradient: string;
  accountLabel: string;
  accountPlaceholder: string;
  accountMaxLength: number;
}

const MFS_PROVIDERS: MfsProvider[] = [
  { id: "bkash",    name: "bKash",          short: "bK", color: "#E2136E", gradient: "bg-[#E2136E]", accountLabel: "bKash Number",    accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
  { id: "nagad",    name: "Nagad",           short: "Ng", color: "#F6921E", gradient: "bg-[#F6921E]", accountLabel: "Nagad Number",    accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
  { id: "asthapay", name: "AsthaPay",        short: "AP", color: "#6C3FC5", gradient: "bg-[#6C3FC5]", accountLabel: "AsthaPay Number", accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
  { id: "rocket",   name: "Rocket (DBBL)",   short: "Rk", color: "#8B2F8B", gradient: "bg-[#8B2F8B]", accountLabel: "Rocket Number",   accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
  { id: "upay",     name: "Upay",            short: "Up", color: "#00A859", gradient: "bg-[#00A859]", accountLabel: "Upay Number",     accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
  { id: "tap",      name: "Tap",             short: "Tp", color: "#1A73E8", gradient: "bg-[#1A73E8]", accountLabel: "Tap Number",      accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
  { id: "mcash",    name: "mCash",           short: "mC", color: "#FF6600", gradient: "bg-[#FF6600]", accountLabel: "mCash Number",    accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
  { id: "islamic",  name: "Islamic Wallet",  short: "IW", color: "#2E7D32", gradient: "bg-[#2E7D32]", accountLabel: "Wallet Number",   accountPlaceholder: "01XXXXXXXXX", accountMaxLength: 11 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

const BANK_LIST = [
  { id: "dbbl",   name: "Dutch-Bangla Bank",  short: "DB", gradient: "gradient-payment" },
  { id: "brac",   name: "BRAC Bank",           short: "BR", gradient: "gradient-send" },
  { id: "city",   name: "City Bank",           short: "CB", gradient: "gradient-accent" },
  { id: "islami", name: "Islami Bank",         short: "IB", gradient: "gradient-addmoney" },
  { id: "ucb",    name: "UCB",                 short: "UC", gradient: "gradient-cashout" },
  { id: "ab",     name: "AB Bank",             short: "AB", gradient: "gradient-primary" },
];

// Receiving bank details (fixed – the wallet's linked account)
const RECEIVE_ACCOUNT = {
  bank: "Sonali Bank PLC",
  branch: "Motijheel, Dhaka",
  accountName: "EasyPay Ltd.",
  accountNo: "2031 0400 4321",
  routing: "200270423",
};

const generateTxnId = () => {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "";
  for (let i = 0; i < 12; i++) r += CHARS[Math.floor(Math.random() * 36)];
  return r;
};

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS: Step[] = ["amount", "source", "details", "pin"];
const STEP_LABELS: Record<Step, string> = {
  amount: "Amount", source: "Source", details: "Details", pin: "PIN", processing: "Processing", success: "Done",
};

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── PIN dots (system keyboard, no numpad) ────────────────────────────────────
const PinDots = ({ length }: { length: number }) => (
  <div className="flex justify-center gap-5">
    {[0, 1, 2, 3].map((i) => (
      <motion.div
        key={i}
        animate={{ scale: length > i ? 1.25 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={`w-5 h-5 rounded-full border-2 transition-colors ${
          length > i
            ? "gradient-addmoney border-transparent shadow-md"
            : "border-muted-foreground/30 bg-transparent"
        }`}
      />
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
interface AddMoneyFlowProps { onClose: () => void; }

const AddMoneyFlow = ({ onClose }: AddMoneyFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]       = useState<Step>("amount");
  const [direction, setDir]   = useState(1);
  const [amount, setAmount]   = useState("");
  const [source, setSource]   = useState<Source | null>(null);
  const [bank, setBank]       = useState<typeof BANK_LIST[0] | null>(null);
  const [mfsProvider, setMfsProvider] = useState<MfsProvider | null>(null);
  const [mfsAccount, setMfsAccount]   = useState("");
  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName]     = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv]       = useState("");
  // PIN
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState("");
  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showShare, setShowShare]     = useState(false);

  const txnId   = useRef(generateTxnId());
  const txnTime = useRef(new Date());

  useEffect(() => { if (step === "success") { fireSuccessConfetti(); addTxnNotif(); } }, [step]);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step, dir = 1) => {
    setDir(STEPS.indexOf(next) > stepIndex ? 1 : dir);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "amount")  { onClose(); return; }
    if (step === "source")  { goTo("amount", -1); return; }
    if (step === "details") { goTo("source", -1); return; }
    if (step === "pin")     { goTo("details", -1); return; }
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 10)    { setError("Minimum add money is ৳10."); return; }
    if (val > 100000){ setError("Maximum single transaction is ৳1,00,000."); return; }
    goTo("source");
  };

  const handleSourceContinue = () => {
    if (!source) { setError("Please select a funding source."); return; }
    if (source === "bank" && !bank) { setError("Please select your bank."); return; }
    if (source === "mfs" && !mfsProvider) { setError("Please select a payment provider."); return; }
    goTo("details");
  };

  const handleDetailsContinue = () => {
    if (source === "bank") {
      goTo("pin");
      return;
    }
    if (source === "mfs") {
      const raw = mfsAccount.replace(/\D/g, "");
      if (raw.length < 11) { setError(`Enter a valid ${mfsProvider?.accountLabel ?? "account number"}.`); return; }
      goTo("pin");
      return;
    }
    // Card validation
    const raw = cardNumber.replace(/\s/g, "");
    if (raw.length < 15) { setError("Enter a valid card number."); return; }
    if (!cardName.trim()) { setError("Enter the name on card."); return; }
    if (cardExpiry.length < 5) { setError("Enter a valid expiry (MM/YY)."); return; }
    if (cardCvv.length < 3)   { setError("Enter a valid CVV."); return; }
    goTo("pin");
  };

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    if (processing) return;
    setProcessing(true);

    // Verify PIN
    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }

    // Check daily limit
    const addAmt = parseFloat(amount) || 0;
    const limitCheck = await checkDailyLimit("addmoney", addAmt);
    if (!limitCheck.allowed) {
      setError(`Daily limit exceeded. Used ৳${limitCheck.used.toLocaleString()} of ৳${limitCheck.limit.toLocaleString()} today.`);
      setProcessing(false);
      return;
    }

    haptics.success();

    // For bKash, Nagad, and AsthaPay, attempt real gateway integration
    if (source === "mfs" && (mfsProvider?.id === "bkash" || mfsProvider?.id === "nagad" || mfsProvider?.id === "asthapay")) {
      setDir(1);
      setStep("processing");

      try {
        const functionName = mfsProvider.id === "bkash" ? "bkash-payment" : mfsProvider.id === "asthapay" ? "asthapay-payment" : "nagad-payment";
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          setError("Please log in to continue.");
          setStep("pin");
          setProcessing(false);
          return;
        }

        // Step 1: Create payment session on gateway
        const createRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/${functionName}?action=create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              amount: String(addAmt),
              payerReference: mfsAccount,
              callbackURL: window.location.origin,
            }),
          }
        );

        const contentType = createRes.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          const textResponse = await createRes.text();
          console.error("Gateway returned non-JSON:", textResponse.substring(0, 200));
          throw new Error("Payment gateway returned an invalid response. Please try again later.");
        }

        let createData;
        try {
          createData = await createRes.json();
        } catch (parseError) {
          console.error("Failed to parse gateway response:", parseError);
          throw new Error("Payment gateway returned a malformed response.");
        }

        if (!createRes.ok || !createData.success) {
          // If credentials not configured, block — do NOT simulate
          if (createData.error?.includes("not configured") || createData.simulated) {
            setError(`${mfsProvider.name} payment gateway is not configured. Add Money is currently unavailable via ${mfsProvider.name}. Please contact support.`);
            setStep("pin");
            setPin("");
            setProcessing(false);
            return;
          }
          throw new Error(createData.error || "Payment creation failed");
        }

        // Step 2: Redirect to provider payment page
        const redirectUrl = mfsProvider.id === "bkash" ? createData.bkashURL : mfsProvider.id === "asthapay" ? createData.payment_url : createData.nagadURL;

        if (redirectUrl) {
          localStorage.setItem("pending_payment_session", JSON.stringify({
            sessionId: createData.sessionId,
            provider: mfsProvider.id,
            amount: addAmt,
            functionName,
          }));
          window.location.href = redirectUrl;
          return;
        }

        // If no redirect URL (sandbox may not have one), try execute for bKash
        if (mfsProvider.id === "bkash" && createData.paymentID) {
          const execRes = await fetch(
            `https://${projectId}.supabase.co/functions/v1/${functionName}?action=execute`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                sessionId: createData.sessionId,
                paymentID: createData.paymentID,
              }),
            }
          );
          const execData = await execRes.json();
          if (execData.success) {
            txnTime.current = new Date();
            txnId.current = createData.sessionId;
            showTxnToast({ type: "Add Money", amount: `৳${addAmt.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-addmoney" });
            setDir(1);
            setStep("success");
            return;
          }
        }

        // Gateway didn't complete — block, don't simulate
        setError("Payment could not be completed. The payment gateway did not finalize the transaction. Please try again.");
        setStep("pin");
        setPin("");
      } catch (err: any) {
        console.error("Payment gateway error:", err);
        setError(err.message || "Payment gateway is unavailable. Please try again later.");
        setStep("pin");
        setPin("");
      } finally {
        setProcessing(false);
      }
      return;
    }

    // For ALL other sources (bank, card, other MFS) — no real gateway connected, block the transaction
    setError("Add Money is currently unavailable. No payment gateway is configured for this method. Please contact support or try a different source.");
    setProcessing(false);
  };

  // ── Card number formatter ───────────────────────────────────────────────────
  const formatCard = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  // ── Copy helper ─────────────────────────────────────────────────────────────
  const copyText = async (text: string, field: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyText(text, field)}
      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors shrink-0"
    >
      {copiedField === field
        ? <CheckCheck size={13} className="text-primary" />
        : <Copy size={13} className="text-muted-foreground" />
      }
    </button>
  );

  const amtNum = parseFloat(amount) || 0;
  const FEE = 0; // Add Money is free

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      {step !== "success" && (
        <motion.div
          className="gradient-addmoney px-4 pt-3 pb-3 text-primary-foreground"
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
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowAddMoney")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("flowTopUpWallet")}</p>
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

      {/* ── Animated content ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-0 overflow-y-auto scrollbar-none"
          >

            {/* ══ STEP 1: Amount ══ */}
            {step === "amount" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">{t("enterAmount")}</label>
                    <div className="flex flex-col items-end gap-0.5">
                      <AvailableBalanceBadge />
                      <DailyLimitBadge txnType="addmoney" />
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setError(""); }}
                      className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                </div>

                {/* Quick amounts */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{t("quickSelect")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => { setAmount(String(q)); setError(""); }}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                          amount === String(q)
                            ? "gradient-addmoney text-white border-transparent shadow-card"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        ৳{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fee notice */}
                <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 flex items-start gap-2">
                  <Info size={14} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-primary/80 leading-relaxed">
                    <span className="font-semibold">{t("noFees")}</span> {t("addMoneyZeroCharge")}
                  </p>
                </div>

                <Button
                  className="w-full h-11 gradient-addmoney border-0 text-white font-semibold"
                  onClick={handleAmountContinue}
                >
                  {t("continue")}
                </Button>
              </div>
            )}

            {/* ══ STEP 2: Source ══ */}
            {step === "source" && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                {/* Amount recap */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border shadow-card">
                  <p className="text-sm text-muted-foreground">{t("addingToWallet")}</p>
                  <p className="text-xl font-bold text-foreground">৳{amtNum.toLocaleString()}</p>
                </div>

                {/* Source selector */}
                <p className="text-sm font-semibold text-foreground">{t("selectFundingSource")}</p>
                <div className="space-y-3">
                  {/* Bank Transfer */}
                  <button
                    onClick={() => { setSource("bank"); setError(""); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                      source === "bank"
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="gradient-payment w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0">
                      <Landmark size={22} strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{t("bankTransferLabel")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Send from any bank · Free · Up to 24h</p>
                    </div>
                    {source === "bank"
                      ? <CheckCircle2 size={18} className="text-primary shrink-0" />
                      : <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                    }
                  </button>

                  {/* Card */}
                  <button
                    onClick={() => { setSource("card"); setError(""); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                      source === "card"
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="gradient-send w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0">
                      <CreditCard size={22} strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{t("debitCreditCard")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Visa, Mastercard · Instant · Free</p>
                    </div>
                    {source === "card"
                      ? <CheckCircle2 size={18} className="text-primary shrink-0" />
                      : <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                    }
                   </button>
                </div>

                {/* MFS Providers */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Mobile Financial Services</p>
                <div className="grid grid-cols-2 gap-2">
                  {MFS_PROVIDERS.map((p) => {
                    const sel = source === "mfs" && mfsProvider?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setSource("mfs"); setMfsProvider(p); setError(""); }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                          sel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                        }`}
                      >
                        <div className={`${p.gradient} w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                          {p.short}
                        </div>
                        <span className="text-xs font-semibold text-foreground leading-tight">{p.name}</span>
                        {sel && <CheckCircle2 size={13} className="text-primary ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Bank selector (only when bank is chosen) */}
                {source === "bank" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your bank</p>
                    <div className="grid grid-cols-2 gap-2">
                      {BANK_LIST.map((b) => {
                        const sel = bank?.id === b.id;
                        return (
                          <button
                            key={b.id}
                            onClick={() => { setBank(b); setError(""); }}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                              sel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                            }`}
                          >
                            <div className={`${b.gradient} w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                              {b.short}
                            </div>
                            <span className="text-xs font-semibold text-foreground leading-tight">{b.name}</span>
                            {sel && <CheckCircle2 size={13} className="text-primary ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <Button
                  className="w-full h-11 gradient-addmoney border-0 text-white font-semibold"
                  onClick={handleSourceContinue}
                >
                  {t("continue")}
                </Button>
              </div>
            )}

            {/* ══ STEP 3a: Bank Transfer Details ══ */}
            {step === "details" && source === "bank" && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="gradient-payment w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Landmark size={17} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transfer from</p>
                    <p className="text-sm font-bold text-foreground">{bank?.name}</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="rounded-xl bg-accent/10 border border-accent/25 px-4 py-3 flex items-start gap-2">
                  <Info size={14} className="text-accent-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Send <span className="font-bold text-foreground">৳{amtNum.toLocaleString()}</span> from your <span className="font-semibold">{bank?.name}</span> account to the details below. Your wallet will be credited within 24 hours.
                  </p>
                </div>

                {/* Account detail card */}
                <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                  <div className="gradient-addmoney px-5 py-3 text-primary-foreground">
                    <p className="text-xs font-semibold opacity-80">Beneficiary Account</p>
                    <p className="text-sm font-bold">{RECEIVE_ACCOUNT.bank}</p>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      { label: "Account Name",   value: RECEIVE_ACCOUNT.accountName,  field: "name" },
                      { label: "Account Number", value: RECEIVE_ACCOUNT.accountNo,    field: "accno" },
                      { label: "Routing Number", value: RECEIVE_ACCOUNT.routing,      field: "routing" },
                      { label: "Branch",         value: RECEIVE_ACCOUNT.branch,       field: "branch" },
                    ].map(({ label, value, field }) => (
                      <div key={label} className="flex items-center justify-between px-5 py-3 gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-semibold text-foreground font-mono tracking-wide">{value}</p>
                        </div>
                        <CopyBtn text={value} field={field} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount to Send</p>
                        <p className="text-sm font-bold text-primary">৳{amtNum.toLocaleString()}</p>
                      </div>
                      <CopyBtn text={String(amtNum)} field="amount" />
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-11 gradient-addmoney border-0 text-white font-semibold"
                  onClick={handleDetailsContinue}
                >
                  I've Sent the Transfer
                </Button>
              </div>
            )}

            {/* ══ STEP 3b: Card Details ══ */}
            {step === "details" && source === "card" && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="gradient-send w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0">
                    <CreditCard size={17} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paying</p>
                    <p className="text-sm font-bold text-foreground">৳{amtNum.toLocaleString()} via Card</p>
                  </div>
                </div>

                {/* Card preview */}
                <div className="gradient-send rounded-2xl p-5 text-white shadow-glow">
                  <p className="text-xs opacity-60 mb-3">Card Number</p>
                  <p className="text-xl font-mono font-bold tracking-widest mb-4">
                    {cardNumber || "•••• •••• •••• ••••"}
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] opacity-60">Name on Card</p>
                      <p className="text-sm font-semibold uppercase tracking-wide">{cardName || "YOUR NAME"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] opacity-60">Expires</p>
                      <p className="text-sm font-semibold">{cardExpiry || "MM/YY"}</p>
                    </div>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Card Number</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      maxLength={19}
                      onChange={(e) => { setCardNumber(formatCard(e.target.value)); setError(""); }}
                      className="h-11 font-mono tracking-widest bg-card border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Name on Card</label>
                    <Input
                      type="text"
                      placeholder="TANVIR HASAN"
                      value={cardName}
                      maxLength={26}
                      onChange={(e) => { setCardName(e.target.value.toUpperCase()); setError(""); }}
                      className="h-11 uppercase bg-card border-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Expiry</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        maxLength={5}
                        onChange={(e) => { setCardExpiry(formatExpiry(e.target.value)); setError(""); }}
                        className="h-11 font-mono bg-card border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">CVV</label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        placeholder="•••"
                        value={cardCvv}
                        maxLength={4}
                        onChange={(e) => { setCardCvv(e.target.value.replace(/\D/g, "")); setError(""); }}
                        className="h-11 font-mono bg-card border-border"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                {/* Security note */}
                <div className="flex items-center gap-2 px-1">
                  <Shield size={13} className="text-primary shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Your card details are encrypted and never stored.
                  </p>
                </div>

                <Button
                  className="w-full h-11 gradient-addmoney border-0 text-white font-semibold"
                  onClick={handleDetailsContinue}
                >
                  Continue to PIN
                </Button>
              </div>
            )}

            {/* ══ STEP 3c: MFS Details ══ */}
            {step === "details" && source === "mfs" && mfsProvider && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="flex items-center gap-3">
                  <div className={`${mfsProvider.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {mfsProvider.short}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pay via</p>
                    <p className="text-sm font-bold text-foreground">{mfsProvider.name}</p>
                  </div>
                </div>

                {/* Amount recap */}
                <div className="rounded-2xl border border-border bg-card shadow-card px-5 py-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="text-foreground font-bold">৳{amtNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gateway Fee</span>
                    <span className="text-primary font-semibold">Free</span>
                  </div>
                </div>

                {/* Account number input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">{mfsProvider.accountLabel}</label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder={mfsProvider.accountPlaceholder}
                    value={mfsAccount}
                    maxLength={mfsProvider.accountMaxLength}
                    onChange={(e) => { setMfsAccount(e.target.value.replace(/\D/g, "")); setError(""); }}
                    className="h-12 text-lg font-mono tracking-wider bg-card border-border"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Enter your registered {mfsProvider.name} number to receive the payment request.
                  </p>
                </div>

                {/* How it works */}
                <div className="rounded-xl bg-accent/10 border border-accent/25 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">How it works:</p>
                  <ol className="text-xs text-foreground/80 leading-relaxed space-y-1 list-decimal list-inside">
                    <li>Enter your {mfsProvider.name} number above</li>
                    <li>Confirm with your EasyPay PIN</li>
                    <li>You'll receive a payment request on your {mfsProvider.name} app</li>
                    <li>Approve the payment in {mfsProvider.name}</li>
                    <li>Your EasyPay wallet will be credited instantly</li>
                  </ol>
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <div className="flex items-center gap-2 px-1">
                  <Shield size={13} className="text-primary shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Secured by {mfsProvider.name} Payment Gateway. Your credentials are never stored.
                  </p>
                </div>

                <Button
                  className="w-full h-11 gradient-addmoney border-0 text-white font-semibold"
                  onClick={handleDetailsContinue}
                >
                  Continue to PIN
                </Button>
              </div>
            )}

            {/* ══ Processing Step ══ */}
            {step === "processing" && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] px-5 gap-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className={`w-20 h-20 rounded-2xl ${mfsProvider?.gradient ?? "gradient-addmoney"} flex items-center justify-center text-white shadow-glow`}
                >
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                </motion.div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-foreground">Processing Payment</h2>
                  <p className="text-sm text-muted-foreground">
                    Connecting to {mfsProvider?.name ?? "payment gateway"}...
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Please approve the payment request on your {mfsProvider?.name ?? "MFS"} app
                  </p>
                </div>
              </div>
            )}

            {/* ══ STEP 4: PIN ══ */}
            {step === "pin" && (
              <div className="px-4 pt-10 pb-32 space-y-8">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 gradient-addmoney rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <Lock size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Confirm with PIN</h2>
                  <p className="text-sm text-muted-foreground">Enter your 4-digit wallet PIN to complete</p>
                </div>

                {/* Summary */}
                <div className="rounded-2xl bg-card border border-border shadow-card px-5 py-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Adding</span>
                    <span className="text-foreground font-semibold">৳{amtNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee</span>
                    <span className="text-primary font-semibold">Free</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Source</span>
                    <span className="text-foreground font-medium capitalize">
                      {source === "bank" ? bank?.name : source === "mfs" ? mfsProvider?.name : "Card"}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-base">
                    <span className="text-foreground">Wallet Credit</span>
                    <span className="text-primary">৳{amtNum.toLocaleString()}</span>
                  </div>
                </div>

                {/* PIN input – system keyboard */}
                <div className="space-y-4">
                  <PinDots length={pin.length} />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length > pin.length) haptics.light();
                      setPin(v);
                      setError("");
                    }}
                    placeholder="Enter PIN"
                    className="w-full text-center text-xl font-mono h-12 rounded-2xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary tracking-[1em] placeholder:tracking-normal placeholder:text-sm placeholder:text-muted-foreground"
                    autoFocus
                  />
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-destructive flex items-center justify-center gap-1.5"
                    >
                      <AlertCircle size={13} /> {error}
                    </motion.p>
                  )}
                </div>

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label={t("slideToAddMoney")}
                  gradient="gradient-addmoney"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                  icon={Wallet}
                />
              </div>
            )}

            {/* ══ STEP 5: Success ══ */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-start pt-12 pb-10 px-5 gap-6 min-h-full">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-24 h-24 gradient-addmoney rounded-3xl flex items-center justify-center text-primary-foreground shadow-glow"
                >
                  <CheckCircle2 size={48} strokeWidth={1.5} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="text-center space-y-1"
                >
                  <h2 className="text-2xl font-bold text-foreground">{t("moneyAdded")}</h2>
                  <p className="text-3xl font-bold text-primary">৳{amtNum.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{t("hasBeenAddedToWallet")}</p>
                </motion.div>

                {/* Receipt */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 }}
                  className="w-full rounded-2xl border border-border bg-card shadow-card overflow-hidden"
                >
                  {/* Receipt header */}
                  <div className="gradient-addmoney px-5 py-3 text-primary-foreground flex items-center justify-between">
                    <p className="text-sm font-bold">{t("transactionReceipt")}</p>
                    <CheckCircle2 size={16} className="opacity-80" />
                  </div>

                  <div className="divide-y divide-border">
                    {[
                      { label: "Transaction ID", value: txnId.current },
                      { label: "Date & Time",    value: txnTime.current.toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) },
                      { label: "Source",         value: source === "bank" ? bank?.name ?? "Bank Transfer" : source === "mfs" ? `${mfsProvider?.name} (${mfsAccount})` : "Card" },
                      { label: "Amount",         value: `৳${amtNum.toLocaleString()}` },
                      { label: "Fee",            value: "Free" },
                      { label: "Fee Source",     value: "N/A – No charge" },
                      { label: "Status",         value: source === "bank" ? "Pending (up to 24h)" : "Completed" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-5 py-3 gap-2">
                        <p className="text-xs text-muted-foreground shrink-0">{label}</p>
                        <p className={`text-xs font-semibold text-right ${
                          label === "Fee" ? "text-primary" :
                          label === "Status" && value === "Completed" ? "text-primary" :
                          label === "Status" ? "text-accent-foreground" :
                          "text-foreground"
                        }`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38 }}
                  className="w-full space-y-3"
                >
                  <button
                    onClick={onClose}
                    className="w-full h-12 gradient-addmoney text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                  >
                    {t("backToHome")}
                  </button>
                  <button
                    onClick={() => setShowShare(true)}
                    className="w-full h-11 rounded-2xl border border-border bg-card text-foreground font-semibold active:scale-[0.98] transition-transform"
                  >
                    {t("shareReceipt")}
                  </button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Money Added",
          amount: `৳${(parseFloat(amount) || 0).toLocaleString()}`,
          gradient: "gradient-addmoney",
          txnId: txnId.current,
          rows: [
            { label: "Source", value: source === "bank" ? bank?.name ?? "Bank Transfer" : source === "mfs" ? `${mfsProvider?.name} (${mfsAccount})` : "Card" },
            { label: "Amount", value: `৳${(parseFloat(amount) || 0).toLocaleString()}` },
            { label: "Fee", value: "Free" },
            { label: "Status", value: source === "bank" ? "Pending (up to 24h)" : "Completed" },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </div>
  );
};

const AddMoneyFlowGuarded = (props: AddMoneyFlowProps) => (
  <FeatureGuard featureKey="add_money" onClose={props.onClose}>
    <AddMoneyFlow {...props} />
  </FeatureGuard>
);

export default AddMoneyFlowGuarded;

