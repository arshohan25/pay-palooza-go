import { useState, useRef, useEffect } from "react";
import { haptics } from "@/lib/haptics";
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

// ─── Mock data ────────────────────────────────────────────────────────────────
const RECENT_CONTACTS: Contact[] = [
  { id: "1", name: "Rahim Uddin",   phone: "01711223344", initials: "RU", gradient: "gradient-send" },
  { id: "2", name: "Fatema Begum",  phone: "01812334455", initials: "FB", gradient: "gradient-cashout" },
  { id: "3", name: "Karim Sheikh",  phone: "01900445566", initials: "KS", gradient: "gradient-payment" },
  { id: "4", name: "Nusrat Jahan",  phone: "01655556677", initials: "NJ", gradient: "gradient-addmoney" },
  { id: "5", name: "Shakil Ahmed",  phone: "01523667788", initials: "SA", gradient: "gradient-accent" },
];

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

// Fee logic now driven by useFeeConfig hook

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS: Step[] = ["recipient", "amount", "confirm", "pin"];
const STEP_LABELS: Record<Step, string> = {
  recipient: "Recipient",
  amount: "Amount",
  confirm: "Confirm",
  pin: "PIN",
  success: "Done",
};

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; }
const PinInput = ({ pin, onChange, error }: PinInputProps) => {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: pin.length > i ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              pin.length > i ? "gradient-send border-transparent" : "border-muted-foreground/40 bg-transparent"
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
  const txnTime = useRef(new Date());
  const genId = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };
  const txnId   = useRef(genId());

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

  const filteredContacts = RECENT_CONTACTS.filter(
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
    const found = RECENT_CONTACTS.find((c) => {
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
    const found = RECENT_CONTACTS.find((c) => normalizePhone(c.phone) === normalizePhone(result));
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

    // Verify PIN
    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }

    // Check daily limit
    const amtVal = parseFloat(amount) || 0;
    const limitCheck = await checkDailyLimit("send", amtVal);
    if (!limitCheck.allowed) {
      setError(`Daily limit exceeded. Used ৳${limitCheck.used.toLocaleString()} of ৳${limitCheck.limit.toLocaleString()} today.`);
      setProcessing(false);
      return;
    }

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

  const PROGRESS_STEPS: Step[] = ["recipient", "amount", "confirm", "pin"];

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

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      {step !== "success" && (
        <motion.div
          className="gradient-send px-4 pt-3 pb-3 text-primary-foreground"
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
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowSendMoney")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("flowSecureTransfer")}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.55)]"
              animate={{ width: `${((STEPS.indexOf(step) + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
      )}

      {/* Animated step content */}
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

            {/* ── STEP 1: Recipient ── */}
            {step === "recipient" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("searchByNameNumberWallet")}</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      inputMode="text"
                      placeholder="Name, 01XXXXXXXXX or MFS-ABCD-EFGH"
                      value={inputVal}
                      maxLength={13}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className="pl-9 pr-12 h-12 text-base bg-card border-border"
                      autoFocus
                    />
                    <button
                      onClick={() => setShowScanner(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <QrCode size={16} className="text-muted-foreground" />
                    </button>
                  </div>

                  {/* live type badge */}
                  {inputVal.trim() && (
                    <div className="flex items-center gap-1.5">
                      {inputType ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {inputType === "phone" ? <Phone size={10} /> : <Hash size={10} />}
                          {inputType === "phone" ? t("mobileNumber") : t("walletIdLabel")}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Enter valid 11-digit number or MFS-ABCD-EFGH
                        </span>
                      )}
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                  {/* Pick from Contacts */}
                  <PermissionGate
                    permission="contacts"
                    onGranted={(contacts) => {
                      if (contacts?.[0]) {
                        const tel = contacts[0].tel?.[0]?.replace(/\D/g, "") || "";
                        const name = contacts[0].name?.[0] || "";
                        if (tel) {
                          setInputVal(tel);
                          setInputType(detectRecipientType(tel));
                          setRecipient({
                            id: "contact",
                            name: name || tel,
                            phone: tel,
                            initials: (name || tel).slice(0, 2).toUpperCase(),
                            gradient: "gradient-send",
                          });
                        }
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="w-full h-11 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98] transition-all"
                    >
                      <Contact2 size={16} />
                      Pick from Contacts
                    </button>
                  </PermissionGate>

                  {/* Upload QR from Gallery */}
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-full h-11 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98] transition-all"
                  >
                    <QrCode size={16} />
                    {t("uploadQrGallery")}
                  </button>

                  <Button
                    className="w-full h-11 gradient-send border-0 text-white font-semibold"
                    onClick={handleContinue}
                    disabled={!inputVal.trim()}
                  >
                    {t("continue")}
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t("recentContacts")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>


                <div className="space-y-2">
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectContact(c)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${c.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {c.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </div>
                      <ChevronLeft size={16} className="text-muted-foreground rotate-180 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: Amount ── */}
            {step === "amount" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {recipient && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${recipient.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {recipient.initials}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("sendingTo")}</p>
                      <p className="text-sm font-bold text-foreground">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground">{recipient.phone}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">{t("enterAmount")}</label>
                    <div className="flex flex-col items-end gap-0.5">
                      <AvailableBalanceBadge />
                      <DailyLimitBadge txnType="send" />
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
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{t("quickSelect")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmount(String(q))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                          amount === String(q)
                            ? "gradient-send text-white border-transparent shadow-card"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        ৳{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("noteOptional")}</label>
                  <Input
                    placeholder="What's it for?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>

                {/* Cash Out Charge Toggle */}
                <button
                  onClick={() => { setAddCashOutCharge(!addCashOutCharge); haptics.light(); }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                    addCashOutCharge
                      ? "border-primary bg-primary/10 shadow-card"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    addCashOutCharge ? "gradient-cashout text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    <Banknote size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">Add Cash Out Charge</p>
                    <p className="text-[11px] text-muted-foreground">Add 1.19% so recipient gets full amount after cash out</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors relative ${addCashOutCharge ? "bg-primary" : "bg-muted"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${addCashOutCharge ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </button>

                {amtNum > 0 && (
                  <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("amount")}</span>
                      <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                    </div>
                    {addCashOutCharge && cashOutExtra > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Cash Out Charge (1.19%)</span>
                        <span className="text-foreground font-medium">+ ৳{cashOutExtra.toLocaleString()}</span>
                      </div>
                    )}
                    {addCashOutCharge && cashOutExtra > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Send</span>
                        <span className="text-foreground font-medium">৳{sendAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("serviceFee")}</span>
                      <span className="text-foreground font-medium">
                        {fee === 0 ? <span className="text-primary font-semibold">{t("free")}</span> : `৳${fee}`}
                      </span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground/70">
                        <span>{t("feeSource")}</span>
                        <span>{feeFromBalance >= fee ? t("fromYourBalance") : feeFromBalance > 0 ? `৳${feeFromBalance} balance + ৳${feeFromAmount} from amount` : t("deductedFromAmount")}</span>
                      </div>
                    )}
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>{t("totalFromBalance")}</span>
                      <span>৳{totalFromBalance.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <Button className="w-full h-12 gradient-send border-0 text-white font-semibold text-base" onClick={handleAmountContinue}>
                  {t("reviewTransfer")}
                </Button>
              </div>
            )}

            {/* ── STEP 3: Confirm ── */}
            {step === "confirm" && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("youreSending")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`${recipient?.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0`}>
                      {recipient?.initials}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{recipient?.name}</p>
                      <p className="text-sm text-muted-foreground">{recipient?.phone}</p>
                    </div>
                  </div>
                  {note && (
                    <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{t("note")}: </span>{note}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3 text-sm">
                  <p className="font-semibold text-foreground">{t("transferSummary")}</p>
                  <div className="space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("sendAmount")}</span>
                      <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("serviceFee")}</span>
                      <span className="text-foreground font-medium">
                        {fee === 0 ? <span className="text-primary font-semibold">{t("free")}</span> : `৳${fee}`}
                      </span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span>{t("feeSource")}</span>
                        <span className="text-primary font-medium">{feeFromBalance >= fee ? t("fromBalance") : feeFromBalance > 0 ? `৳${feeFromBalance} balance + ৳${feeFromAmount} from amount` : "From send amount"}</span>
                      </div>
                    )}
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground text-base">
                      <span>{t("totalFromBalance")}</span>
                      <span>৳{totalFromBalance.toLocaleString()}</span>
                    </div>
                    {feeFromAmount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground/70">
                        <span>{t("recipientReceives")}</span>
                        <span>৳{recipientReceives.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
                  <User size={14} />
                  <span>{t("availableBalance")}: <strong className="text-foreground">৳12,450.75</strong></span>
                </div>

                <Button className="w-full h-12 gradient-send border-0 text-white font-bold text-base" onClick={handleConfirm}>
                  <Send size={18} /> {t("confirmEnterPin")}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => goTo("amount")}>{t("edit")}</Button>
              </div>
            )}

            {/* ── STEP 4: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("sending")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">to <span className="font-semibold text-foreground">{recipient?.name}</span></p>
                </div>

                <div className="rounded-2xl bg-muted/40 border border-border p-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("totalFromBalance")}</span>
                  <span className="font-bold text-foreground">৳{totalFromBalance.toLocaleString()}</span>
                </div>

                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label={t("slideToSend")}
                  gradient="gradient-send"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                  icon={Send}
                />
              </div>
            )}

            {/* ── STEP 5: Success ── */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 gradient-addmoney rounded-full flex items-center justify-center shadow-glow"
                >
                  <CheckCircle2 size={52} className="text-white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-foreground">{t("moneySent")}</h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{amtNum.toLocaleString()} sent to{" "}
                    <span className="font-semibold text-foreground">{recipient?.name}</span>
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("recipient")}</span><span className="text-foreground font-medium">{recipient?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("mobileWallet")}</span><span className="text-foreground font-medium">{recipient?.phone}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("amount")}</span><span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("fee")}</span>
                    <span className="text-foreground font-medium">{fee === 0 ? t("free") : `৳${fee}`}</span>
                  </div>
                  {fee > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>{t("feeDeductedFrom")}</span>
                      <span className="font-medium">{feeFromBalance >= fee ? t("fromBalance") : feeFromBalance > 0 ? `Balance (৳${feeFromBalance}) + Amount (৳${feeFromAmount})` : "Send amount"}</span>
                    </div>
                  )}
                  {feeFromAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("recipientReceives")}</span>
                      <span className="font-semibold text-primary">৳{recipientReceives.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("date")}</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("time")}</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>{t("transactionId")}</span>
                    <span className="text-primary">{txnId.current}</span>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full space-y-3">
                  <Button className="w-full h-12 gradient-send border-0 text-white font-semibold" onClick={onClose}>
                    {t("backToHome")}
                  </Button>
                  <Button variant="outline" className="w-full h-11" onClick={() => setShowShare(true)}>
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
