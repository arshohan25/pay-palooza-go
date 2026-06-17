import { validateRecipient } from "@/lib/recipientValidation";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { requestLocation, requestContacts, getCachedStatus } from "@/lib/permissions";
import { recordTransaction, getBalance } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { checkDailyLimit } from "@/lib/dailyLimits";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { getPendingCoupon, calcCouponDiscount, clearPendingCoupon, recordCouponRedemption, type PendingCoupon } from "@/lib/couponStore";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalToggles } from "@/hooks/use-global-toggles";

import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import {
  ChevronLeft,
  CheckCircle2,
  Smartphone,
  AlertCircle,
  Wifi,
  Phone,
  Package,
  PhoneCall,
  Clock,
  ChevronRight,
  Flame,
  Coins,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import FeatureGuard from "@/components/FeatureGuard";
import PermissionGate from "@/components/PermissionGate";
import { Contact2, RefreshCw } from "lucide-react";
import { loadContacts, saveContacts, mapStoredContactsToUI, getContactsWithFallback, type ContactUI } from "@/lib/contactStore";
import CouponBanner from "@/components/CouponBanner";
import CouponSummaryLine from "@/components/CouponSummaryLine";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "number" | "packs" | "amount" | "pin" | "success";
type OfferType = "drive" | "regular";
type SubCategory = "internet" | "minutes" | "bundles" | "callrates";

interface OperatorDef {
  name: string;
  short: string;
  brandColor: string;
  brandColorDark: string;
  prefixes: string[];
}

interface Pack {
  id: string;
  name: string;
  details: string;
  validity: string;
  price: number;
  badge?: string;
  tag?: "Hot" | "New" | "Limited" | "Popular";
  highlight?: boolean;
  type: OfferType;
  subCategory?: SubCategory;
  cashback?: number; // legacy field — now calculated as 2% for >৳99
}

/** Calculate 2% cashback for drive packs over ৳99 */
const calcCashback = (pack: Pack | null, amount?: number): number => {
  const price = amount ?? (pack?.price ?? 0);
  if (!pack || pack.type !== "drive" || price <= 99) return 0;
  return parseFloat((price * 0.02).toFixed(2));
};

// ─── Operator definitions ────────────────────────────────────────────────────
const OPERATORS: OperatorDef[] = [
  { name: "Grameenphone", short: "GP", brandColor: "#2FB5EA", brandColorDark: "#1A8FC0", prefixes: ["017", "013"] },
  { name: "Robi",         short: "RB", brandColor: "#E40046", brandColorDark: "#A8003A", prefixes: ["018"] },
  { name: "Banglalink",   short: "BL", brandColor: "#E87A1E", brandColorDark: "#C05A10", prefixes: ["019", "014"] },
  { name: "Teletalk",     short: "TT", brandColor: "#7BB31A", brandColorDark: "#5A8A10", prefixes: ["015"] },
  { name: "Airtel",       short: "AT", brandColor: "#ED1C24", brandColorDark: "#B5151B", prefixes: ["016"] },
];

const detectOperator = (phone: string): OperatorDef | null => {
  const digits = phone.replace(/\D/g, "");
  return OPERATORS.find((op) => op.prefixes.includes(digits.slice(0, 3))) ?? null;
};

// ─── Operator Logo Component ──────────────────────────────────────────────────
const OperatorLogo = ({ op, size = "md" }: { op: OperatorDef; size?: "xs" | "sm" | "md" | "lg" | "xl" }) => {
  const sizes = {
    xs: "w-8 h-8",
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };
  const textSizes: Record<string, string> = {
    xs: "text-[8px]",
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm",
  };

  const logos: Record<string, string> = {
    GP: "/operators/gp.png",
    RB: "/operators/robi.png",
    BL: "/operators/bl.png",
    TT: "/operators/tt.png",
    AT: "/operators/airtel.png",
  };

  return (
    <div
      className={`${sizes[size]} rounded-2xl flex flex-col items-center justify-center font-black shadow-lg overflow-hidden shrink-0 bg-card border border-border`}
    >
      <img
        src={logos[op.short]}
        alt={op.name}
        className="w-[65%] h-[65%] object-contain drop-shadow-md"
        onError={(e) => {
          // Fallback to text if image fails
          const parent = (e.target as HTMLElement).parentElement;
          if (parent) {
            (e.target as HTMLElement).style.display = "none";
            const span = document.createElement("span");
            span.className = "text-white font-black";
            span.textContent = op.short;
            parent.appendChild(span);
          }
        }}
      />
    </div>
  );
};

// ─── Pack Data ────────────────────────────────────────────────────────────────
// Pack data is now fetched from the database in the component below
// ─── Sub-category config ──────────────────────────────────────────────────────
const SUB_CATEGORIES: { id: SubCategory; labelKey: "mrSubInternet" | "mrSubMinutes" | "mrSubBundles" | "mrSubCallRates"; icon: typeof Wifi }[] = [
  { id: "internet",  labelKey: "mrSubInternet",  icon: Wifi },
  { id: "minutes",   labelKey: "mrSubMinutes",   icon: Phone },
  { id: "bundles",   labelKey: "mrSubBundles",   icon: Package },
  { id: "callrates", labelKey: "mrSubCallRates", icon: PhoneCall },
];


// ─── Tag badge colour map ─────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  Hot:     "bg-red-500 text-white",
  Limited: "bg-amber-500 text-white",
  New:     "bg-blue-500 text-white",
  Popular: "bg-primary text-primary-foreground",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STEPS: Step[] = ["number", "amount", "pin"];
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

const generateTxnId = () => {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "";
  for (let i = 0; i < 12; i++) r += CHARS[Math.floor(Math.random() * 36)];
  return r;
};

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

// ─── PIN Input ────────────────────────────────────────────────────────────────
interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; accentColor: string; }
const PinInput = ({ pin, onChange, error, accentColor }: PinInputProps) => (
  <div className="space-y-5">
    <div className="flex justify-center gap-5">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: pin.length > i ? 1.2 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-4 h-4 rounded-full border-2 transition-all ${pin.length > i ? "border-transparent shadow-md" : "border-muted-foreground/30 bg-transparent"}`}
          style={pin.length > i ? { background: accentColor } : {}}
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
      className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none transition-colors placeholder:text-muted-foreground/30"
      placeholder="••••"
    />
  </div>
);

// ─── MobileRechargeFlow ───────────────────────────────────────────────────────
interface MobileRechargeFlowProps { onClose: () => void; }

const MobileRechargeFlow = ({ onClose }: MobileRechargeFlowProps) => {
  const { t, lang } = useI18n();
  const numLocale = lang === "bn" ? "bn-BD" : "en-BD";
  const fmtAmt = (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(numLocale, opts);

  const [step, setStep]               = useState<Step>("number");
  const [pendingCoupon] = useState<PendingCoupon | null>(() => getPendingCoupon("recharge"));
  const [direction, setDirection]     = useState(1);
  const [phone, setPhone]             = useState("");
  const [selectedOp, setSelectedOp]   = useState<OperatorDef | null>(null);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [offerType, setOfferType]     = useState<OfferType>("drive");
  const [subCategory, setSubCategory] = useState<SubCategory>("internet");
  const [pin, setPin]                 = useState("");
  const [error, setError]             = useState("");
  const [showShare, setShowShare]     = useState(false);
  const [isPhoneDummy, setIsPhoneDummy] = useState(false);
  const txnTime = useRef(new Date());
  const txnId   = useRef(generateTxnId());

  // ── Imported contacts ──
  const [storedContacts, setStoredContacts] = useState<ContactUI[]>([]);
  const [syncingContacts, setSyncingContacts] = useState(false);

  useEffect(() => {
    const stored = getContactsWithFallback();
    setStoredContacts(mapStoredContactsToUI(stored));
  }, []);

  const handleSyncContacts = async () => {
    setSyncingContacts(true);
    try {
      const result = await requestContacts();
      if (result.status === "granted" && result.data) {
        const toStore = result.data.map((entry: any) => ({
          name: entry.name?.[0] || "Unknown",
          phone: (entry.tel?.[0] || "").replace(/[\s\-()]/g, ""),
        })).filter((c: any) => c.phone);
        const merged = saveContacts(toStore);
        setStoredContacts(mapStoredContactsToUI(merged));
      }
    } catch {}
    setSyncingContacts(false);
  };

  const filteredStoredContacts = useMemo(() => {
    if (!phone.trim()) return storedContacts;
    const q = phone.replace(/\D/g, "");
    return storedContacts.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [storedContacts, phone]);


  const [dbPacks, setDbPacks] = useState<Pack[]>([]);
  const { isDisabled } = useGlobalToggles();
  const driveHidden = isDisabled("drive_offers");

  const loadPacks = useCallback(async () => {
    const { data } = await supabase
      .from("recharge_packs")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (data) {
      setDbPacks((data as any[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        details: p.details,
        validity: p.validity,
        price: p.price,
        badge: p.badge ?? undefined,
        tag: p.tag ?? undefined,
        highlight: p.highlight,
        type: p.type as OfferType,
        subCategory: p.sub_category as SubCategory | undefined,
        cashback: p.cashback ?? 0,
        _operator: p.operator,
      })));
    }
  }, []);

  useEffect(() => { loadPacks(); }, [loadPacks]);

  // Realtime sync
  useEffect(() => {
    const ch = supabase
      .channel("recharge-packs-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "recharge_packs" }, () => loadPacks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPacks]);

  useEffect(() => { if (step === "success") { fireSuccessConfetti(); addTxnNotif(); } }, [step]);

  const stepIndex = STEPS.indexOf(step);
  const detectedOp = detectOperator(phone);
  const operator   = selectedOp ?? detectedOp;
  const allPacks   = operator ? dbPacks.filter((p: any) => p._operator === operator.name) : [];
  const drivePacks = driveHidden ? [] : allPacks.filter((p) => p.type === "drive");
  const regularPacks = allPacks.filter((p) => p.type === "regular" && p.subCategory === subCategory);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "number") {
      // If we came to number step from packs (drive pack flow), go back to packs
      if (selectedPack) { goTo("packs"); return; }
      onClose(); return;
    }
    if (step === "packs")  { setSelectedPack(null); setCustomAmount(""); goTo("number"); return; }
    if (step === "amount") {
      // If drive pack flow (came from operator tap with pack selected), go back to number entry
      if (selectedPack && !isPhoneDummy) { goTo("number"); return; }
      goTo("number"); return;
    }
    if (step === "pin")    { setPin(""); goTo("amount"); return; }
  };

  // Step 1 → Step 2: Continue goes straight to amount (skip packs)
  const handleNumberContinue = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) { setError(t("mrErr11Digit")); return; }
    if (!detectedOp) { setError(t("mrErrDetectOp")); return; }

    setSelectedOp(detectedOp);
    setIsPhoneDummy(false);
    // If a pack is already selected (drive pack flow), go to amount
    if (selectedPack) {
      setCustomAmount(String(selectedPack.price));
      goTo("amount");
      return;
    }
    setCustomAmount("");
    goTo("amount");
  };

  // Tap an operator card → go to packs (browse offers)
  const handleOperatorTap = (op: OperatorDef) => {
    setSelectedOp(op);
    if (detectedOp?.short !== op.short) {
      setPhone(op.prefixes[0] + "00000000");
      setIsPhoneDummy(true);
    }
    setSelectedPack(null);
    setCustomAmount("");
    setOfferType(driveHidden ? "regular" : "drive");
    setSubCategory("internet");
    setError("");
    haptics.medium();
    setDirection(1);
    setStep("packs");
  };

  const handlePackSelect = (pack: Pack) => {
    setSelectedPack(pack);
    setCustomAmount(String(pack.price));
    setError("");
    haptics.light();
  };

  // Packs → Number or Amount (drive pack + dummy phone → number entry first)
  const handlePackContinue = () => {
    if (!selectedPack) { setError(t("mrErrSelectPack")); return; }
    if (isPhoneDummy) {
      // Clear dummy phone so user enters real number
      setPhone("");
      setError("");
      goTo("number");
      return;
    }
    goTo("amount");
  };

  const customAmountNum = customAmount ? parseInt(customAmount, 10) : 0;
  const effectivePrice  = customAmountNum > 0 ? customAmountNum : 0;
  const effectiveName   = selectedPack ? selectedPack.name : t("mrCustomRecharge");

  // Amount → PIN
  const handleAmountContinue = () => {
    if (!customAmount || customAmountNum < 20) { setError(t("mrErrValidAmountMin")); return; }
    if (customAmountNum > 1000) { setError(t("mrErrMaxAmount")); return; }

    goTo("pin");
  };

  const [processing, setProcessing] = useState(false);
  const [apiStatus, setApiStatus] = useState<string | null>(null);

  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError(t("mrErrPin4")); return; }
    if (processing) return;
    setProcessing(true);

    // Verify PIN
    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError(t("incorrectPin")); setPin(""); setProcessing(false); return; }

    // Check daily limit
    const limitCheck = await checkDailyLimit("recharge", effectivePrice);
    if (!limitCheck.allowed) {
      setError(`${t("mrErrDailyLimit")} ${t("mrErrUsedOf")} ৳${fmtAmt(limitCheck.used)} / ৳${fmtAmt(limitCheck.limit)} ${t("mrErrOfToday")}`);
      setProcessing(false);
      return;
    }


    // Silently capture location for fraud detection
    requestLocation().catch(() => {});
    haptics.success();
    txnTime.current = new Date();
    txnId.current   = generateTxnId();

    // Try real-time API recharge if operator has it enabled
    let apiProcessed = false;
    if (operator) {
      setApiStatus(`Processing via ${operator.name} API...`);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("process-recharge", {
          body: {
            operator: operator.name,
            phone: phone.replace(/\D/g, ""),
            amount: effectivePrice,
            pack_name: selectedPack?.name,
            pack_type: selectedPack?.type ?? "regular",
          },
        });
        if (!fnErr && data?.success) {
          apiProcessed = data?.api_available ?? false;
          if (apiProcessed) {
            setApiStatus("Recharge confirmed by operator");
          }
          // Server credited cashback — show toast from server response
          if (data?.cashback_amount > 0) {
            showTxnToast({
              type: "Drive Cashback",
              amount: `+৳${data.cashback_amount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`,
              gradient: "bg-gradient-to-b from-amber-500 to-yellow-500",
            });
          }
        } else if (data?.api_available && !data?.success) {
          setApiStatus("API error, recording locally");
        }
      } catch {
        // Edge function unreachable — fall back silently
      }
    }
    setApiStatus(null);

    if (!apiProcessed) {
      toast.error("Recharge service unavailable. Please try again later.");
      setProcessing(false);
      return;
    }

    const packDesc = selectedPack ? selectedPack.name : `Recharge ৳${effectivePrice}`;

    const couponDiscVal = pendingCoupon ? calcCouponDiscount(pendingCoupon, effectivePrice) : 0;
    const finalPrice = Math.max(0, effectivePrice - couponDiscVal);

    await recordTransaction({
      type: "recharge",
      amount: finalPrice,
      fee: 0,
      recipientPhone: phone,
      recipientName: detectedOp?.name,
      reference: txnId.current,
      description: packDesc + " [API]" + (pendingCoupon ? ` [Coupon: ${pendingCoupon.code}]` : ""),
    });

    if (pendingCoupon) {
      await recordCouponRedemption({ code: pendingCoupon.code, flow: "recharge", txnId: txnId.current, discount: couponDiscVal });
      clearPendingCoupon();
    }
    showTxnToast({
      type: "Live Recharge",
      amount: `৳${finalPrice.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`,
      gradient: "gradient-primary",
    });
    setDirection(1);
    setStep("success");
  };

  const headerBg = operator
    ? `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})`
    : "linear-gradient(135deg, hsl(152 73% 39%), hsl(152 75% 29%))";

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      {step !== "success" && (
        <motion.div
          className="px-4 pt-3 pb-3 text-white shrink-0"
          style={{ background: headerBg }}
          layout
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowRecharge")}</h1>
              <p className="text-xs text-white/70 mt-0.5">
                {operator && step !== "number" ? `${operator.name} · ${t("instantTopUp")}` : t("selectOperatorOrNumber")}
              </p>
            </div>
            {operator && step !== "number" && (
              <OperatorLogo op={operator} size="sm" />
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
      )}

      {/* ── Animated step content ── */}
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

            {/* ══════════════════════════════════════════════
                STEP 1 — NUMBER ENTRY
            ══════════════════════════════════════════════ */}
            {step === "number" && (
              <div className="px-4 pt-5 pb-10 space-y-5">

                {/* Selected pack summary (drive pack flow) */}
                {selectedPack && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-primary/30 bg-primary/5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Selected pack</p>
                      <p className="text-sm font-bold text-foreground truncate">{selectedPack.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPack.details} · {selectedPack.validity}</p>
                    </div>
                    <p className="text-base font-extrabold text-primary shrink-0">৳{selectedPack.price}</p>
                  </motion.div>
                )}

                {/* Phone input + continue */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">{selectedPack ? "Enter recipient number" : "Mobile Number"}</label>
                  <div className="relative">
                    <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="017X-XXXX-XXXX"
                      value={formatPhone(phone)}
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); setError(""); }}
                      className="pl-9 h-12 text-base bg-card border-border tracking-wide"
                    />
                  </div>
                  {(() => {
                    const v = validateRecipient("phone", phone);
                    return v.errorMessage ? (
                      <p className="text-xs text-destructive flex items-center gap-1 animate-fade-in">
                        <AlertCircle size={12} /> {v.errorMessage}
                      </p>
                    ) : null;
                  })()}

                  {/* Live operator detection badge */}
                  <AnimatePresence>
                    {phone.length >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm"
                      >
                        {detectedOp ? (
                          <>
                            <OperatorLogo op={detectedOp} size="xs" />
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground leading-none">Detected operator</p>
                              <p className="text-sm font-bold text-foreground">{detectedOp.name}</p>
                            </div>
                            <CheckCircle2 size={18} className="text-primary shrink-0" />
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Smartphone size={16} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">Unknown operator</p>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}

                  {/* ── Contact list ── */}
                  {storedContacts.length === 0 ? null : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contacts</p>
                        <button
                          onClick={handleSyncContacts}
                          disabled={syncingContacts}
                          className="p-1.5 rounded-lg hover:bg-muted active:scale-95 transition-all"
                          title="Sync contacts"
                        >
                          <RefreshCw size={14} className={`text-muted-foreground ${syncingContacts ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto scrollbar-none space-y-1">
                        {filteredStoredContacts.slice(0, 50).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              const digits = c.phone.replace(/\D/g, "").slice(-11);
                              if (digits.length === 11) { setPhone(digits); setError(""); }
                              haptics.light();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 active:bg-muted active:scale-[0.98] transition-all text-left"
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${c.colorClass}`}>
                              {c.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.phone}</p>
                            </div>
                          </button>
                        ))}
                        {filteredStoredContacts.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">No matching contacts</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Primary Continue CTA — shows after a valid 11-digit number */}
                  {phone.replace(/\D/g, "").length === 11 && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleNumberContinue}
                      className="w-full h-13 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all animate-fade-in"
                      style={{ background: selectedPack ? (operator ? `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` : "linear-gradient(135deg, hsl(152 73% 39%), hsl(152 75% 29%))") : "linear-gradient(135deg, hsl(152 73% 39%), hsl(152 75% 29%))", minHeight: 52 }}
                    >
                      {selectedPack ? `Continue with ${selectedPack.name}` : "Continue"}
                      <ChevronRight size={18} />
                    </motion.button>
                  )}
                </div>

                {/* Operator cards — hide when a pack is already selected */}
                {!selectedPack && (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Browse Package & Special Offer</p>
                  <div className="space-y-2">
                    {OPERATORS.map((op) => (
                      <motion.button
                        key={op.name}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleOperatorTap(op)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border shadow-sm active:border-primary/30 transition-all text-left"
                      >
                        <OperatorLogo op={op} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{op.name}</p>
                          <p className="text-xs text-muted-foreground">{op.prefixes.join(", ")}</p>
                        </div>
                        {/* Drive cashback hint on operator card */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {!driveHidden && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                              <Coins size={9} />
                              Drive
                            </div>
                          )}
                          <ChevronRight size={14} className="text-muted-foreground" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 2 — PACKS (offers under operator)
            ══════════════════════════════════════════════ */}
            {step === "packs" && operator && (
              <div className="flex flex-col h-full">

                {/* Recharging info strip */}
                <div className="px-4 pt-2 pb-2 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-none">Recharging</p>
                      <p className="text-sm font-bold text-foreground truncate">{formatPhone(phone)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <AvailableBalanceBadge />
                    <DailyLimitBadge txnType="recharge" />
                  </div>
                </div>

                {/* Drive / Regular tabs */}
                <div className="px-4 pb-3 shrink-0">
                  <div className="flex bg-muted rounded-2xl p-1 gap-1">
                    {!driveHidden && (
                      <button
                        onClick={() => { setOfferType("drive"); setError(""); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          offerType === "drive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        <Flame size={14} className={offerType === "drive" ? "text-amber-500" : ""} />
                        ⚡ Drive
                      </button>
                    )}
                    <button
                      onClick={() => { setOfferType("regular"); setError(""); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        offerType === "regular" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      <Package size={14} className={offerType === "regular" ? "text-primary" : ""} />
                      Regular
                    </button>
                  </div>

                  {/* Drive explanation badge */}
                  <AnimatePresence>
                    {offerType === "drive" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
                          <Coins size={14} className="text-amber-600 shrink-0" />
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                            Drive packs earn you cashback commission credited to your wallet.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sub-category pills — Regular only */}
                <AnimatePresence>
                  {offerType === "regular" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-3 overflow-hidden shrink-0"
                    >
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {SUB_CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          const active = subCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => { setSubCategory(cat.id); setError(""); }}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 border ${
                                active ? "text-white border-transparent shadow-md" : "bg-card border-border text-muted-foreground"
                              }`}
                              style={active ? { background: operator.brandColor } : {}}
                            >
                              <Icon size={11} />
                              {t(cat.labelKey)}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pack list — scrollable */}
                <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-36">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={offerType + subCategory}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="space-y-3 pt-1"
                    >
                      {/* ── Drive Packs ── */}
                      {offerType === "drive" && drivePacks.map((pack) => {
                        const sel = selectedPack?.id === pack.id;
                        return (
                          <motion.button
                            key={pack.id}
                            onClick={() => handlePackSelect(pack)}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left rounded-2xl overflow-hidden border-2 transition-all ${
                              sel ? "shadow-lg" : "border-border shadow-sm"
                            }`}
                            style={sel ? { borderColor: operator.brandColor } : {}}
                          >
                            {/* Accent bar */}
                            <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${operator.brandColor}, ${operator.brandColorDark})` }} />
                            <div className="p-4 bg-card">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="text-sm font-extrabold text-foreground">{pack.name}</p>
                                    {pack.tag && (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_COLORS[pack.tag]}`}>
                                        {pack.tag}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">{pack.details}</p>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <Clock size={10} /> {pack.validity}
                                    </span>
                                    {/* Cashback badge — Drive only, 2% for >৳99 */}
                                    {calcCashback(pack) > 0 && (
                                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                        <Coins size={9} />
                                        Earn ৳{calcCashback(pack)} cashback
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <p className="text-xl font-extrabold text-foreground">৳{pack.price}</p>
                                  <div
                                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                                    style={sel
                                      ? { borderColor: operator.brandColor, background: operator.brandColor }
                                      : { borderColor: "hsl(var(--muted-foreground)/0.3)" }
                                    }
                                  >
                                    {sel && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}

                      {/* ── Regular Packs ── */}
                      {offerType === "regular" && regularPacks.map((pack) => {
                        const sel = selectedPack?.id === pack.id;
                        return (
                          <motion.button
                            key={pack.id}
                            onClick={() => handlePackSelect(pack)}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                              sel ? "shadow-lg" : "border-border bg-card shadow-sm"
                            }`}
                            style={sel ? { borderColor: operator.brandColor, background: `${operator.brandColor}10` } : {}}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-foreground">{pack.name}</p>
                                  {pack.badge && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      pack.highlight ? "text-white" : "bg-muted text-muted-foreground"
                                    }`}
                                      style={pack.highlight ? { background: operator.brandColor } : {}}
                                    >
                                      {pack.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{pack.details}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Clock size={9} /> {pack.validity}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <p className="text-lg font-extrabold text-foreground">৳{pack.price}</p>
                                <div
                                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                                  style={sel
                                    ? { borderColor: operator.brandColor, background: operator.brandColor }
                                    : { borderColor: "hsl(var(--muted-foreground)/0.3)" }
                                  }
                                >
                                  {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}

                      {offerType === "regular" && regularPacks.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                          No packs available in this category.
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Sticky bottom — Continue */}
                <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border px-4 py-4 space-y-2 shrink-0">
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1 px-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  {selectedPack && (
                    <div className="flex items-center justify-between text-sm px-1 pb-1">
                      <span className="text-muted-foreground font-medium truncate max-w-[65%]">{selectedPack.name}</span>
                      <div className="flex items-center gap-2">
                        {calcCashback(selectedPack) > 0 && (
                          <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5">
                            <Coins size={10} />+৳{calcCashback(selectedPack)}
                          </span>
                        )}
                        <span className="font-extrabold text-foreground">৳{selectedPack.price}</span>
                      </div>
                    </div>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePackContinue}
                    className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all"
                    style={{ background: selectedPack
                      ? `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})`
                      : "hsl(var(--muted))",
                      color: selectedPack ? "white" : "hsl(var(--muted-foreground))"
                    }}
                  >
                    {selectedPack ? `Continue · ৳${selectedPack.price}` : "Select a Pack"}
                    {selectedPack && <ChevronRight size={18} />}
                  </motion.button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 3 — AMOUNT
            ══════════════════════════════════════════════ */}
            {step === "amount" && operator && (
              <div className="px-4 pt-6 pb-10 space-y-5">
                {/* Coupon applied banner */}
                {pendingCoupon && (
                  <CouponBanner coupon={pendingCoupon} discount={calcCouponDiscount(pendingCoupon, effectivePrice)} onRemove={() => { clearPendingCoupon(); window.location.reload(); }} />
                )}

                {/* Operator + phone summary */}
                <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${operator.brandColor}, ${operator.brandColorDark})` }} />
                  <div className="bg-card p-4">
                    <div className="flex items-center gap-3">
                      <OperatorLogo op={operator} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-foreground">{operator.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPhone(phone)}</p>
                        {selectedPack && (
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[11px] text-foreground font-semibold">{selectedPack.name}</span>
                            {calcCashback(selectedPack) > 0 && (
                              <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                <Coins size={9} /> Earn ৳{calcCashback(selectedPack)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Recharge Amount</label>
                  <p className="text-xs text-muted-foreground">Enter any amount between ৳10 and ৳2,000</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">৳</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      autoFocus
                      value={customAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^\d*\.?\d*$/.test(v)) {
                          setCustomAmount(v.slice(0, 4));
                          setError("");
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="w-full h-16 pl-9 pr-4 text-2xl font-extrabold bg-card border-2 border-border rounded-2xl focus:outline-none transition-colors text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      style={{ borderColor: customAmountNum >= 10 ? operator.brandColor : undefined }}
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Min ৳10 · Max ৳2,000</p>

                  {/* Quick amount pills */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {[50, 100, 199, 299, 399, 499].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => { setCustomAmount(String(amt)); setError(""); haptics.light(); }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-card text-foreground hover:border-primary/40 active:scale-95 transition-all"
                        style={customAmountNum === amt ? { borderColor: operator.brandColor, color: operator.brandColor } : {}}
                      >
                        ৳{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balance */}
                <div className="flex justify-center">
                  <AvailableBalanceBadge />
                </div>

                {/* Continue to PIN */}
                {customAmountNum > 0 && customAmountNum > getBalance() && (
                  <p className="text-center text-sm text-destructive font-medium">Insufficient balance</p>
                )}
                {customAmountNum > 0 && customAmountNum <= getBalance() && (customAmountNum < 20 || customAmountNum > 1000) && (
                  <p className="text-center text-sm text-destructive font-medium">
                    {customAmountNum < 20 ? "Minimum recharge ৳20" : "Maximum recharge ৳1,000"}
                  </p>
                )}
                {customAmountNum >= 20 && customAmountNum <= 1000 && customAmountNum <= getBalance() && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAmountContinue}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` }}
                  >
                    Continue · ৳{customAmountNum}
                    <ChevronRight size={18} />
                  </motion.button>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 4 — PIN
            ══════════════════════════════════════════════ */}
            {step === "pin" && operator && (
              <div className="px-4 pt-8 pb-10 space-y-6">
                {/* Summary card */}
                <div className="rounded-2xl overflow-hidden shadow-sm border border-border">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${operator.brandColor}, ${operator.brandColorDark})` }} />
                  <div className="bg-card p-4 space-y-3 text-sm">
                    <div className="flex items-center gap-3 pb-3 border-b border-border">
                      <OperatorLogo op={operator} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-foreground">{effectiveName}</p>
                        <p className="text-xs text-muted-foreground">{operator.name} · {formatPhone(phone)}</p>
                      </div>
                      <p className="text-xl font-extrabold text-foreground">৳{effectivePrice}</p>
                    </div>
                    {selectedPack && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Details</span>
                          <span className="font-semibold text-foreground text-right max-w-[55%]">{selectedPack.details}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Validity</span>
                          <span className="font-semibold text-foreground">{selectedPack.validity}</span>
                        </div>
                        {calcCashback(selectedPack, effectivePrice) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Drive Cashback (2%)</span>
                            <span className="font-bold text-amber-600 flex items-center gap-1">
                              <Coins size={11} /> +৳{calcCashback(selectedPack, effectivePrice)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {pendingCoupon && calcCouponDiscount(pendingCoupon, effectivePrice) > 0 && (
                      <CouponSummaryLine code={pendingCoupon.code} discount={calcCouponDiscount(pendingCoupon, effectivePrice)} />
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Service fee</span>
                      <span className="font-semibold text-primary">Free</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Total from balance</span>
                      <span>৳{Math.max(0, effectivePrice - (pendingCoupon ? calcCouponDiscount(pendingCoupon, effectivePrice) : 0))}</span>
                    </div>
                  </div>
                </div>

                {/* PIN entry */}
                <div className="space-y-1 text-center">
                  <p className="text-sm font-semibold text-foreground">Enter your 4-digit PIN</p>
                  <p className="text-xs text-muted-foreground">Authorize this recharge</p>
                </div>
                <PinInput
                  pin={pin}
                  onChange={(p) => { setPin(p); setError(""); }}
                  error={error}
                  accentColor={operator.brandColor}
                />
                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label="Slide to Recharge"
                  gradient="gradient-primary"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                  icon={Smartphone}
                />
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 5 — SUCCESS
            ══════════════════════════════════════════════ */}
            {step === "success" && operator && (
              <div className="min-h-screen flex flex-col">
                {/* Hero */}
                <div className="px-4 pt-10 pb-12 text-white text-center" style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` }}>
                  <div className="flex justify-center mb-5">
                    <OperatorLogo op={operator} size="xl" />
                  </div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
                  >
                    <p className="text-sm font-semibold text-white/80 mb-1">Recharge Successful!</p>
                    <p className="text-5xl font-extrabold">৳{effectivePrice}</p>
                    <p className="text-white/70 text-sm mt-2">{operator.name} · {formatPhone(phone)}</p>
                    {calcCashback(selectedPack, effectivePrice) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-3 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5"
                      >
                        <Coins size={14} className="text-amber-300" />
                        <span className="text-sm font-bold">৳{calcCashback(selectedPack, effectivePrice)} cashback earned!</span>
                      </motion.div>
                    )}
                  </motion.div>
                </div>

                {/* Receipt */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="flex-1 px-4 py-6 space-y-4"
                >
                  <div className="rounded-2xl bg-card border border-border shadow-sm p-4 space-y-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt</p>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Transaction ID</span>
                      <span className="font-mono font-bold text-foreground text-xs">{txnId.current}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Date & Time</span>
                      <span className="font-semibold text-foreground text-xs">
                        {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                        {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between text-muted-foreground">
                      <span>Number</span>
                      <span className="font-semibold text-foreground">{formatPhone(phone)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Operator</span>
                      <span className="font-semibold text-foreground">{operator.name}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pack</span>
                      <span className="font-semibold text-foreground">{selectedPack ? selectedPack.name : "Custom"}</span>
                    </div>
                    {selectedPack && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Details</span>
                          <span className="font-semibold text-foreground text-right max-w-[55%]">{selectedPack.details}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Validity</span>
                          <span className="font-semibold text-foreground">{selectedPack.validity}</span>
                        </div>
                        {calcCashback(selectedPack, effectivePrice) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Drive Cashback (2%)</span>
                            <span className="font-bold text-amber-600">+৳{calcCashback(selectedPack, effectivePrice)}</span>
                          </div>
                        )}
                      </>
                    )}
                     <div className="flex justify-between text-muted-foreground">
                      <span>Service fee</span>
                      <span className="font-semibold text-primary">Free</span>
                    </div>
                    {pendingCoupon && calcCouponDiscount(pendingCoupon, effectivePrice) > 0 && (
                      <CouponSummaryLine code={pendingCoupon.code} discount={calcCouponDiscount(pendingCoupon, effectivePrice)} />
                    )}
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Deducted from balance</span>
                      <span>৳{Math.max(0, effectivePrice - (pendingCoupon ? calcCouponDiscount(pendingCoupon, effectivePrice) : 0))}</span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={onClose}
                    className="w-full h-12 rounded-2xl text-white font-bold shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` }}
                  >
                    Done
                  </motion.button>
                  <button
                    onClick={() => setShowShare(true)}
                    className="w-full h-12 rounded-2xl border border-border bg-card text-foreground font-semibold text-sm"
                  >
                    Share Receipt
                  </button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Share Receipt */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Recharge Successful",
          amount: `৳${effectivePrice}`,
          gradient: "gradient-primary",
          txnId: txnId.current,
          rows: [
            { label: "Number",   value: formatPhone(phone) },
            { label: "Operator", value: operator?.name ?? "" },
            { label: "Pack",     value: selectedPack ? selectedPack.name : "Custom" },
            ...(selectedPack ? [
              { label: "Details",  value: selectedPack.details },
              { label: "Validity", value: selectedPack.validity },
              ...(selectedPack.cashback ? [{ label: "Cashback", value: `+৳${selectedPack.cashback}` }] : []),
            ] : []),
            ...(pendingCoupon && calcCouponDiscount(pendingCoupon, effectivePrice) > 0 ? [{ label: `🎟️ Coupon (${pendingCoupon.code})`, value: `-৳${calcCouponDiscount(pendingCoupon, effectivePrice).toFixed(2)}` }] : []),
            { label: "Fee",      value: "Free" },
            { label: "Deducted", value: `৳${Math.max(0, effectivePrice - (pendingCoupon ? calcCouponDiscount(pendingCoupon, effectivePrice) : 0))}` },
            { label: "Date",     value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time",     value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </motion.div>
  );
};

const MobileRechargeFlowGuarded = (props: MobileRechargeFlowProps) => (
  <FeatureGuard featureKey="mobile_recharge" onClose={props.onClose}>
    <MobileRechargeFlow {...props} />
  </FeatureGuard>
);

export default MobileRechargeFlowGuarded;
