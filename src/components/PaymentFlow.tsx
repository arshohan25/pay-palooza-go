import { useState, useRef, useEffect, useCallback } from "react";
import { haptics } from "@/lib/haptics";
import { requestLocation } from "@/lib/permissions";
import { fireSuccessConfetti } from "@/lib/confetti";
import { transferMoney, getBalance } from "@/lib/balanceStore";
import { supabase } from "@/integrations/supabase/client";
import { verifyPin } from "@/lib/verifyPin";
import { checkDailyLimit } from "@/lib/dailyLimits";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { calcCouponDiscount, clearPendingCoupon, recordCouponRedemption, type PendingCoupon } from "@/lib/couponStore";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";

import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Hash,
  Ticket,
  Loader2,
  QrCode,
  ShoppingBag,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScannerModal from "@/components/QrScannerModal";
import { useI18n } from "@/lib/i18n";
import FeatureGuard from "@/components/FeatureGuard";
import CouponBanner from "@/components/CouponBanner";
import CouponSummaryLine from "@/components/CouponSummaryLine";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "merchant" | "amount" | "review" | "pin" | "success";

interface Merchant {
  id: string;
  name: string;
  merchantId: string;
  category: string;
  initials: string;
  gradient: string;
}

// Recent merchants loaded from real transaction history

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["merchant", "amount", "review", "pin"];
const STEP_LABELS: Record<Step, string> = {
  merchant: "Merchant",
  amount:   "Amount",
  review:   "Review",
  pin:      "PIN",
  success:  "Done",
};

// ─── Slide animation ──────────────────────────────────────────────────────────
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
            pin.length > i ? "gradient-payment border-transparent shadow-md" : "border-muted-foreground/40 bg-transparent"
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

// ─── PaymentFlow ──────────────────────────────────────────────────────────────
interface PaymentFlowProps { onClose: () => void; onDynamicQr?: (session: { sessionId: string; merchantId?: string; amount?: number; ref?: string | null }) => void; prefilledMerchantId?: string; }

const PaymentFlow = ({ onClose, onDynamicQr, prefilledMerchantId }: PaymentFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]           = useState<Step>("merchant");
  const [direction, setDirection] = useState(1);
  const [merchant, setMerchant]   = useState<Merchant | null>(null);
  const [merchantIdInput, setMerchantIdInput] = useState("");
  const [amount, setAmount]       = useState("");
  const [note, setNote]           = useState("");
  const [pin, setPin]             = useState("");
  const [error, setError]         = useState("");
  const [pendingCoupon, setPendingCoupon] = useState<PendingCoupon | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [recentMerchants, setRecentMerchants] = useState<Merchant[]>([]);
  const [resolvedMerchantUserId, setResolvedMerchantUserId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const txnTime = useRef(new Date());
  const genId = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };
  const txnId   = useRef(genId());

  // Auto-resolve prefilled merchant ID (from QR scan)
  const prefilledResolved = useRef(false);
  useEffect(() => {
    if (!prefilledMerchantId || prefilledResolved.current) return;
    prefilledResolved.current = true;
    const autoResolve = async () => {
      setMerchantIdInput(prefilledMerchantId);
      setValidating(true);
      setError("");
      const validation = await validateMerchantExists(prefilledMerchantId);
      setValidating(false);
      if (!validation.exists) {
        setError("Merchant not found. Please enter a valid Merchant ID or phone.");
        return;
      }
      setResolvedMerchantPhone(validation.phone || "");
      setResolvedMerchantUserId(validation.userId || null);
      setMerchant({ id: "prefilled", name: validation.name || "Merchant", merchantId: prefilledMerchantId, category: "Payment", initials: "MR", gradient: "gradient-payment" });
      goTo("amount");
    };
    autoResolve();
  }, [prefilledMerchantId]);

  // Fetch recent payment recipients from real transactions
  const GRADIENTS = ["gradient-payment", "gradient-addmoney", "gradient-accent", "gradient-cashout", "gradient-send"];
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: trans } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("type", "payment")
        .order("created_at", { ascending: false });
      if (!trans) return;
      const seen = new Set<string>();
      const merchants: Merchant[] = [];
      for (const tx of trans) {
        const mid = tx.recipient_phone;
        if (!mid || seen.has(mid)) continue;
        seen.add(mid);
        const name = tx.recipient_name || "Merchant";
        merchants.push({
          id: tx.id,
          name,
          merchantId: mid,
          category: "Payment",
          initials: name.slice(0, 2).toUpperCase(),
          gradient: GRADIENTS[merchants.length % GRADIENTS.length],
        });
        if (merchants.length >= 5) break;
      }
      setRecentMerchants(merchants);
    })();
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
    if (step === "merchant") { onClose(); return; }
    if (step === "amount")   { goTo("merchant"); return; }
    if (step === "review")   { goTo("amount"); return; }
    if (step === "pin")      { setPin(""); goTo("review"); return; }
  };

  const handleSelectMerchant = (m: Merchant) => {
    setMerchant(m);
    setMerchantIdInput(m.merchantId);
    goTo("amount");
  };

  const [validating, setValidating] = useState(false);
  const [resolvedMerchantPhone, setResolvedMerchantPhone] = useState("");

  const validateMerchantExists = async (merchantId: string): Promise<{ exists: boolean; name?: string; phone?: string; userId?: string }> => {
    const { data, error } = await supabase.rpc("resolve_transfer_recipient", {
      p_identifier: merchantId,
      p_flow: "payment",
    });
    if (error) return { exists: false };
    const result = typeof data === "string" ? JSON.parse(data) : data;
    if (result?.found) {
      return { exists: true, name: result.recipient_name || undefined, phone: result.recipient_phone, userId: result.recipient_id };
    }
    return { exists: false };
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    const currentAmt = parseFloat(amount) || 0;
    if (currentAmt <= 0) { setCouponError("Enter an amount first"); return; }
    setCouponLoading(true);
    setCouponError("");
    try {
      const { data, error } = await supabase.functions.invoke("apply-coupon", {
        body: { code, cart_total: currentAmt, merchant_id: resolvedMerchantUserId || null },
      });
      if (error) { setCouponError("Failed to validate coupon"); setCouponLoading(false); return; }
      if (data?.valid === false) { setCouponError(data.error || "Invalid coupon"); setCouponLoading(false); return; }
      const c = data?.coupon || data;
      if (c?.id) {
        setPendingCoupon({
          id: c.id,
          code: c.code || code,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          max_discount: c.max_discount || null,
          min_order_amount: c.min_order_amount || null,
          applicable_flow: c.applicable_flow || "payment",
        });
        setShowCouponSheet(false);
        setCouponCode("");
      } else {
        setCouponError("Invalid coupon code");
      }
    } catch {
      setCouponError("Something went wrong");
    }
    setCouponLoading(false);
  };

  const fetchAvailableCoupons = async () => {
    setCouponsLoading(true);
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .or("applicable_flow.is.null,applicable_flow.eq.payment,applicable_flow.eq.all")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(20);
      setAvailableCoupons(data || []);
    } catch {
      setAvailableCoupons([]);
    }
    setCouponsLoading(false);
  };

  const openCouponSheet = () => {
    setShowCouponSheet(true);
    fetchAvailableCoupons();
  };

  const handleApplyCouponFromList = (code: string) => {
    setCouponCode(code);
    const currentAmt = parseFloat(amount) || 0;
    if (currentAmt <= 0) { setCouponError("Enter an amount first"); return; }
    setCouponLoading(true);
    setCouponError("");
    supabase.functions.invoke("apply-coupon", {
      body: { code, cart_total: currentAmt, merchant_id: resolvedMerchantUserId || null },
    }).then(({ data, error }) => {
      if (error) { setCouponError("Failed to validate coupon"); setCouponLoading(false); return; }
      if (data?.valid === false) { setCouponError(data.error || "Invalid coupon"); setCouponLoading(false); return; }
      const c = data?.coupon || data;
      if (c?.id) {
        setPendingCoupon({
          id: c.id, code: c.code || code, discount_type: c.discount_type,
          discount_value: c.discount_value, max_discount: c.max_discount || null,
          min_order_amount: c.min_order_amount || null, applicable_flow: c.applicable_flow || "payment",
        });
        setShowCouponSheet(false);
        setCouponCode("");
      } else { setCouponError("Invalid coupon code"); }
      setCouponLoading(false);
    }).catch(() => { setCouponError("Something went wrong"); setCouponLoading(false); });
  };

  const handleQrScan = async (rawResult: string) => {
    // Extract clean merchant ID from structured QR payloads
    const { parseQrData } = await import("@/lib/qrParser");
    const parsed = parseQrData(rawResult);

    // Route dynamic payment QR back to parent
    if (parsed.flow === "dynamic_payment" && parsed.sessionId && onDynamicQr) {
      onDynamicQr({
        sessionId: parsed.sessionId,
        merchantId: parsed.identifier,
        amount: parsed.amount,
        ref: parsed.ref,
      });
      onClose();
      return;
    }

    const result = parsed.flow === "payment" ? parsed.identifier : rawResult;
    setMerchantIdInput(result);
    setValidating(true);
    setError("");

    const validation = await validateMerchantExists(result);
    setValidating(false);

    if (!validation.exists) {
      setError("Merchant not found. Please enter a valid Merchant ID or phone.");
      return;
    }

    setResolvedMerchantPhone(validation.phone || "");
    setResolvedMerchantUserId(validation.userId || null);
    const found = recentMerchants.find((m) => m.merchantId.toLowerCase() === result.toLowerCase());
    if (found) {
      setMerchant(found);
    } else {
      setMerchant({ id: "qr", name: validation.name || "Merchant", merchantId: result, category: "Payment", initials: "MR", gradient: "gradient-payment" });
    }
    goTo("amount");
  };

  const handleMerchantIdContinue = async () => {
    const trimmed = merchantIdInput.trim();
    if (trimmed.length < 5) { setError("Enter a valid Merchant ID."); return; }

    setValidating(true);
    setError("");
    const validation = await validateMerchantExists(trimmed);
    setValidating(false);

    if (!validation.exists) {
      setError("Merchant not found. Please enter a valid Merchant ID or phone.");
      return;
    }

    setResolvedMerchantPhone(validation.phone || "");
    setResolvedMerchantUserId(validation.userId || null);
    const found = recentMerchants.find((m) => m.merchantId.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      setMerchant(found);
    } else {
      setMerchant({ id: "custom", name: validation.name || "Merchant", merchantId: trimmed, category: "Payment", initials: "MR", gradient: "gradient-payment" });
    }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 1) { setError("Minimum payment is ৳1."); return; }
    // No maximum limit for payments
    goTo("review");
  };

  const handleReviewContinue = () => goTo("pin");

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    if (processing) return;
    setProcessing(true);

    // Verify PIN
    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }

    // Check daily limit
    const amtVal = parseFloat(amount) || 0;
    const limitCheck = await checkDailyLimit("payment", amtVal);
    if (!limitCheck.allowed) {
      setError(`Daily limit exceeded. Used ৳${limitCheck.used.toLocaleString()} of ৳${limitCheck.limit.toLocaleString()} today.`);
      setProcessing(false);
      return;
    }

    // Silently capture location for fraud detection
    requestLocation().catch(() => {});
    haptics.success();
    txnTime.current = new Date();
    const couponDiscVal = pendingCoupon ? calcCouponDiscount(pendingCoupon, amtVal) : 0;
    const effectiveAmtVal = Math.max(0, amtVal - couponDiscVal);
    try {
      await transferMoney({
        recipientPhone: (resolvedMerchantPhone || merchant?.merchantId) ?? "",
        amount: effectiveAmtVal,
        fee: 0,
        type: "payment",
        recipientName: merchant?.name,
        description: (pendingCoupon ? `[Coupon: ${pendingCoupon.code}] ` : "") + (note || `Payment to ${merchant?.name}`),
        reference: txnId.current,
      });
    } catch (e: any) {
      setError(e.message ?? "Payment failed");
      setPin("");
      setProcessing(false);
      return;
    }
    if (pendingCoupon) {
      await recordCouponRedemption({ code: pendingCoupon.code, flow: "payment", txnId: txnId.current, discount: couponDiscVal });
      clearPendingCoupon();
    }
    showTxnToast({ type: "Payment", amount: `৳${effectiveAmtVal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-payment" });
    setDirection(1);
    setStep("success");
  };

  const amtNum = parseFloat(amount) || 0;
  const couponDiscount = pendingCoupon ? calcCouponDiscount(pendingCoupon, amtNum) : 0;
  const effectiveAmount = Math.max(0, amtNum - couponDiscount);
  // Payment is free (no charge)

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-md sm:max-w-xl mx-auto"
      role="dialog"
      aria-modal="true">

      {/* Header */}
      {step !== "success" && (
        <motion.div
          className="gradient-payment px-4 pt-3 pb-3 text-primary-foreground"
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
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowPayment")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("flowMerchantQr")}</p>
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

      {/* Animated step content */}
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

            {/* ── STEP 1: Merchant ── */}
            {step === "merchant" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("merchantId")}</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. MRC-88901"
                      value={merchantIdInput}
                      onChange={(e) => { setMerchantIdInput(e.target.value); setError(""); }}
                      className="pl-9 pr-12 h-12 text-base bg-card border-border uppercase"
                    />
                    <button
                      onClick={() => setShowScanner(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <QrCode size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                  <Button
                    className="w-full h-11 gradient-payment border-0 text-white font-semibold"
                    onClick={handleMerchantIdContinue}
                  >
                    {t("continue")}
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag size={11} /> {t("recentMerchants")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Merchant list */}
                <div className="space-y-2">
                  {recentMerchants.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3"
                  >
                    <ShoppingBag className="w-7 h-7 text-muted-foreground" />
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">No recent merchants</p>
                  <p className="text-xs text-muted-foreground mt-1">Your payment history will appear here</p>
                </motion.div>
                  ) : recentMerchants.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMerchant(m)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${m.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {m.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.merchantId} · {m.category}</p>
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
                {/* Coupon applied banner */}
                {pendingCoupon && (
                  <CouponBanner coupon={pendingCoupon} discount={couponDiscount} onRemove={() => { clearPendingCoupon(); setPendingCoupon(null); }} />
                )}
                {merchant && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${merchant.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("payingTo")}</p>
                      <p className="text-sm font-bold text-foreground">{merchant.name}</p>
                      <p className="text-xs text-muted-foreground">{merchant.merchantId} · {merchant.category}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">{t("enterAmount")}</label>
                    <div className="flex flex-col items-end gap-0.5">
                      <AvailableBalanceBadge />
                      <DailyLimitBadge txnType="payment" />
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) { setAmount(v); setError(""); } }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                            ? "gradient-payment text-white border-transparent shadow-card"
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
                    placeholder="Invoice / reference…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>

                {/* Coupon trigger — ticket-cut style */}
                {!pendingCoupon ? (
                  <motion.button
                    type="button"
                    onClick={openCouponSheet}
                    whileTap={{ scale: 0.97 }}
                    className="w-full relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-primary/25 bg-gradient-to-r from-primary/[0.04] via-transparent to-primary/[0.04] overflow-hidden group"
                  >
                    {/* Shimmer sweep */}
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent pointer-events-none" />

                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Ticket size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground leading-tight">কুপন / প্রোমো কোড</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">ট্যাপ করে কুপন যোগ করুন বা বেছে নিন</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
                  </motion.button>
                ) : null}

                {/* Coupon wallet sheet */}
                <Sheet open={showCouponSheet} onOpenChange={setShowCouponSheet}>
                  <SheetContent side="bottom" className="rounded-t-3xl max-h-[75vh] overflow-y-auto px-0 pb-8 pt-0">
                    {/* Decorative header strip */}
                    <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-5 pt-5 pb-4">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                      <SheetHeader className="flex flex-row items-center justify-between p-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Ticket size={16} className="text-primary" />
                          </div>
                          <SheetTitle className="text-base font-bold text-foreground">
                            কুপন ওয়ালেট {availableCoupons.length > 0 && (
                              <span className="ml-1.5 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{availableCoupons.length}</span>
                            )}
                          </SheetTitle>
                        </div>
                      </SheetHeader>

                      {/* Manual code input */}
                      <div className="flex items-center gap-2 mt-4">
                        <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-background/80 backdrop-blur border border-border shadow-sm">
                          <span className="text-sm text-muted-foreground/60">✂</span>
                          <input
                            placeholder="কুপন কোড লিখুন"
                            value={couponCode}
                            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                            className="flex-1 bg-transparent text-sm font-mono font-semibold tracking-widest uppercase placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground/50 outline-none text-foreground"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="h-10 px-5 font-bold rounded-xl shadow-sm"
                        >
                          {couponLoading ? <Loader2 size={16} className="animate-spin" /> : "যোগ করুন"}
                        </Button>
                      </div>
                      {couponError && (
                        <p className="text-[11px] text-destructive flex items-center gap-1 px-1 mt-1.5">
                          <AlertCircle size={11} /> {couponError}
                        </p>
                      )}
                    </div>

                    {/* Coupon list — ticket cards */}
                    <div className="px-5 mt-4 space-y-3">
                      {couponsLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 size={22} className="animate-spin text-muted-foreground" />
                        </div>
                      ) : availableCoupons.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                            <Ticket size={28} className="opacity-30" />
                          </div>
                          <p className="text-sm font-medium">কোনো কুপন পাওয়া যায়নি</p>
                          <p className="text-xs mt-1 opacity-60">উপরে ম্যানুয়ালি কোড যোগ করুন</p>
                        </div>
                      ) : (
                        availableCoupons.map((c, i) => (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.25 }}
                            className="relative flex rounded-2xl overflow-hidden border border-border bg-card shadow-sm"
                          >
                            {/* Left discount strip */}
                            <div className="w-[72px] shrink-0 bg-gradient-to-b from-primary to-primary/80 flex flex-col items-center justify-center text-primary-foreground relative">
                              <span className="text-xl font-black leading-none">
                                {c.discount_type === "percentage" ? `${c.discount_value}%` : `৳${c.discount_value}`}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80">ছাড়</span>
                              {/* Perforation circles */}
                              <div className="absolute -right-[6px] top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
                                {[...Array(5)].map((_, j) => (
                                  <div key={j} className="w-3 h-3 rounded-full bg-background" />
                                ))}
                              </div>
                            </div>

                            {/* Right content */}
                            <div className="flex-1 flex items-center justify-between px-3.5 py-3 min-w-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-mono font-bold text-foreground tracking-wider">{c.code}</p>
                                {c.description && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {c.min_order_amount && (
                                    <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">Min ৳{c.min_order_amount}</span>
                                  )}
                                  {c.max_discount && c.discount_type === "percentage" && (
                                    <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">Max ৳{c.max_discount}</span>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleApplyCouponFromList(c.code)}
                                disabled={couponLoading}
                                className="h-8 px-3 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 shrink-0 ml-2 rounded-lg"
                              >
                                ব্যবহার করুন
                              </Button>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                {amtNum > 0 && (
                  <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("paymentAmount")}</span>
                      <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                    </div>
                    {couponDiscount > 0 && pendingCoupon && (
                      <CouponSummaryLine code={pendingCoupon.code} discount={couponDiscount} />
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("fee")}</span>
                      <span className="text-primary font-semibold">{t("free")}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>{t("total")}</span>
                      <span>৳{effectiveAmount.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {amtNum > 0 && effectiveAmount > getBalance() && (
                  <p className="text-center text-sm text-destructive font-medium">Insufficient balance</p>
                )}
                {amtNum > 0 && effectiveAmount <= getBalance() && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <Button className="w-full h-12 gradient-payment border-0 text-white font-semibold text-base" onClick={handleAmountContinue}>
                      Review Payment
                    </Button>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── STEP 3: Review (summary before PIN) ── */}
            {step === "review" && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("paying")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                  <div className={`${merchant?.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0`}>
                    {merchant?.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{merchant?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{merchant?.merchantId} · {merchant?.category}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 space-y-2.5 text-sm">
                  <p className="font-semibold text-foreground">Payment Summary</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("amount")}</span>
                    <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                  </div>
                  {couponDiscount > 0 && pendingCoupon && (
                    <CouponSummaryLine code={pendingCoupon.code} discount={couponDiscount} />
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("fee")}</span>
                    <span className="text-primary font-semibold">{t("free")}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>{t("total")}</span>
                    <span>৳{effectiveAmount.toLocaleString()}</span>
                  </div>
                </div>

                <Button className="w-full h-12 gradient-payment border-0 text-white font-semibold text-base rounded-xl" onClick={handleReviewContinue}>
                  Confirm & Enter PIN
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => goTo("amount")}>Edit Amount</Button>
              </div>
            )}

            {/* ── STEP 4: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("paying")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">to <span className="font-semibold text-foreground">{merchant?.name}</span></p>
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3">
                  <div className={`${merchant?.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{merchant?.name}</p>
                    <p className="text-xs text-muted-foreground">{merchant?.merchantId} · {merchant?.category}</p>
                  </div>
                </div>

                {note && (
                  <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Note: </span>{note}
                  </div>
                )}

                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label={t("slideToPayment")}
                  gradient="gradient-payment"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                  icon={CreditCard}
                />
              </div>
            )}

            {/* ── STEP 4: Success ── */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 gradient-payment rounded-full flex items-center justify-center shadow-glow"
                >
                  <CheckCircle2 size={52} className="text-white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-foreground">{t("paymentSuccessful")}</h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{amtNum.toLocaleString()} paid to{" "}
                    <span className="font-semibold text-foreground">{merchant?.name}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>Merchant</span><span className="text-foreground font-medium">{merchant?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Merchant ID</span><span className="text-foreground font-medium">{merchant?.merchantId}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Category</span><span className="text-foreground font-medium">{merchant?.category}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span><span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                  </div>
                  {couponDiscount > 0 && pendingCoupon && (
                    <CouponSummaryLine code={pendingCoupon.code} discount={couponDiscount} />
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee</span><span className="text-primary font-semibold">Free</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between font-bold text-foreground">
                      <span>You Pay</span><span>৳{effectiveAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {note && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Note</span><span className="text-foreground font-medium">{note}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Date</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Time</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Transaction ID</span>
                    <span className="text-primary">{txnId.current}</span>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full space-y-3">
                  <Button className="w-full h-12 gradient-payment border-0 text-white font-semibold" onClick={onClose}>
                    {t("backToHome")}
                  </Button>
                  <Button variant="outline" className="w-full h-11" onClick={() => setShowShare(true)}>{t("shareReceipt")}</Button>
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
        title={t("scanMerchantQr")}
      />

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Payment Successful",
          amount: `৳${amtNum.toLocaleString()}`,
          gradient: "gradient-payment",
          txnId: txnId.current,
          rows: [
            { label: "Merchant", value: merchant?.name ?? "" },
            { label: "Merchant ID", value: merchant?.merchantId ?? "" },
            { label: "Category", value: merchant?.category ?? "" },
            { label: "Amount", value: `৳${amtNum.toLocaleString()}` },
            ...(couponDiscount > 0 ? [{ label: `🎟️ Coupon (${pendingCoupon?.code})`, value: `-৳${couponDiscount.toFixed(2)}` }] : []),
            { label: "Fee", value: "Free" },
            ...(couponDiscount > 0 ? [{ label: "You Paid", value: `৳${effectiveAmount.toLocaleString()}` }] : []),
            ...(note ? [{ label: "Note", value: note }] : []),
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </motion.div>
  );
};

const PaymentFlowGuarded = (props: PaymentFlowProps) => (
  <FeatureGuard featureKey="payment" onClose={props.onClose}>
    <PaymentFlow {...props} />
  </FeatureGuard>
);

export default PaymentFlowGuarded;
