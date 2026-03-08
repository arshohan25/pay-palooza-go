import { useState, useRef, useEffect } from "react";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { requestLocation } from "@/lib/permissions";
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
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Zap,
  Flame,
  Droplets,
  Wifi,
  Tv2,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import FeatureGuard from "@/components/FeatureGuard";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "type" | "account" | "bill" | "pin" | "success";

interface BillType {
  id: string;
  name: string;
  providers: Provider[];
  icon: typeof Zap;
  gradient: string;
  accountLabel: string;
  accountPlaceholder: string;
  accountMaxLength: number;
}

interface Provider {
  id: string;
  name: string;
  short: string;
}

// ─── Bill catalogue ───────────────────────────────────────────────────────────
const BILL_TYPES: BillType[] = [
  {
    id: "electricity",
    name: "Electricity",
    icon: Zap,
    gradient: "gradient-accent",
    accountLabel: "Customer ID",
    accountPlaceholder: "e.g. 1234567890",
    accountMaxLength: 13,
    providers: [
      { id: "desco",  name: "DESCO",  short: "DE" },
      { id: "dpdc",   name: "DPDC",   short: "DP" },
      { id: "bpdb",   name: "BPDB",   short: "BP" },
      { id: "wzpdcl", name: "WZPDCL", short: "WZ" },
    ],
  },
  {
    id: "gas",
    name: "Gas",
    icon: Flame,
    gradient: "gradient-cashout",
    accountLabel: "Bill Account No.",
    accountPlaceholder: "e.g. 01-123456-00",
    accountMaxLength: 14,
    providers: [
      { id: "titas",    name: "Titas Gas",    short: "TG" },
      { id: "bakhrabad",name: "Bakhrabad Gas", short: "BG" },
      { id: "jalalabad",name: "Jalalabad Gas", short: "JG" },
    ],
  },
  {
    id: "water",
    name: "Water",
    icon: Droplets,
    gradient: "gradient-payment",
    accountLabel: "Connection No.",
    accountPlaceholder: "e.g. W-789012",
    accountMaxLength: 12,
    providers: [
      { id: "wasa",   name: "WASA (Dhaka)",      short: "DW" },
      { id: "cwasa",  name: "CWASA (Chittagong)", short: "CW" },
      { id: "kwasa",  name: "KWASA (Khulna)",     short: "KW" },
    ],
  },
  {
    id: "internet",
    name: "Internet",
    icon: Wifi,
    gradient: "gradient-addmoney",
    accountLabel: "Account / User ID",
    accountPlaceholder: "e.g. ISP-100234",
    accountMaxLength: 15,
    providers: [
      { id: "link3",      name: "Link3",          short: "L3" },
      { id: "aamranet",   name: "Aamra Networks",  short: "AN" },
      { id: "carnival",   name: "Carnival",        short: "CN" },
      { id: "infoland",   name: "Infoland",        short: "IL" },
    ],
  },
  {
    id: "tv",
    name: "TV / Cable",
    icon: Tv2,
    gradient: "gradient-send",
    accountLabel: "Subscriber ID",
    accountPlaceholder: "e.g. 5678901",
    accountMaxLength: 12,
    providers: [
      { id: "dishtv",  name: "Dish TV",      short: "DT" },
      { id: "toffee",  name: "Toffee (BTCL)", short: "TF" },
      { id: "akash",   name: "Akash DTH",    short: "AK" },
    ],
  },
];

// Bill amount is entered manually by the user (no mock generation)

const generateTxnId = () => {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "";
  for (let i = 0; i < 12; i++) r += CHARS[Math.floor(Math.random() * 36)];
  return r;
};

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["type", "account", "bill", "pin"];
const STEP_LABELS: Record<Step, string> = {
  type: "Bill Type", account: "Account", bill: "Details", pin: "PIN", success: "Done",
};

// ─── Slide animation ─────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Native PIN input ─────────────────────────────────────────────────────────
interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; }
const PinInput = ({ pin, onChange, error }: PinInputProps) => (
  <div className="space-y-5">
    <div className="flex justify-center gap-4">
      {[0,1,2,3].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: pin.length > i ? 1.15 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-5 h-5 rounded-full border-2 transition-colors ${
            pin.length > i ? "gradient-primary border-transparent shadow-md" : "border-muted-foreground/40 bg-transparent"
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
      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > pin.length) haptics.light(); onChange(v); }}
      autoFocus
      className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
      placeholder="••••"
    />
  </div>
);

// ─── PayBillFlow ─────────────────────────────────────────────────────────────
interface PayBillFlowProps { onClose: () => void; }

const PayBillFlow = ({ onClose }: PayBillFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]             = useState<Step>("type");
  const [direction, setDirection]   = useState(1);
  const [billType, setBillType]     = useState<BillType | null>(null);
  const [provider, setProvider]     = useState<Provider | null>(null);
  const [accountNo, setAccountNo]   = useState("");
  const [pin, setPin]               = useState("");
  const [error, setError]           = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [showShare, setShowShare]   = useState(false);

  const txnTime = useRef(new Date());
  const txnId   = useRef(generateTxnId());

  useEffect(() => { if (step === "success") { fireSuccessConfetti(); addTxnNotif(); } }, [step]);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "type")    { onClose(); return; }
    if (step === "account") { goTo("type"); return; }
    if (step === "bill")    { goTo("account"); return; }
    if (step === "pin")     { goTo("bill"); return; }
  };

  const handleSelectType = (bt: BillType) => {
    setBillType(bt);
    setProvider(null);
    setAccountNo("");
    goTo("account");
  };

  const handleAccountContinue = () => {
    if (!provider) { setError("Please select a provider."); return; }
    const trimmed = accountNo.trim();
    if (trimmed.length < 4) { setError(`Enter a valid ${billType?.accountLabel ?? "account number"}.`); return; }
    setBillAmount("");
    txnTime.current = new Date();
    txnId.current = generateTxnId();
    goTo("bill");
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
    const dueAmt = parseFloat(billAmount) || 0;
    const limitCheck = await checkDailyLimit("paybill", dueAmt);
    if (!limitCheck.allowed) {
      setError(`Daily limit exceeded. Used ৳${limitCheck.used.toLocaleString()} of ৳${limitCheck.limit.toLocaleString()} today.`);
      setProcessing(false);
      return;
    }

    // Silently capture location for fraud detection
    requestLocation().catch(() => {});
    haptics.success();
    await recordTransaction({
      type: "paybill",
      amount: dueAmt,
      fee: 0,
      recipientName: `${provider?.name} - ${billType?.name}`,
      description: `${billType?.name} bill - ${provider?.name} (${accountNo})`,
      reference: txnId.current,
    });
    showTxnToast({ type: "Bill Payment", amount: `৳${dueAmt.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-primary" });
    setDirection(1);
    setStep("success");
  };

  const FEE = 0; // bill payments are free

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      {step !== "success" && (
        <motion.div
          className="gradient-primary px-4 pt-3 pb-3 text-primary-foreground"
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
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowPayBill")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("flowUtilitiesFree")}</p>
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

      {/* Animated content */}
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

            {/* ── STEP 1: Bill Type ── */}
            {step === "type" && (
              <div className="px-4 pt-6 pb-32 space-y-3">
                <p className="text-sm font-semibold text-foreground mb-4">{t("selectBillType")}</p>
                {BILL_TYPES.map((bt) => {
                  const Icon = bt.icon;
                  return (
                    <motion.button
                      key={bt.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectType(bt)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${bt.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0`}>
                        <Icon size={22} strokeWidth={2} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">{bt.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {bt.providers.map((p) => p.name).join(" · ")}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* ── STEP 2: Provider + Account ── */}
            {step === "account" && billType && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                {/* Bill type pill */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                  <div className={`${billType.gradient} w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <billType.icon size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bill Type</p>
                    <p className="text-sm font-bold text-foreground">{billType.name}</p>
                  </div>
                </div>

                {/* Provider selection */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("selectProvider")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {billType.providers.map((p) => {
                      const selected = provider?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { setProvider(p); setError(""); }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            selected
                              ? "border-primary bg-primary/5 shadow-card"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <div className={`${billType.gradient} w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                            {p.short}
                          </div>
                          <span className="text-xs font-semibold text-foreground leading-tight">{p.name}</span>
                          {selected && <CheckCircle2 size={14} className="text-primary ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Account number */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{billType.accountLabel}</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={billType.accountPlaceholder}
                    value={accountNo}
                    maxLength={billType.accountMaxLength}
                    onChange={(e) => { setAccountNo(e.target.value); setError(""); }}
                    className="h-12 text-base bg-card border-border font-mono tracking-wider"
                  />
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                </div>

                <Button
                  className="w-full h-11 gradient-primary border-0 text-white font-semibold"
                  onClick={handleAccountContinue}
                >
                  {t("fetchBill")}
                </Button>
              </div>
            )}

            {/* ── STEP 3: Bill details ── */}
            {step === "bill" && billType && provider && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                {/* Available balance & daily limit */}
                <div className="flex justify-end">
                  <div className="flex flex-col items-end gap-0.5">
                    <AvailableBalanceBadge />
                    <DailyLimitBadge txnType="paybill" />
                  </div>
                </div>
                {/* Summary card */}
                <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                  {/* Colored top bar */}
                  <div className={`${billType.gradient} px-5 py-4 text-white`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <billType.icon size={18} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-xs text-white/70">{provider.name}</p>
                        <p className="text-sm font-bold">{billType.name} Bill</p>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Account No.</span>
                      <span className="text-xs font-semibold text-foreground">{accountNo}</span>
                    </div>

                    <div className="border-t border-border pt-3 mt-1 space-y-2">
                      <label className="text-sm font-semibold text-foreground">Enter Bill Amount</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={billAmount}
                          onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) { setBillAmount(v); setError(""); } }}
                          className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      {error && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle size={12} /> {error}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Service Fee</span>
                      <span className="text-xs font-semibold text-primary">Free</span>
                    </div>
                  </div>
                </div>

                {/* Info note */}
                <div className="flex items-start gap-2 px-1">
                  <FileText size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Payment will be deducted from your wallet balance. A confirmation SMS will be sent to your registered number.
                  </p>
                </div>

                <Button
                  className="w-full h-11 gradient-primary border-0 text-white font-semibold"
                  onClick={() => {
                    const val = parseFloat(billAmount);
                    if (!billAmount || isNaN(val) || val <= 0) { setError("Enter a valid bill amount."); return; }
                    goTo("pin");
                  }}
                  disabled={!billAmount || parseFloat(billAmount) <= 0}
                >
                  Pay ৳{(parseFloat(billAmount) || 0).toLocaleString()}
                </Button>
              </div>
            )}

            {/* ── STEP 4: PIN ── */}
            {step === "pin" && billType && (
              <div className="px-4 pt-8 pb-32 space-y-8">
                <div className="text-center space-y-1">
                  <p className="text-base font-bold text-foreground">{t("confirmPayment")}</p>
                  <p className="text-sm text-muted-foreground">
                    Paying <span className="font-semibold text-foreground">৳{(parseFloat(billAmount) || 0).toLocaleString()}</span> for {billType.name} bill
                  </p>
                </div>
                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />
                <div className="px-4">
                  <SlideToConfirm
                    onConfirm={handlePinConfirm}
                    label={t("slideToPayBill")}
                    gradient="gradient-primary"
                    disabled={pin.length < 4 || processing}
                    pinComplete={pin.length === 4}
                    icon={Zap}
                  />
                </div>
              </div>
            )}

            {/* ── SUCCESS ── */}
            {step === "success" && billType && provider && (
              <div className="px-4 pt-10 pb-20 flex flex-col items-center gap-6">
                {/* Success icon */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`${billType.gradient} w-24 h-24 rounded-full flex items-center justify-center shadow-elevated`}
                >
                  <CheckCircle2 size={48} className="text-white" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-center space-y-1"
                >
                  <p className="text-2xl font-extrabold text-foreground">{t("paymentSuccessfulBill")}</p>
                  <p className="text-sm text-muted-foreground">{billType.name} bill paid to {provider.name}</p>
                </motion.div>

                {/* Receipt */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="w-full rounded-2xl border border-border bg-card shadow-card overflow-hidden"
                >
                  {/* Amount band */}
                  <div className={`${billType.gradient} px-5 py-5 text-center text-white`}>
                    <p className="text-xs text-white/70 mb-1">Amount Paid</p>
                    <p className="text-4xl font-extrabold">৳{(parseFloat(billAmount) || 0).toLocaleString()}</p>
                  </div>

                  {/* Receipt rows */}
                  <div className="px-5 py-4 space-y-3">
                    {[
                      { label: "Bill Type",    value: `${billType.name} (${provider.name})` },
                      { label: "Account No.",  value: accountNo },
                      { label: "Amount",      value: `৳${(parseFloat(billAmount) || 0).toLocaleString()}` },
                      { label: "Service Fee",  value: FEE === 0 ? "Free" : `৳${FEE}` },
                      { label: "Fee Source",   value: "N/A (Free)" },
                      { label: "Transaction ID",value: txnId.current },
                      {
                        label: "Date & Time",
                        value: txnTime.current.toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        }),
                      },
                      { label: "Status",       value: "✓ Paid" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                        <span className={`text-xs font-semibold text-right break-all ${
                          label === "Status" ? "text-primary" : "text-foreground"
                        }`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="w-full space-y-3"
                >
                  <Button
                    className="w-full h-11 gradient-primary border-0 text-white font-semibold"
                    onClick={onClose}
                  >
                    {t("done")}
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

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Bill Payment Successful",
          amount: `৳${(parseFloat(billAmount) || 0).toLocaleString()}`,
          gradient: billType?.gradient ?? "gradient-primary",
          txnId: txnId.current,
          rows: [
            { label: "Bill Type", value: `${billType?.name ?? ""} (${provider?.name ?? ""})` },
            { label: "Account No.", value: accountNo },
            { label: "Amount", value: `৳${(parseFloat(billAmount) || 0).toLocaleString()}` },
            { label: "Fee", value: "Free" },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </motion.div>
  );
};

const PayBillFlowGuarded = (props: PayBillFlowProps) => (
  <FeatureGuard featureKey="pay_bill" onClose={props.onClose}>
    <PayBillFlow {...props} />
  </FeatureGuard>
);

export default PayBillFlowGuarded;

