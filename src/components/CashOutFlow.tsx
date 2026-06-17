import { validateRecipient } from "@/lib/recipientValidation";
import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeeConfig } from "@/hooks/use-fee-config";
import { requestLocation } from "@/lib/permissions";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { transferMoney, getBalance } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { checkDailyLimit } from "@/lib/dailyLimits";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { getPendingCoupon, calcCouponDiscount, clearPendingCoupon, recordCouponRedemption, type PendingCoupon } from "@/lib/couponStore";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";
import { Textarea } from "@/components/ui/textarea";

import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import {
  ChevronLeft,
  Search,
  MapPin,
  Hash,
  AlertCircle,
  Store,
  QrCode,
  CheckCircle2,
  Landmark,
  Users,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScannerModal from "@/components/QrScannerModal";
import { useI18n } from "@/lib/i18n";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import FeatureGuard from "@/components/FeatureGuard";
import FeatureLockedOverlay from "@/components/FeatureLockedOverlay";
import CouponBanner from "@/components/CouponBanner";
import CouponSummaryLine from "@/components/CouponSummaryLine";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "agent" | "amount" | "review" | "pin" | "success";

interface Agent {
  id: string;
  name: string;
  agentId: string;
  address: string;
  distance: string;
  initials: string;
  gradient: string;
  rating: number;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

const STEPS: Step[] = ["agent", "amount", "review", "pin"];
const STEP_LABELS: Record<Step, string> = {
  agent: "Agent",
  amount: "Amount",
  review: "Review",
  pin: "PIN",
  success: "Done",
};

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Native PIN input ────────────────────────────────────────────────────────
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
            pin.length > i ? "gradient-cashout border-transparent shadow-md" : "border-muted-foreground/40 bg-transparent"
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

// ─── CashOutFlow ──────────────────────────────────────────────────────────────
interface CashOutFlowProps {
  onClose: () => void;
}

const CashOutFlow = ({ onClose }: CashOutFlowProps) => {
  const { t, lang } = useI18n();
  const dateLocale = lang === "bn" ? "bn-BD" : "en-GB";
  const timeLocale = lang === "bn" ? "bn-BD" : "en-US";
  const { isLocked } = useFeatureLocks();
  const { calcCashOutFee, getFeeLabel, getAgentCommission, loading: feeLoading } = useFeeConfig();
  const cashOutLock = isLocked("cash_out");
  const [step, setStep] = useState<Step>("agent");
  const [direction, setDirection] = useState(1);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pendingCoupon] = useState<PendingCoupon | null>(() => getPendingCoupon("cash_out"));
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [recentAgents, setRecentAgents] = useState<Agent[]>([]);
  const [nearbyAgents, setNearbyAgents] = useState<Agent[]>([]);
  const [locationGranted, setLocationGranted] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  const txnTime = useRef(new Date());
  const genId = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };
  const txnId = useRef(genId());

  useEffect(() => {
    if (step === "success") {
      fireSuccessConfetti();
      addTxnNotif();
      txnId.current = genId();
    }
  }, [step]);

  const AGENT_GRADIENTS = ["gradient-cashout", "gradient-payment", "gradient-addmoney", "gradient-send", "gradient-accent"];

  // Fetch nearby agents via geolocation + RPC, fallback to recent txn agents
  useEffect(() => {
    let cancelled = false;

    const fetchNearby = async (lat: number, lng: number) => {
      const { data } = await supabase.rpc("get_nearby_agents", { p_lat: lat, p_lng: lng, p_radius_km: 10 });
      if (cancelled || !data) return;
      const agents: Agent[] = (data as any[]).map((a, i) => ({
        id: a.agent_id,
        name: a.business_name || "Agent",
        agentId: a.territory_code || a.agent_id.slice(0, 8),
        address: a.address || "",
        distance: `${a.distance_km} km`,
        initials: (a.business_name || "AG").slice(0, 2).toUpperCase(),
        gradient: AGENT_GRADIENTS[i % AGENT_GRADIENTS.length],
        rating: Number(a.avg_rating) || 0,
      }));
      setNearbyAgents(agents);
      setLoadingNearby(false);
    };

    const fetchRecent = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) { setLoadingNearby(false); return; }
      const { data: trans } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("type", "cashout")
        .order("created_at", { ascending: false });
      if (!trans || cancelled) { setLoadingNearby(false); return; }
      const seen = new Set<string>();
      const agents: Agent[] = [];
      for (const tx of trans) {
        const aid = tx.recipient_phone;
        if (!aid || seen.has(aid)) continue;
        seen.add(aid);
        const name = tx.recipient_name || "Agent";
        agents.push({
          id: tx.id, name, agentId: aid, address: "", distance: "",
          initials: name.slice(0, 2).toUpperCase(),
          gradient: AGENT_GRADIENTS[agents.length % AGENT_GRADIENTS.length],
          rating: 0,
        });
        if (agents.length >= 5) break;
      }
      setRecentAgents(agents);
      setLoadingNearby(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setLocationGranted(true);
          fetchNearby(pos.coords.latitude, pos.coords.longitude);
          fetchRecent(); // also load recent as fallback
        },
        () => { fetchRecent(); },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      fetchRecent();
    }

    return () => { cancelled = true; };
  }, []);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > STEPS.indexOf(step) ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "agent") { onClose(); return; }
    if (step === "amount") { goTo("agent"); return; }
    if (step === "review") { goTo("amount"); return; }
    if (step === "pin") { setPin(""); goTo("review"); return; }
  };

  const displayAgents = nearbyAgents.length > 0 ? nearbyAgents : recentAgents;
  const filteredAgents = displayAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.agentId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectAgent = (a: Agent) => {
    setAgent(a);
    setAgentIdInput(a.agentId);
    goTo("amount");
  };

  const [validating, setValidating] = useState(false);
  const [resolvedAgentPhone, setResolvedAgentPhone] = useState("");

  const validateAgentExists = async (agentId: string): Promise<{ exists: boolean; name?: string; phone?: string }> => {
    const { data, error } = await supabase.rpc("resolve_transfer_recipient", {
      p_identifier: agentId,
      p_flow: "cashout",
    });
    if (error) return { exists: false };
    const result = typeof data === "string" ? JSON.parse(data) : data;
    if (result?.found) {
      return { exists: true, name: result.recipient_name || undefined, phone: result.recipient_phone };
    }
    return { exists: false };
  };

  const handleQrScan = async (result: string) => {
    setAgentIdInput(result);
    setValidating(true);
    setError("");

    const validation = await validateAgentExists(result);
    setValidating(false);

    if (!validation.exists) {
      setError(t("coAgentNotFound"));
      return;
    }

    setResolvedAgentPhone(validation.phone || "");
    const found = recentAgents.find((a) => a.agentId.toLowerCase() === result.toLowerCase());
    if (found) {
      setAgent(found);
    } else {
      setAgent({ id: "qr", name: validation.name || "Agent", agentId: result, address: "", distance: "", initials: "AG", gradient: "gradient-cashout", rating: 0 });
    }
    goTo("amount");
  };

  const handleAgentIdContinue = async () => {
    const trimmed = agentIdInput.trim();
    if (trimmed.length < 5) { setError(t("coEnterValidAgentId")); return; }

    setValidating(true);
    setError("");
    const validation = await validateAgentExists(trimmed);
    setValidating(false);

    if (!validation.exists) {
      setError(t("coAgentNotFound"));
      return;
    }

    setResolvedAgentPhone(validation.phone || "");
    const found = recentAgents.find((a) => a.agentId.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      setAgent(found);
    } else {
      setAgent({ id: "custom", name: validation.name || "Agent", agentId: trimmed, address: "", distance: "", initials: "AG", gradient: "gradient-primary", rating: 0 });
    }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError(t("coEnterValidAmount")); return; }
    if (val < 30) { setError(t("coMinCashOut")); return; }
    if (val > 50000) { setError(t("coMaxCashOut")); return; }
    goTo("review");
  };

  const handleReviewContinue = () => goTo("pin");

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError(t("coEnterPin")); return; }
    if (processing) return;
    setProcessing(true);

    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError(t("coIncorrectPin")); setPin(""); setProcessing(false); return; }

    const amtVal = parseFloat(amount) || 0;
    const limitCheck = await checkDailyLimit("cashout", amtVal);
    if (!limitCheck.allowed) {
      setError(t("coDailyLimitUsed").replace("{used}", limitCheck.used.toLocaleString()).replace("{limit}", limitCheck.limit.toLocaleString()));
      setProcessing(false);
      return;
    }

    requestLocation().catch(() => {});
    haptics.success();
    txnTime.current = new Date();
    const feeVal = calcCashOutFee(amtVal);
    const couponDiscVal = pendingCoupon ? calcCouponDiscount(pendingCoupon, amtVal) : 0;
    const effectiveAmtVal = Math.max(0, amtVal - couponDiscVal);
    const commissionVal = getAgentCommission("cashout", amtVal);
    try {
      await transferMoney({
        recipientPhone: (resolvedAgentPhone || agent?.agentId) ?? "",
        amount: effectiveAmtVal,
        fee: feeVal,
        type: "cashout",
        recipientName: agent?.name,
        description: `Cash Out at ${agent?.name}` + (pendingCoupon ? ` [Coupon: ${pendingCoupon.code}]` : ""),
        reference: txnId.current,
        recipientType: "cashin",
        commission: commissionVal,
      });
    } catch (e: any) {
      setError(e.message || t("coCashOutFailed"));
      setPin("");
      setProcessing(false);
      return;
    }
    if (pendingCoupon) {
      await recordCouponRedemption({ code: pendingCoupon.code, flow: "cash_out", txnId: txnId.current, discount: couponDiscVal });
      clearPendingCoupon();
    }
    showTxnToast({ type: "Cash Out", amount: `৳${amtVal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-cashout" });
    setDirection(1);
    setStep("success");
    import("@/lib/activityTracker").then(({ activityTracker }) =>
      activityTracker.transaction("cashout_success", { amount: amtVal, fee: feeNum, txn_id: txnId.current })
    );
  };

  const FEE_LABEL = getFeeLabel("cashout");
  const BALANCE = getBalance();
  const feeNum = parseFloat(amount) > 0 ? calcCashOutFee(parseFloat(amount)) : 0;
  const couponDiscount = pendingCoupon ? calcCouponDiscount(pendingCoupon, parseFloat(amount) || 0) : 0;
  const fee = feeNum.toFixed(2);
  const feeFromBalance = Math.min(feeNum, BALANCE);
  const feeFromAmount  = parseFloat((feeNum - feeFromBalance).toFixed(2));
  const effectiveAmount = parseFloat(amount) > 0 ? Math.max(0, parseFloat(amount) - couponDiscount) : 0;
  const receive = effectiveAmount > 0
    ? (effectiveAmount - feeFromAmount).toFixed(2)
    : "0.00";
  const totalFromBalance = effectiveAmount > 0
    ? parseFloat((effectiveAmount + feeFromBalance).toFixed(2))
    : 0;

  if (cashOutLock.locked) {
    return (
      <FeatureLockedOverlay
        featureName="Cash Out"
        reason={cashOutLock.reason}
        expiresAt={cashOutLock.expiresAt}
        onClose={onClose}
      />
    );
  }

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
          className="gradient-send px-4 pt-3 pb-3 text-primary-foreground"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={goBack}
              aria-label={t("coGoBack")}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowCashOut")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("flowWithdrawAgent")}</p>
            </div>
          </div>
          <div
            className="h-1.5 rounded-full bg-white/20 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-label={t("coStepOf").replace("{n}", String(stepIndex + 1)).replace("{total}", String(STEPS.length))}
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

            {/* ── STEP 1: Agent ── */}
            {step === "agent" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Agent ID input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("agentIdLabel")}</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t("coAgentIdPlaceholder")}
                      value={agentIdInput}
                      onChange={(e) => { setAgentIdInput(e.target.value); setError(""); }}
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
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  {(() => {
                    const v = validateRecipient("agentId", agentIdInput);
                    return (
                      <>
                        {!error && v.errorMessage && (
                          <p className="text-xs text-destructive flex items-center gap-1 animate-fade-in">
                            <AlertCircle size={12} /> {v.errorMessage}
                          </p>
                        )}
                        {v.isValid && (
                          <Button
                            className="w-full h-11 gradient-cashout border-0 text-white font-semibold animate-fade-in"
                            onClick={handleAgentIdContinue}
                          >
                            {t("continue")}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin size={11} />
                    {locationGranted && nearbyAgents.length > 0 ? t("nearbyAgents") : t("coRecentAgents")}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {!locationGranted && !loadingNearby && (
                  <button
                    onClick={() => {
                      navigator.geolocation?.getCurrentPosition(
                        (pos) => {
                          setLocationGranted(true);
                          setLoadingNearby(true);
                          supabase.rpc("get_nearby_agents", { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_radius_km: 10 })
                            .then(({ data }) => {
                              if (data) {
                                setNearbyAgents((data as any[]).map((a, i) => ({
                                  id: a.agent_id, name: a.business_name || "Agent",
                                  agentId: a.territory_code || a.agent_id.slice(0, 8),
                                  address: a.address || "", distance: `${a.distance_km} km`,
                                  initials: (a.business_name || "AG").slice(0, 2).toUpperCase(),
                                  gradient: AGENT_GRADIENTS[i % AGENT_GRADIENTS.length], rating: Number(a.avg_rating) || 0,
                                })));
                              }
                              setLoadingNearby(false);
                            });
                        },
                        () => {},
                        { enableHighAccuracy: true, timeout: 5000 }
                      );
                    }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary font-medium"
                  >
                    <MapPin size={14} /> {t("coEnableLocation")}
                  </button>
                )}

                {displayAgents.length > 0 && (
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t("coSearchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-card border-border"
                    />
                  </div>
                )}

                {/* Agent list */}
                <div className="space-y-2">
                  {loadingNearby ? (
                    <div className="flex flex-col items-center py-8">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-xs text-muted-foreground">{t("coFindingNearby")}</p>
                    </div>
                  ) : displayAgents.length === 0 ? (
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
                        <Users className="w-7 h-7 text-muted-foreground" />
                      </motion.div>
                      <p className="text-sm font-semibold text-foreground">{t("coNoAgentsFound")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("coEnterAgentAbove")}</p>
                    </motion.div>
                  ) : filteredAgents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAgent(a)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${a.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {a.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                          <div className="flex items-center gap-1.5">
                            {a.rating > 0 && (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <Star size={9} className="fill-amber-500 text-amber-500" /> {a.rating.toFixed(1)}
                              </span>
                            )}
                            {a.distance && (
                              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5">
                                <MapPin size={9} /> {a.distance}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.agentId}</p>
                        {a.address && <p className="text-[10px] text-muted-foreground/70 truncate">{a.address}</p>}
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
                  <CouponBanner coupon={pendingCoupon} discount={couponDiscount} onRemove={() => { clearPendingCoupon(); window.location.reload(); }} />
                )}

                {agent && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${agent.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      <Store size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("cashingOutAt")}</p>
                      <p className="text-sm font-bold text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.agentId} · {agent.address}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">{t("enterAmount")}</label>
                    <div className="flex flex-col items-end gap-0.5">
                      <AvailableBalanceBadge />
                      <DailyLimitBadge txnType="cashout" />
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
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
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
                            ? "gradient-cashout text-white border-transparent shadow-card"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        ৳{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>




                {parseFloat(amount) > 0 && totalFromBalance > BALANCE && (
                  <p className="text-center text-sm text-destructive font-medium">{t("coInsufficientBalance")}</p>
                )}
                {parseFloat(amount) > 0 && totalFromBalance <= BALANCE && parseFloat(amount) > 35000 && (
                  <p className="text-center text-sm text-destructive font-medium">{t("coExceedsDailyLimit")}</p>
                )}
                {parseFloat(amount) > 0 && totalFromBalance <= BALANCE && parseFloat(amount) <= 35000 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <Button
                      className="w-full h-12 gradient-cashout border-0 text-white font-semibold text-base"
                      onClick={handleAmountContinue}
                    >
                      {t("coReviewCashOut")}
                    </Button>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── STEP 3: Review (summary before PIN) ── */}
            {step === "review" && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("cashingOut")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{parseFloat(amount).toLocaleString()}</p>
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3">
                  <div className={`${agent?.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <Store size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{agent?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{agent?.agentId}{agent?.address ? ` · ${agent.address}` : ""}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 space-y-2.5 text-sm">
                  <p className="font-semibold text-foreground">{t("coTransactionSummary")}</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("cashOutAmount")}</span>
                    <span className="text-foreground font-medium">৳{parseFloat(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("coFee")} ({FEE_LABEL})</span>
                    <span className="text-destructive font-medium">− ৳{fee}</span>
                  </div>
                  {couponDiscount > 0 && pendingCoupon && (
                    <CouponSummaryLine code={pendingCoupon.code} discount={couponDiscount} />
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground/70">
                    <span>{t("coFeeSource")}</span>
                    <span className="text-primary font-medium">
                      {feeFromBalance >= feeNum
                        ? t("coFeeFromBalance")
                        : feeFromBalance > 0
                        ? t("coFeeBalancePlusAmount").replace("{bal}", feeFromBalance.toFixed(2)).replace("{amt}", String(feeFromAmount))
                        : t("coFeeDeductedFromAmount")}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>{t("youReceive")}</span>
                    <span className="text-primary">৳{parseFloat(receive).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground/70">
                    <span>{t("coTotalFromBalance")}</span>
                    <span>৳{totalFromBalance.toLocaleString()}</span>
                  </div>
                </div>

                <Button className="w-full h-12 gradient-cashout border-0 text-white font-semibold text-base rounded-xl" onClick={handleReviewContinue}>
                  {t("coConfirmEnterPin")}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => goTo("amount")}>{t("coEditAmount")}</Button>
              </div>
            )}

            {/* ── STEP 4: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("cashingOut")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{parseFloat(amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("coAt")} <span className="font-semibold text-foreground">{agent?.name}</span>
                  </p>
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3">
                  <div className={`${agent?.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <Store size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{agent?.name}</p>
                    <p className="text-xs text-muted-foreground">{agent?.agentId} · {agent?.address}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/40 border border-border p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("youReceive")}</span>
                    <span className="font-bold text-primary">৳{parseFloat(receive).toLocaleString()}</span>
                  </div>
                  {feeNum > 0 && (
                    <p className="text-[11px] text-muted-foreground text-right">
                      ৳{parseFloat(amount).toLocaleString()} + ৳{fee} {t("coFee").toLowerCase()} ({feeFromBalance >= feeNum ? t("coFromBalanceShort") : feeFromBalance > 0 ? t("coBalancePlusAmountShort") : t("coFromAmountShort")})
                    </p>
                  )}
                </div>

                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label={t("slideToCashOut")}
                  gradient="gradient-cashout"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                  icon={Landmark}
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
                  className="w-24 h-24 gradient-cashout rounded-full flex items-center justify-center shadow-glow"
                >
                  <CheckCircle2 size={52} className="text-white" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <h2 className="text-2xl font-extrabold text-foreground">{t("cashOutSuccessful")}</h2>
                  <p className="text-muted-foreground text-sm">
                    {t("coCashedOutAt").replace("{amt}", `৳${parseFloat(amount).toLocaleString()}`)}{" "}
                    <span className="font-semibold text-foreground">{agent?.name}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("agent")}</span>
                    <span className="text-foreground font-medium">{agent?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("coAgentId")}</span>
                    <span className="text-foreground font-medium">{agent?.agentId}</span>
                  </div>
                   <div className="flex justify-between text-muted-foreground">
                    <span>{t("coAmount")}</span>
                    <span className="text-foreground font-medium">৳{parseFloat(amount).toLocaleString()}</span>
                  </div>
                  {couponDiscount > 0 && pendingCoupon && (
                    <CouponSummaryLine code={pendingCoupon.code} discount={couponDiscount} />
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("coFee")} ({FEE_LABEL})</span>
                    <span className="text-foreground font-medium">৳{fee}</span>
                  </div>
                  {feeNum > 0 && (
                    <p className="text-[11px] text-muted-foreground text-right">
                      ৳{parseFloat(amount).toLocaleString()} + ৳{fee} {t("coFee").toLowerCase()} ({feeFromBalance >= feeNum ? t("coFromBalanceShort") : feeFromBalance > 0 ? t("coBalancePlusAmountShort") : t("coFromAmountShort")})
                    </p>
                  )}
                  {feeFromAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("youReceived")}</span>
                      <span className="font-semibold text-primary">৳{parseFloat(receive).toLocaleString()}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between font-bold text-foreground">
                      <span>{t("coTotalDeducted")}</span>
                      <span>৳{(Math.max(0, parseFloat(amount) - couponDiscount) + feeNum).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("coDate")}</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("coTime")}</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>{t("coTransactionId")}</span>
                    <span className="text-primary">{txnId.current}</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-card p-4 space-y-3"
                >
                  <p className="text-sm font-semibold text-foreground text-center">
                    {ratingSubmitted ? "Thanks for your feedback! ✨" : "Rate this agent"}
                  </p>
                  {!ratingSubmitted ? (
                    <>
                      <div className="flex justify-center gap-2">
                        {[1,2,3,4,5].map((s) => (
                          <button
                            key={s}
                            onClick={() => { haptics.light(); setRatingValue(s); }}
                            className="p-1 active:scale-90 transition-transform"
                          >
                            <Star
                              size={28}
                              className={`transition-colors ${s <= ratingValue ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                            />
                          </button>
                        ))}
                      </div>
                      {ratingValue > 0 && (
                        <Textarea
                          placeholder="How was your experience? (optional)"
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          className="text-sm resize-none h-16"
                          maxLength={200}
                        />
                      )}
                      {ratingValue > 0 && (
                        <Button
                          size="sm"
                          className="w-full gradient-cashout border-0 text-white"
                          disabled={submittingRating}
                          onClick={async () => {
                            setSubmittingRating(true);
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user && agent) {
                              await supabase.from("agent_ratings").insert({
                                agent_id: agent.id,
                                user_id: session.user.id,
                                rating: ratingValue,
                                comment: ratingComment.trim(),
                                transaction_id: txnId.current,
                              } as any);
                            }
                            setRatingSubmitted(true);
                            setSubmittingRating(false);
                            haptics.success();
                          }}
                        >
                          {submittingRating ? "Submitting…" : "Submit Rating"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-center">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} size={20} className={s <= ratingValue ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"} />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="w-full space-y-3"
                >
                  <Button
                    className="w-full h-12 gradient-cashout border-0 text-white font-semibold"
                    onClick={onClose}
                  >
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
        title={t("scanAgentQr")}
      />

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Cash Out Successful",
          amount: `৳${parseFloat(amount || "0").toLocaleString()}`,
          gradient: "gradient-cashout",
          txnId: txnId.current,
          rows: [
            { label: "Agent", value: agent?.name ?? "" },
            { label: "Agent ID", value: agent?.agentId ?? "" },
            { label: "Amount", value: `৳${parseFloat(amount || "0").toLocaleString()}` },
            ...(couponDiscount > 0 ? [{ label: `🎟️ Coupon (${pendingCoupon?.code})`, value: `-৳${couponDiscount.toFixed(2)}` }] : []),
            { label: `Fee (${FEE_LABEL})`, value: `৳${feeNum.toFixed(2)}` },
            { label: "You Received", value: `৳${parseFloat(receive).toLocaleString()}` },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </motion.div>
  );
};

const CashOutFlowGuarded = (props: CashOutFlowProps) => (
  <FeatureGuard featureKey="cash_out" onClose={props.onClose}>
    <CashOutFlow {...props} />
  </FeatureGuard>
);

export default CashOutFlowGuarded;
