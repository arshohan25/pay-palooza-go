import { validateRecipient } from "@/lib/recipientValidation";
import { useState, useRef, useEffect, forwardRef } from "react";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { requestLocation } from "@/lib/permissions";
import { recordTransaction } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { checkDailyLimit } from "@/lib/dailyLimits";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { getPendingCoupon, calcCouponDiscount, clearPendingCoupon, recordCouponRedemption, type PendingCoupon } from "@/lib/couponStore";
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
import CouponBanner from "@/components/CouponBanner";
import CouponSummaryLine from "@/components/CouponSummaryLine";

type Step = "type" | "account" | "bill" | "review" | "pin" | "success";

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
      { id: "desco", name: "DESCO", short: "DE" },
      { id: "dpdc", name: "DPDC", short: "DP" },
      { id: "bpdb", name: "BPDB", short: "BP" },
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
      { id: "titas", name: "Titas Gas", short: "TG" },
      { id: "bakhrabad", name: "Bakhrabad Gas", short: "BG" },
      { id: "jalalabad", name: "Jalalabad Gas", short: "JG" },
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
      { id: "wasa", name: "WASA (Dhaka)", short: "DW" },
      { id: "cwasa", name: "CWASA (Chittagong)", short: "CW" },
      { id: "kwasa", name: "KWASA (Khulna)", short: "KW" },
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
      { id: "link3", name: "Link3", short: "L3" },
      { id: "aamranet", name: "Aamra Networks", short: "AN" },
      { id: "carnival", name: "Carnival", short: "CN" },
      { id: "infoland", name: "Infoland", short: "IL" },
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
      { id: "dishtv", name: "Dish TV", short: "DT" },
      { id: "toffee", name: "Toffee (BTCL)", short: "TF" },
      { id: "akash", name: "Akash DTH", short: "AK" },
    ],
  },
];

const generateTxnId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let value = "";
  for (let index = 0; index < 12; index += 1) {
    value += chars[Math.floor(Math.random() * 36)];
  }
  return value;
};

const STEPS: Step[] = ["type", "account", "bill", "review", "pin"];
const STEP_LABELS: Record<Step, string> = {
  type: "Bill Type",
  account: "Account",
  bill: "Details",
  review: "Review",
  pin: "PIN",
  success: "Done",
};

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? "100%" : "-100%", opacity: 0 }),
};

interface PinInputProps {
  pin: string;
  onChange: (pin: string) => void;
  error: string;
}

const PinInput = ({ pin, onChange, error }: PinInputProps) => (
  <div className="space-y-5">
    <div className="flex justify-center gap-4">
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={index}
          animate={{ scale: pin.length > index ? 1.15 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-5 h-5 rounded-full border-2 transition-colors ${
            pin.length > index
              ? "gradient-primary border-transparent shadow-md"
              : "border-muted-foreground/40 bg-transparent"
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
      onChange={(event) => {
        const value = event.target.value.replace(/\D/g, "").slice(0, 4);
        if (value.length > pin.length) haptics.light();
        onChange(value);
      }}
      autoFocus
      className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
      placeholder="••••"
    />
  </div>
);

interface PayBillFlowProps {
  onClose: () => void;
}

const PayBillFlow = forwardRef<HTMLDivElement, PayBillFlowProps>(({ onClose }, ref) => {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("type");
  const [direction, setDirection] = useState(1);
  const [billType, setBillType] = useState<BillType | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingCoupon] = useState<PendingCoupon | null>(() => getPendingCoupon("bill_pay"));

  const txnTime = useRef(new Date());
  const txnId = useRef(generateTxnId());

  useEffect(() => {
    if (step === "success") {
      fireSuccessConfetti();
      addTxnNotif();
    }
  }, [step]);

  const stepIndex = STEPS.indexOf(step);
  const fee = 0;

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "type") {
      onClose();
      return;
    }
    if (step === "account") {
      goTo("type");
      return;
    }
    if (step === "bill") {
      goTo("account");
      return;
    }
    if (step === "review") {
      goTo("bill");
      return;
    }
    if (step === "pin") {
      setPin("");
      goTo("review");
    }
  };

  const handleSelectType = (nextBillType: BillType) => {
    setBillType(nextBillType);
    setProvider(null);
    setAccountNo("");
    goTo("account");
  };

  const handleAccountContinue = () => {
    if (!provider) {
      setError("Please select a provider.");
      return;
    }

    const trimmed = accountNo.trim();
    if (trimmed.length < 4) {
      setError(`Enter a valid ${billType?.accountLabel ?? "account number"}.`);
      return;
    }

    setBillAmount("");
    txnTime.current = new Date();
    txnId.current = generateTxnId();
    goTo("bill");
  };

  const handlePinConfirm = async () => {
    if (pin.length < 4) {
      setError("Enter your 4-digit PIN.");
      return;
    }
    if (processing) return;

    setProcessing(true);

    const pinValid = await verifyPin(pin);
    if (!pinValid) {
      setError("Incorrect PIN. Please try again.");
      setPin("");
      setProcessing(false);
      return;
    }

    const dueAmount = parseFloat(billAmount) || 0;
    const limitCheck = await checkDailyLimit("paybill", dueAmount);
    if (!limitCheck.allowed) {
      setError(
        `Daily limit exceeded. Used ৳${limitCheck.used.toLocaleString()} of ৳${limitCheck.limit.toLocaleString()} today.`
      );
      setProcessing(false);
      return;
    }

    requestLocation().catch(() => {});
    haptics.success();

    const couponDiscVal = pendingCoupon ? calcCouponDiscount(pendingCoupon, dueAmount) : 0;
    const finalAmount = Math.max(0, dueAmount - couponDiscVal);

    await recordTransaction({
      type: "paybill",
      amount: finalAmount,
      fee: 0,
      recipientName: `${provider?.name} - ${billType?.name}`,
      description: `${billType?.name} bill - ${provider?.name} (${accountNo})` + (pendingCoupon ? ` [Coupon: ${pendingCoupon.code}]` : ""),
      reference: txnId.current,
    });

    if (pendingCoupon) {
      await recordCouponRedemption({ code: pendingCoupon.code, flow: "bill_pay", txnId: txnId.current, discount: couponDiscVal });
      clearPendingCoupon();
    }
    showTxnToast({
      type: "Bill Payment",
      amount: `৳${finalAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`,
      gradient: "gradient-primary",
    });

    setDirection(1);
    setStep("success");
    setProcessing(false);
    import("@/lib/activityTracker").then(({ activityTracker }) =>
      activityTracker.transaction("paybill_success", { amount: finalAmount })
    );
  };

  return (
    <motion.div
      ref={ref}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-md sm:max-w-xl mx-auto"
      role="dialog"
      aria-modal="true"
    >
      {step !== "success" && (
        <motion.div
          className="gradient-send px-4 pt-3 pb-3 text-primary-foreground"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowPayBill")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("flowUtilitiesFree")}</p>
            </div>
          </div>
          <div
            className="h-1.5 rounded-full bg-white/20 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
          >
            <motion.div
              className="h-full bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.55)]"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="wait">
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
            {step === "type" && (
              <div className="px-4 pt-6 pb-32 space-y-3">
                <p className="text-sm font-semibold text-foreground mb-4">{t("selectBillType")}</p>
                {BILL_TYPES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectType(item)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${item.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0`}>
                        <Icon size={22} strokeWidth={2} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.providers.map((providerItem) => providerItem.name).join(" · ")}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            )}

            {step === "account" && billType && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                  <div className={`${billType.gradient} w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <billType.icon size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bill Type</p>
                    <p className="text-sm font-bold text-foreground">{billType.name}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("selectProvider")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {billType.providers.map((providerItem) => {
                      const selected = provider?.id === providerItem.id;
                      return (
                        <button
                          key={providerItem.id}
                          onClick={() => {
                            setProvider(providerItem);
                            setError("");
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            selected
                              ? "border-primary bg-primary/5 shadow-card"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <div className={`${billType.gradient} w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                            {providerItem.short}
                          </div>
                          <span className="text-xs font-semibold text-foreground leading-tight">{providerItem.name}</span>
                          {selected && <CheckCircle2 size={14} className="text-primary ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{billType.accountLabel}</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={billType.accountPlaceholder}
                    value={accountNo}
                    maxLength={billType.accountMaxLength}
                    onChange={(event) => {
                      setAccountNo(event.target.value);
                      setError("");
                    }}
                    onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="h-12 text-base bg-card border-border font-mono tracking-wider"
                  />
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  {(() => {
                    const v = validateRecipient("billAccount", accountNo, billType.accountLabel);
                    return !error && v.errorMessage ? (
                      <p className="text-xs text-destructive flex items-center gap-1 animate-fade-in">
                        <AlertCircle size={12} /> {v.errorMessage}
                      </p>
                    ) : null;
                  })()}
                </div>

                {provider && validateRecipient("billAccount", accountNo, billType.accountLabel).isValid && (
                  <Button
                    className="w-full h-11 gradient-primary border-0 text-white font-semibold animate-fade-in"
                    onClick={handleAccountContinue}
                  >
                    {t("fetchBill")}
                  </Button>
                )}
              </div>
            )}

            {step === "bill" && billType && provider && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                {/* Coupon applied banner */}
                {pendingCoupon && (
                  <CouponBanner coupon={pendingCoupon} discount={calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0)} onRemove={() => { clearPendingCoupon(); window.location.reload(); }} />
                )}
                <div className="flex justify-end">
                  <div className="flex flex-col items-end gap-0.5">
                    <AvailableBalanceBadge />
                    <DailyLimitBadge txnType="paybill" />
                  </div>
                </div>

                <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
                  <div className={`${billType.gradient} p-4 text-white`}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                        <billType.icon size={22} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-xs text-white/75">{provider.name}</p>
                        <p className="text-base font-extrabold">{billType.name} Bill</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="rounded-2xl bg-muted/50 border border-border px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{billType.accountLabel}</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{accountNo}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Enter Bill Amount</label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="1"
                        value={billAmount}
                        onChange={(event) => {
                          setBillAmount(event.target.value);
                          setError("");
                        }}
                        placeholder="e.g. 1250"
                        className="h-12 text-lg font-semibold"
                      />
                      {error && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle size={12} /> {error}
                        </p>
                      )}
                    </div>

                  </div>
                </div>

                <Button
                  className="w-full h-11 gradient-primary border-0 text-white font-semibold"
                  onClick={() => {
                    if ((parseFloat(billAmount) || 0) <= 0) {
                      setError("Enter a valid bill amount.");
                      return;
                    }
                    goTo("review");
                  }}
                >
                  Review Payment
                </Button>
              </div>
            )}

            {step === "review" && billType && provider && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">Paying</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{Math.max(0, (parseFloat(billAmount) || 0) - (pendingCoupon ? calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) : 0)).toLocaleString()}</p>
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                  <div className={`${billType.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <billType.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{provider.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{billType.accountLabel}: {accountNo}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 space-y-2.5 text-sm">
                  <p className="font-semibold text-foreground">Bill Summary</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Bill Amount</span>
                    <span className="text-foreground font-medium">৳{(parseFloat(billAmount) || 0).toLocaleString()}</span>
                  </div>
                  {pendingCoupon && calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) > 0 && (
                    <CouponSummaryLine code={pendingCoupon.code} discount={calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0)} />
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Fee</span>
                    <span className="text-primary font-semibold">Free</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground/70">
                    <span>Fee source</span>
                    <span className="text-primary font-medium">From your balance</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Total</span>
                    <span>৳{Math.max(0, (parseFloat(billAmount) || 0) - (pendingCoupon ? calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) : 0)).toLocaleString()}</span>
                  </div>
                </div>

                <Button className="w-full h-12 gradient-primary border-0 text-white font-semibold text-base rounded-xl" onClick={() => goTo("pin")}>
                  Confirm & Enter PIN
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => goTo("bill")}>Edit Amount</Button>
              </div>
            )}

            {step === "pin" && (
              <div className="px-4 pt-8 pb-32 space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-card">
                    <FileText size={24} />
                  </div>
                  <h2 className="text-xl font-extrabold text-foreground">Confirm payment</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your PIN to pay ৳{((parseFloat(billAmount) || 0) + fee).toLocaleString()} to {provider?.name}
                  </p>
                </div>

                <PinInput
                  pin={pin}
                  onChange={(value) => {
                    setPin(value);
                    setError("");
                  }}
                  error={error}
                />

                <SlideToConfirm
                  disabled={pin.length < 4 || processing}
                  onConfirm={handlePinConfirm}
                  label={processing ? "Processing..." : `Slide to pay ৳${((parseFloat(billAmount) || 0) + fee).toLocaleString()}`}
                />
              </div>
            )}

            {step === "success" && (
              <div className="px-4 pt-10 pb-10 min-h-full flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="text-center space-y-3">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-10 h-10 text-primary" />
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-foreground">Bill paid successfully</h2>
                      <p className="text-sm text-muted-foreground mt-1">Your utility payment has been completed instantly.</p>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
                    <div className={`${billType?.gradient ?? "gradient-primary"} p-5 text-white text-center`}>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/75">Total Paid</p>
                      <p className="text-4xl font-extrabold mt-1">৳{Math.max(0, (parseFloat(billAmount) || 0) - (pendingCoupon ? calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) : 0)).toLocaleString()}</p>
                    </div>

                    <div className="p-4 divide-y divide-border/70">
                     {[
                        { label: "Bill Type", value: `${billType?.name ?? ""} (${provider?.name ?? ""})` },
                        { label: "Account No.", value: accountNo },
                        { label: "Bill Amount", value: `৳${(parseFloat(billAmount) || 0).toLocaleString()}` },
                        ...(pendingCoupon && calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) > 0
                          ? [{ label: `🎟️ Coupon (${pendingCoupon.code})`, value: `-৳${calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0).toFixed(2)}` }]
                          : []),
                        { label: "Fee", value: "Free" },
                        { label: "Total Paid", value: `৳${Math.max(0, (parseFloat(billAmount) || 0) - (pendingCoupon ? calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) : 0)).toLocaleString()}` },
                        {
                          label: "Date",
                          value: txnTime.current.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }),
                        },
                        {
                          label: "Time",
                          value: txnTime.current.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          }),
                        },
                        { label: "Transaction ID", value: txnId.current },
                      ].map((row) => (
                        <div key={row.label} className="py-3 flex items-start justify-between gap-3">
                          <span className="text-sm text-muted-foreground">{row.label}</span>
                          <span className="text-sm font-semibold text-foreground text-right break-all">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <motion.div
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="w-full space-y-3"
                >
                  <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold" onClick={onClose}>
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
            { label: "Bill Amount", value: `৳${(parseFloat(billAmount) || 0).toLocaleString()}` },
            ...(pendingCoupon && calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) > 0
              ? [{ label: `🎟️ Coupon (${pendingCoupon.code})`, value: `-৳${calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0).toFixed(2)}` }]
              : []),
            { label: "Fee", value: "Free" },
            { label: "Total Paid", value: `৳${Math.max(0, (parseFloat(billAmount) || 0) - (pendingCoupon ? calcCouponDiscount(pendingCoupon, parseFloat(billAmount) || 0) : 0)).toLocaleString()}` },
            {
              label: "Date",
              value: txnTime.current.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
            },
            {
              label: "Time",
              value: txnTime.current.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }),
            },
          ],
        }}
      />
    </motion.div>
  );
});

PayBillFlow.displayName = "PayBillFlow";

const PayBillFlowGuarded = forwardRef<HTMLDivElement, PayBillFlowProps>((props, ref) => (
  <FeatureGuard featureKey="pay_bill" onClose={props.onClose}>
    <PayBillFlow {...props} ref={ref} />
  </FeatureGuard>
));

PayBillFlowGuarded.displayName = "PayBillFlowGuarded";

export default PayBillFlowGuarded;
