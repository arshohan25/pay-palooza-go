import { useState, useRef, useEffect, useMemo } from "react";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { requestLocation } from "@/lib/permissions";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useFeeConfig } from "@/hooks/use-fee-config";
import { transferMoney, getBalance } from "@/lib/balanceStore";
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
  ChevronLeft,
  Search,
  CheckCircle2,
  Send,
  User,
  Phone,
  AlertCircle,
  QrCode,
  Hash,
  Banknote,
  Shield,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScannerModal from "@/components/QrScannerModal";
import { useI18n } from "@/lib/i18n";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import FeatureGuard from "@/components/FeatureGuard";
import FeatureLockedOverlay from "@/components/FeatureLockedOverlay";
import PermissionGate from "@/components/PermissionGate";
import { Contact2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "recipient" | "amount" | "confirm" | "pin" | "success";

interface Contact {
  id: string;
  name: string;
  phone: string;
  initials: string;
  gradient: string;
}

const GRADIENTS = ["gradient-send", "gradient-cashout", "gradient-payment", "gradient-addmoney", "gradient-accent"];

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// ─── Validation helpers ───────────────────────────────────────────────────────
const WALLET_ID_RE = /^MFS-[A-Z]{4}-[A-Z]{4}$/i;
const BD_PHONE_RE  = /^(?:\+?88)?01[3-9]\d{8}$/;

const normalizePhone = (raw: string) => raw.replace(/[\s\-()]/g, "");

type RecipientType = "phone" | "walletId";

const detectRecipientType = (val: string): RecipientType | null => {
  const v = val.trim();
  if (WALLET_ID_RE.test(v)) return "walletId";
  if (BD_PHONE_RE.test(normalizePhone(v))) return "phone";
  return null;
};

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS: Step[] = ["recipient", "amount", "confirm", "pin"];
const STEP_LABELS: Record<Step, string> = {
  recipient: "To",
  amount: "Amount",
  confirm: "Review",
  pin: "PIN",
  success: "Done",
};

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Staggered child animation ────────────────────────────────────────────────
const staggerContainer = { animate: { transition: { staggerChildren: 0.06 } } };
const staggerChild = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 30 } },
};

interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; }
const PinInput = ({ pin, onChange, error }: PinInputProps) => {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-5">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: pin.length > i ? 1.2 : 1,
              boxShadow: pin.length > i
                ? "0 0 16px 4px hsl(330 80% 55% / 0.35)"
                : "0 0 0 0px transparent",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className={`w-5 h-5 rounded-full border-2 transition-colors ${
              pin.length > i ? "gradient-send border-transparent" : "border-muted-foreground/30 bg-transparent"
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center justify-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          if (v.length > pin.length) haptics.light();
          onChange(v);
        }}
        autoFocus
        className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors"
        placeholder="••••"
      />
      <p className="text-center text-xs text-muted-foreground">{t("enterPin")}</p>
    </div>
  );
};

interface SendMoneyFlowProps { onClose: () => void; prefilledPhone?: string; onSuccess?: (amount: number) => void; }

const SendMoneyFlow = ({ onClose, prefilledPhone, onSuccess }: SendMoneyFlowProps) => {
  const { t } = useI18n();
  const { isLocked } = useFeatureLocks();
  const { calcFee, calcCashOutFee, loading: feeLoading } = useFeeConfig();
  const sendLock = isLocked("send_money");
  const [step, setStep]           = useState<Step>("recipient");
  const [direction, setDirection] = useState(1);
  const [recipient, setRecipient] = useState<Contact | null>(null);
  const [inputVal, setInputVal]   = useState(prefilledPhone ?? "");
  const [inputType, setInputType] = useState<RecipientType | null>(prefilledPhone ? "phone" : null);
  const [amount, setAmount]       = useState("");
  const [note, setNote]           = useState("");
  const [error, setError]         = useState("");
  const [pin, setPin]             = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [addCashOutCharge, setAddCashOutCharge] = useState(false);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const txnTime = useRef(new Date());
  const genId = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };
  const txnId   = useRef(genId());

  // Fetch real recent transaction recipients
  useEffect(() => {
    const fetchRecent = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("transactions")
        .select("recipient_phone, recipient_name")
        .eq("user_id", session.user.id)
        .in("type", ["send", "payment", "cashin"])
        .eq("status", "completed")
        .not("recipient_phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data?.length) return;
      const seen = new Set<string>();
      const contacts: Contact[] = [];
      for (const t of data) {
        const phone = t.recipient_phone!;
        if (seen.has(phone)) continue;
        seen.add(phone);
        const name = t.recipient_name || phone;
        const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
        contacts.push({
          id: phone,
          name,
          phone,
          initials: initials || phone.slice(0, 2),
          gradient: GRADIENTS[contacts.length % GRADIENTS.length],
        });
        if (contacts.length >= 5) break;
      }
      setRecentContacts(contacts);
    };
    fetchRecent();
  }, []);

  useEffect(() => {
    if (step === "success") {
      fireSuccessConfetti();
      addTxnNotif();
      txnId.current = genId();
    }
  }, [step]);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "recipient") { onClose(); return; }
    if (step === "amount")    { goTo("recipient"); return; }
    if (step === "confirm")   { goTo("amount"); return; }
    if (step === "pin")       { goTo("confirm"); return; }
  };

  const filteredContacts = recentContacts.filter(
    (c) => {
      if (!inputVal.trim()) return true;
      const q = inputVal.trim().toLowerCase();
      return c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, ""));
    },
  );

  const handleSelectContact = (c: Contact) => {
    setRecipient(c);
    setInputVal(c.phone);
    setInputType("phone");
    goTo("amount");
  };

  const handleInputChange = (val: string) => {
    const trimmed = val.slice(0, 13);
    setInputVal(trimmed);
    setInputType(detectRecipientType(trimmed));
    setError("");
  };

  const handleContinue = () => {
    const val = inputVal.trim();
    const type = detectRecipientType(val);
    if (!type) {
      setError(t("enterValidNumber"));
      return;
    }
    const found = recentContacts.find((c) => {
      if (type === "phone") return normalizePhone(c.phone) === normalizePhone(val);
      return false;
    });
    if (found) {
      setRecipient(found);
    } else {
      const initials = type === "walletId"
        ? val.slice(4, 6).toUpperCase()
        : normalizePhone(val).slice(-2);
      setRecipient({
        id: "custom",
        name: type === "walletId" ? `Wallet ${val}` : normalizePhone(val),
        phone: type === "walletId" ? val : normalizePhone(val),
        initials,
        gradient: "gradient-primary",
      });
    }
    setInputType(type);
    goTo("amount");
  };

  const handleQrScan = (result: string) => {
    const type = detectRecipientType(result);
    setInputVal(result);
    setInputType(type);
    const found = recentContacts.find((c) => normalizePhone(c.phone) === normalizePhone(result));
    if (found) {
      setRecipient(found);
    } else {
      const initials = type === "walletId"
        ? result.slice(4, 6).toUpperCase()
        : result.slice(-2);
      setRecipient({
        id: "qr",
        name: type === "walletId" ? `Wallet ${result}` : result,
        phone: result,
        initials,
        gradient: "gradient-send",
      });
    }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError(t("enterValidAmount")); return; }
    if (val < 0.01)  { setError("Minimum send amount is ৳0.01."); return; }
    if (val > 50000) { setError("Maximum send per day is ৳50,000."); return; }
    goTo("confirm");
  };

  const handleConfirm = () => goTo("pin");

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError(t("enterYour4DigitPin")); return; }
    if (processing) return;
    setProcessing(true);

    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }

    const amtVal = parseFloat(amount) || 0;
    const limitCheck = await checkDailyLimit("send", amtVal);
    if (!limitCheck.allowed) {
      setError(`Daily limit exceeded. Used ৳${limitCheck.used.toLocaleString()} of ৳${limitCheck.limit.toLocaleString()} today.`);
      setProcessing(false);
      return;
    }

    requestLocation().catch(() => {});
    haptics.success();
    txnTime.current = new Date();
    const cashOutExtra = addCashOutCharge ? calcCashOutFee(amtVal) : 0;
    const actualSendAmount = parseFloat((amtVal + cashOutExtra).toFixed(2));
    const feeVal = calcFee("send", actualSendAmount);
    await transferMoney({
      recipientPhone: recipient?.phone ?? "",
      amount: actualSendAmount,
      fee: feeVal,
      type: "send",
      recipientName: recipient?.name,
      reference: txnId.current,
      description: (addCashOutCharge ? "[+Cash Out Charge] " : "") + (note || ""),
    });
    onSuccess?.(actualSendAmount);
    showTxnToast({ type: "Send Money", amount: `৳${actualSendAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-send" });
    setDirection(1);
    setStep("success");
  };

  const BALANCE = getBalance();
  const amtNum = parseFloat(amount) || 0;
  const cashOutExtra = addCashOutCharge ? calcCashOutFee(amtNum) : 0;
  const sendAmount = parseFloat((amtNum + cashOutExtra).toFixed(2));
  const fee    = calcFee("send", sendAmount);
  const feeFromBalance = Math.min(fee, BALANCE);
  const feeFromAmount  = parseFloat((fee - feeFromBalance).toFixed(2));
  const totalFromBalance = sendAmount + feeFromBalance;
  const recipientReceives = parseFloat((sendAmount - feeFromAmount).toFixed(2));

  if (sendLock.locked) {
    return (
      <FeatureLockedOverlay
        featureName="Send Money"
        reason={sendLock.reason}
        expiresAt={sendLock.expiresAt}
        onClose={onClose}
      />
    );
  }

  // ─── Dot Stepper ────────────────────────────────────────────────────────────
  const currentStepIdx = STEPS.indexOf(step);
  const DotStepper = () => (
    <div className="flex items-center justify-center gap-0 mt-3">
      {STEPS.map((s, i) => {
        const isActive = i === currentStepIdx;
        const isCompleted = i < currentStepIdx;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                animate={{
                  scale: isActive ? 1.15 : 1,
                  boxShadow: isActive ? "0 0 12px 3px hsl(0 0% 100% / 0.4)" : "none",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  isCompleted ? "bg-white" : isActive ? "bg-white" : "bg-white/30"
                }`}
              />
              <span className={`text-[9px] mt-1 font-semibold tracking-wide ${
                isActive ? "text-white" : isCompleted ? "text-white/80" : "text-white/40"
              }`}>
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1.5 mb-3.5 ${
                i < currentStepIdx ? "bg-white/70" : "bg-white/20"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* ── Premium Header ── */}
      {step !== "success" && (
        <motion.div
          className="gradient-send relative overflow-hidden px-5 pt-4 pb-4 text-primary-foreground"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          {/* Radial glow overlay */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight">{t("flowSendMoney")}</h1>
              <p className="text-[11px] text-white/60 font-medium">{t("flowSecureTransfer")}</p>
            </div>
          </div>

          <DotStepper />
        </motion.div>
      )}

      {/* ── Animated step content ── */}
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

            {/* ═══════════ STEP 1: Recipient ═══════════ */}
            {step === "recipient" && (
              <motion.div className="px-5 pt-5 pb-32 space-y-5" variants={staggerContainer} initial="initial" animate="animate">
                {/* Search Card */}
                <motion.div variants={staggerChild} className="rounded-3xl bg-card border border-border shadow-elevated p-4 space-y-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("searchByNameNumberWallet")}</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                    <Input
                      type="text"
                      inputMode="text"
                      placeholder="Name/Number or W-ID"
                      value={inputVal}
                      maxLength={13}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className="pl-10 pr-14 h-13 text-base bg-muted/50 border-0 rounded-2xl shadow-inner-sm focus-visible:ring-2 focus-visible:ring-primary/40"
                      autoFocus
                    />
                    <button
                      onClick={() => setShowScanner(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 px-3 rounded-xl gradient-send flex items-center justify-center gap-1.5 active:scale-90 transition-transform"
                    >
                      <QrCode size={14} className="text-white" />
                      <span className="text-[10px] font-bold text-white">QR</span>
                    </button>
                  </div>

                  {/* Live type badge */}
                  <AnimatePresence>
                    {inputVal.trim() && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.9 }}
                        className="flex items-center gap-1.5"
                      >
                        {inputType ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                            {inputType === "phone" ? <Phone size={10} /> : <Hash size={10} />}
                            {inputType === "phone" ? t("mobileNumber") : t("walletIdLabel")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            Enter valid 11-digit number or MFS-ABCD-EFGH
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                </motion.div>

                {/* Continue Button */}
                <motion.div variants={staggerChild}>
                  <Button
                    className="w-full h-12 gradient-send border-0 text-white font-bold text-sm rounded-2xl shadow-glow active:scale-[0.97] transition-transform"
                    onClick={handleContinue}
                    disabled={!inputVal.trim()}
                  >
                    {t("continue")}
                  </Button>
                </motion.div>

                {/* Divider */}
                <motion.div variants={staggerChild} className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("recentContacts")}</span>
                  <div className="flex-1 h-px bg-border" />
                </motion.div>

                {/* Recent Contacts — Horizontal Scroll Chips */}
                <motion.div variants={staggerChild}>
                  {filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center py-6 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Users size={20} className="text-muted-foreground/50" />
                      </div>
                      <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                        No recent recipients yet. Start sending to build your list!
                      </p>
                    </div>
                  ) : (
                    <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none -mx-1 px-1">
                      {filteredContacts.slice(0, 5).map((c, idx) => (
                        <motion.button
                          key={c.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05, type: "spring", stiffness: 400, damping: 25 }}
                          onClick={() => handleSelectContact(c)}
                          className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16 active:scale-90 transition-transform"
                        >
                          <div className={`${c.gradient} w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-card ring-2 ring-white/50`}>
                            {c.initials}
                          </div>
                          <span className="text-[11px] font-semibold text-foreground truncate w-full text-center leading-tight">
                            {c.name.split(" ")[0]}
                          </span>
                          <span className="text-[9px] text-muted-foreground -mt-1">
                            {c.phone.slice(-4)}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* ═══════════ STEP 2: Amount ═══════════ */}
            {step === "amount" && (
              <motion.div className="px-5 pt-5 pb-32 space-y-5" variants={staggerContainer} initial="initial" animate="animate">
                {/* Recipient Pill */}
                {recipient && (
                  <motion.div variants={staggerChild}
                    className="flex items-center gap-2.5 p-2.5 pr-4 rounded-2xl bg-card border border-border shadow-card w-fit"
                  >
                    <div className={`${recipient.gradient} w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                      {recipient.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{recipient.name}</p>
                      <p className="text-[10px] text-muted-foreground">{recipient.phone}</p>
                    </div>
                  </motion.div>
                )}

                {/* Amount Input — Premium Style */}
                <motion.div variants={staggerChild} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("enterAmount")}</label>
                    <div className="flex flex-col items-end gap-0.5">
                      <AvailableBalanceBadge />
                      <DailyLimitBadge txnType="send" />
                    </div>
                  </div>
                  <div className="relative rounded-3xl bg-card border border-border shadow-elevated overflow-hidden">
                    <div className="flex items-center px-5 py-4">
                      <span className="text-3xl font-extrabold text-muted-foreground/50 mr-2">৳</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setError(""); }}
                        className="flex-1 text-4xl font-extrabold text-foreground bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    {/* Accent bottom line */}
                    <div className="h-0.5 gradient-send" />
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                </motion.div>

                {/* Quick Amount Pills — Horizontal Scroll */}
                <motion.div variants={staggerChild} className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("quickSelect")}</p>
                  <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
                    {QUICK_AMOUNTS.map((q) => (
                      <motion.button
                        key={q}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setAmount(String(q))}
                        className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                          amount === String(q)
                            ? "gradient-send text-white border-transparent shadow-glow scale-105"
                            : "bg-card border-border text-foreground hover:border-primary/40 shadow-xs"
                        }`}
                      >
                        ৳{q.toLocaleString()}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* Note — Underline Style */}
                <motion.div variants={staggerChild} className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("noteOptional")}</label>
                  <Input
                    placeholder="What's it for?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/40 text-sm"
                  />
                </motion.div>

                {/* Cash Out Charge Toggle */}
                <motion.div variants={staggerChild}>
                  <button
                    onClick={() => { setAddCashOutCharge(!addCashOutCharge); haptics.light(); }}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-3xl border transition-all active:scale-[0.98] ${
                      addCashOutCharge
                        ? "border-primary/40 bg-primary/5 shadow-glow"
                        : "border-border bg-card hover:border-primary/30 shadow-card"
                    }`}
                  >
                    <motion.div
                      animate={{ rotate: addCashOutCharge ? 360 : 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        addCashOutCharge ? "gradient-cashout text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Banknote size={18} />
                    </motion.div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-foreground">Add Cash Out Charge</p>
                      <p className="text-[10px] text-muted-foreground">+1.19% so recipient gets full amount</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${addCashOutCharge ? "bg-primary" : "bg-muted"}`}>
                      <motion.div
                        animate={{ x: addCashOutCharge ? 20 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-elevated"
                      />
                    </div>
                  </button>
                </motion.div>

                {/* Fee Breakdown — Glass Card */}
                {amtNum > 0 && (
                  <motion.div variants={staggerChild}
                    className="rounded-3xl bg-card/80 backdrop-blur-sm border border-border shadow-card p-4 space-y-2.5 text-sm"
                  >
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("amount")}</span>
                      <span className="text-foreground font-semibold">৳{amtNum.toLocaleString()}</span>
                    </div>
                    {addCashOutCharge && cashOutExtra > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Cash Out Charge (1.19%)</span>
                        <span className="text-foreground font-semibold">+ ৳{cashOutExtra.toLocaleString()}</span>
                      </div>
                    )}
                    {addCashOutCharge && cashOutExtra > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Send</span>
                        <span className="text-foreground font-semibold">৳{sendAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("serviceFee")}</span>
                      <span className="text-foreground font-semibold">
                        {fee === 0 ? <span className="text-primary font-bold">{t("free")}</span> : `৳${fee}`}
                      </span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between text-[11px] text-muted-foreground/70">
                        <span>{t("feeSource")}</span>
                        <span>{feeFromBalance >= fee ? t("fromYourBalance") : feeFromBalance > 0 ? `৳${feeFromBalance} balance + ৳${feeFromAmount} from amount` : t("deductedFromAmount")}</span>
                      </div>
                    )}
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-extrabold text-foreground text-base">
                      <span>{t("totalFromBalance")}</span>
                      <span>৳{totalFromBalance.toLocaleString()}</span>
                    </div>
                  </motion.div>
                )}

                {/* Review Button */}
                <motion.div variants={staggerChild}>
                  <Button
                    className="w-full h-12 gradient-send border-0 text-white font-bold text-sm rounded-2xl shadow-glow-lg active:scale-[0.97] transition-transform"
                    onClick={handleAmountContinue}
                  >
                    {t("reviewTransfer")}
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ═══════════ STEP 3: Confirm ═══════════ */}
            {step === "confirm" && (
              <motion.div className="px-5 pt-5 pb-32 space-y-5" variants={staggerContainer} initial="initial" animate="animate">
                {/* Hero Amount */}
                <motion.div variants={staggerChild} className="text-center space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("youreSending")}</p>
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
                    className="text-5xl font-extrabold text-foreground"
                  >
                    ৳{amtNum.toLocaleString()}
                  </motion.p>
                </motion.div>

                {/* Recipient Card with Left Accent */}
                <motion.div variants={staggerChild}
                  className="rounded-3xl bg-card border border-border shadow-elevated overflow-hidden"
                >
                  <div className="flex">
                    <div className="w-1.5 gradient-send shrink-0" />
                    <div className="flex-1 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={`${recipient?.gradient} w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shrink-0 shadow-card`}>
                          {recipient?.initials}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{recipient?.name}</p>
                          <p className="text-xs text-muted-foreground">{recipient?.phone}</p>
                        </div>
                      </div>
                      {note && (
                        <div className="bg-muted/50 rounded-2xl px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">{t("note")}: </span>{note}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Transfer Summary — Alternating Rows */}
                <motion.div variants={staggerChild}
                  className="rounded-3xl bg-card border border-border shadow-card overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("transferSummary")}</p>
                  </div>
                  <div className="divide-y divide-border text-sm">
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-muted-foreground">{t("sendAmount")}</span>
                      <span className="text-foreground font-semibold">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 bg-muted/30">
                      <span className="text-muted-foreground">{t("serviceFee")}</span>
                      <span className="text-foreground font-semibold">
                        {fee === 0 ? <span className="text-primary font-bold">{t("free")}</span> : `৳${fee}`}
                      </span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between px-4 py-2.5 text-[11px]">
                        <span className="text-muted-foreground">{t("feeSource")}</span>
                        <span className="text-primary font-semibold">{feeFromBalance >= fee ? t("fromBalance") : feeFromBalance > 0 ? `৳${feeFromBalance} balance + ৳${feeFromAmount} from amount` : "From send amount"}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-3.5 bg-muted/30">
                      <span className="font-extrabold text-foreground text-base">{t("totalFromBalance")}</span>
                      <span className="font-extrabold text-foreground text-base">৳{totalFromBalance.toLocaleString()}</span>
                    </div>
                    {feeFromAmount > 0 && (
                      <div className="flex justify-between px-4 py-2.5 text-xs">
                        <span className="text-muted-foreground">{t("recipientReceives")}</span>
                        <span className="text-primary font-semibold">৳{recipientReceives.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Security Trust Indicator */}
                <motion.div variants={staggerChild}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15 text-xs"
                >
                  <Shield size={16} className="text-primary shrink-0" />
                  <span className="text-muted-foreground">
                    Secured with <span className="font-bold text-foreground">PIN verification</span> & encryption
                  </span>
                </motion.div>

                {/* Buttons */}
                <motion.div variants={staggerChild} className="space-y-2.5">
                  <Button
                    className="w-full h-12 gradient-send border-0 text-white font-bold text-sm rounded-2xl shadow-glow-lg active:scale-[0.97] transition-transform"
                    onClick={handleConfirm}
                  >
                    <Send size={16} /> {t("confirmEnterPin")}
                  </Button>
                  <Button variant="ghost" className="w-full text-muted-foreground font-semibold" onClick={() => goTo("amount")}>
                    {t("edit")}
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ═══════════ STEP 4: PIN ═══════════ */}
            {step === "pin" && (
              <motion.div className="px-5 pt-5 pb-32 space-y-6" variants={staggerContainer} initial="initial" animate="animate">
                {/* Compact Header */}
                <motion.div variants={staggerChild} className="text-center space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("sending")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">to <span className="font-bold text-foreground">{recipient?.name}</span></p>
                </motion.div>

                <motion.div variants={staggerChild}
                  className="rounded-3xl bg-card border border-border shadow-card p-3.5 flex justify-between items-center text-sm"
                >
                  <span className="text-muted-foreground">{t("totalFromBalance")}</span>
                  <span className="font-extrabold text-foreground">৳{totalFromBalance.toLocaleString()}</span>
                </motion.div>

                <motion.div variants={staggerChild}>
                  <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />
                </motion.div>

                <motion.div variants={staggerChild}>
                  <SlideToConfirm
                    onConfirm={handlePinConfirm}
                    label={t("slideToSend")}
                    gradient="gradient-send"
                    disabled={pin.length < 4 || processing}
                    pinComplete={pin.length === 4}
                    icon={Send}
                  />
                </motion.div>
              </motion.div>
            )}

            {/* ═══════════ STEP 5: Success ═══════════ */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center space-y-6">
                {/* Animated Gradient Ring + Checkmark */}
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="relative"
                >
                  {/* Pulsing ring */}
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 gradient-addmoney rounded-full"
                  />
                  <div className="relative w-24 h-24 gradient-addmoney rounded-full flex items-center justify-center shadow-glow-lg">
                    <CheckCircle2 size={48} className="text-white" />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-1.5">
                  <h2 className="text-2xl font-extrabold text-foreground">{t("moneySent")}</h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{amtNum.toLocaleString()} sent to{" "}
                    <span className="font-bold text-foreground">{recipient?.name}</span>
                  </p>
                </motion.div>

                {/* Receipt Card with Left Accent */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="w-full rounded-3xl bg-card border border-border shadow-elevated overflow-hidden"
                >
                  <div className="flex">
                    <div className="w-1.5 gradient-send shrink-0" />
                    <div className="flex-1 p-4 text-sm space-y-2.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("recipient")}</span><span className="text-foreground font-semibold">{recipient?.name}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("mobileWallet")}</span><span className="text-foreground font-semibold">{recipient?.phone}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("amount")}</span><span className="text-foreground font-semibold">৳{amtNum.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("fee")}</span>
                        <span className="text-foreground font-semibold">{fee === 0 ? t("free") : `৳${fee}`}</span>
                      </div>
                      {fee > 0 && (
                        <div className="flex justify-between text-[11px] text-muted-foreground/70">
                          <span>{t("feeDeductedFrom")}</span>
                          <span className="font-semibold">{feeFromBalance >= fee ? t("fromBalance") : feeFromBalance > 0 ? `Balance (৳${feeFromBalance}) + Amount (৳${feeFromAmount})` : "Send amount"}</span>
                        </div>
                      )}
                      {feeFromAmount > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t("recipientReceives")}</span>
                          <span className="font-bold text-primary">৳{recipientReceives.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("date")}</span>
                        <span className="text-foreground font-semibold">
                          {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("time")}</span>
                        <span className="text-foreground font-semibold">
                          {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                        </span>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="flex justify-between font-extrabold text-foreground">
                        <span>{t("transactionId")}</span>
                        <span className="text-primary">{txnId.current}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full space-y-2.5">
                  <Button className="w-full h-12 gradient-send border-0 text-white font-bold rounded-2xl shadow-glow active:scale-[0.97] transition-transform" onClick={onClose}>
                    {t("backToHome")}
                  </Button>
                  <Button variant="outline" className="w-full h-11 rounded-2xl border-border font-semibold" onClick={() => setShowShare(true)}>
                    {t("shareReceipt")}
                  </Button>
                </motion.div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* QR Scanner */}
      <QrScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQrScan}
        title={t("scanRecipientQr")}
      />

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Money Sent",
          amount: `৳${amtNum.toLocaleString()}`,
          gradient: "gradient-send",
          txnId: txnId.current,
          rows: [
            { label: "Recipient", value: recipient?.name ?? "" },
            { label: "Mobile / Wallet", value: recipient?.phone ?? "" },
            { label: "Amount", value: `৳${amtNum.toLocaleString()}` },
            { label: "Fee", value: fee === 0 ? "Free" : `৳${fee}` },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </div>
  );
};

const SendMoneyFlowGuarded = (props: SendMoneyFlowProps) => (
  <FeatureGuard featureKey="send_money" onClose={props.onClose}>
    <SendMoneyFlow {...props} />
  </FeatureGuard>
);

export default SendMoneyFlowGuarded;
