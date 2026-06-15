import Seo from "@/components/Seo";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Landmark, TrendingUp,
  Calendar, Banknote, Sparkles, ChevronRight, ShieldCheck, AlertTriangle,
  TrendingDown, CreditCard, ShoppingBag, Wallet, FileText, ChevronDown,
  Percent, ArrowUpRight, Info, PiggyBank, BarChart3, RefreshCw, Target,
  CircleDollarSign, BadgeCheck, Timer, ArrowDownRight, Receipt, Star,
  Gauge, Shield, Eye, EyeOff, DollarSign, CalendarClock, Ban, Heart,
  HandCoins, Scale, AlertCircle, Lock
} from "lucide-react";
import { verifyPin } from "@/lib/verifyPin";
import SlideToConfirm from "@/components/SlideToConfirm";
import { haptics } from "@/lib/haptics";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAiRewards } from "@/hooks/use-ai-rewards";
import { useFutureFeatures } from "@/hooks/use-future-features";
import AiRewardBanner from "@/components/AiRewardBanner";

const AMOUNTS = [1000, 2000, 3000, 5000, 10000, 15000, 25000, 50000];
const TENURES = [
  { days: 30, label: "1 Month" },
  { days: 60, label: "2 Months" },
  { days: 90, label: "3 Months" },
  { days: 180, label: "6 Months" },
  { days: 270, label: "9 Months" },
  { days: 365, label: "1 Year" },
];

// Flat one-time service fee — NOT interest. Sharia-compliant.
const SERVICE_FEE_PERCENT = 3;

const MIN_TOTAL_TXNS = 15;
const MIN_ADD_MONEY_AMOUNT = 5000;
const MIN_PAYMENT_COUNT = 5;
const MIN_ACCOUNT_AGE_DAYS = 30;

interface EligibilityResult {
  eligible: boolean;
  score: number;
  maxAmount: number;
  checks: {
    label: string;
    passed: boolean;
    current: string;
    required: string;
    icon: React.ReactNode;
    weight: number;
  }[];
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bg: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-500", label: "Under Review", bg: "bg-amber-500/10" },
  approved: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-500", label: "Approved", bg: "bg-emerald-500/10" },
  rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-destructive", label: "Rejected", bg: "bg-destructive/10" },
  disbursed: { icon: <Banknote className="w-3.5 h-3.5" />, color: "text-blue-500", label: "Active", bg: "bg-blue-500/10" },
  repaid: { icon: <BadgeCheck className="w-3.5 h-3.5" />, color: "text-muted-foreground", label: "Settled", bg: "bg-muted" },
};

type TabType = "apply" | "active" | "history";

const LoanPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const futureFeatures = useFutureFeatures();
  void futureFeatures.visibility.future_easypay_score;
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const [amount, setAmount] = useState("5000");
  const [tenure, setTenure] = useState("90");
  const [submitting, setSubmitting] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("apply");
  const [showBalance, setShowBalance] = useState(true);
  const { rewards: aiLoanRewards, claimReward: claimLoanReward } = useAiRewards("loan");
  const [loanPin, setLoanPin] = useState("");
  const [loanPinError, setLoanPinError] = useState("");
  const [repayLoan, setRepayLoan] = useState<any | null>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayPin, setRepayPin] = useState("");
  const [repayPinError, setRepayPinError] = useState("");
  const [repayProcessing, setRepayProcessing] = useState(false);

  const handleRepayLoan = async () => {
    if (!repayLoan) return;
    const amt = parseFloat(repayAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (repayPin.length < 4) { setRepayPinError("Enter your 4-digit PIN"); return; }
    setRepayProcessing(true); setRepayPinError("");
    const pinValid = await verifyPin(repayPin);
    if (!pinValid) { setRepayPinError("Incorrect PIN"); setRepayPin(""); setRepayProcessing(false); return; }
    const { data, error } = await supabase.rpc("repay_loan_partial" as any, { p_loan_id: repayLoan.id, p_amount: amt });
    if (error) { toast.error(error.message || "Repayment failed"); setRepayProcessing(false); return; }
    haptics.success();
    const result = data as any;
    if (result?.status === "repaid") toast.success("🎉 Loan fully settled!");
    else toast.success(`✓ ৳${result?.paid?.toLocaleString()} repaid · ৳${result?.outstanding?.toLocaleString()} remaining`);
    const { data: refreshed } = await supabase.from("loan_applications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    setApplications(refreshed || []);
    setRepayLoan(null); setRepayAmount(""); setRepayPin(""); setRepayProcessing(false);
  };

  useEffect(() => {
    if (!kycLoading && kycStatus !== "verified") {
      toast.error("Please complete KYC verification to use this feature.");
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate]);

  const amountNum = parseInt(amount) || 5000;
  const tenureNum = parseInt(tenure) || 90;

  const calc = useMemo(() => {
    // Flat one-time service fee — no compounding, no time-based interest
    const serviceFee = Math.round(amountNum * SERVICE_FEE_PERCENT / 100);
    const totalPayable = amountNum + serviceFee;
    const installments = Math.ceil(tenureNum / 30);
    const monthlyPayment = Math.round(totalPayable / installments);

    return {
      serviceFee,
      totalPayable,
      installments,
      monthlyPayment,
      loanAmount: amountNum,
    };
  }, [amountNum, tenureNum]);

  const checkEligibility = useCallback(async () => {
    if (!user) return;
    setEligibilityLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const [txnResult, profileResult] = await Promise.all([
      supabase.from("transactions").select("type, amount, created_at").eq("user_id", user.id).eq("status", "completed").gte("created_at", monthStart.toISOString()),
      supabase.from("profiles").select("created_at").eq("user_id", user.id).single(),
    ]);
    const txns = txnResult.data || [];
    const profileCreated = profileResult.data?.created_at ? new Date(profileResult.data.created_at) : now;
    const accountAgeDays = Math.floor((now.getTime() - profileCreated.getTime()) / (1000 * 60 * 60 * 24));
    const totalTxns = txns.length;
    const addMoneyTotal = txns.filter(t => t.type === "addmoney").reduce((s, t) => s + Number(t.amount), 0);
    const paymentCount = txns.filter(t => ["payment", "recharge", "paybill"].includes(t.type)).length;
    const shoppingCount = txns.filter(t => t.type === "payment").length;

    const checks = [
      { label: "Account Age", passed: accountAgeDays >= MIN_ACCOUNT_AGE_DAYS, current: `${accountAgeDays} days`, required: `${MIN_ACCOUNT_AGE_DAYS}+ days`, icon: <Calendar className="w-4 h-4" />, weight: 25 },
      { label: "Transactions", passed: totalTxns >= MIN_TOTAL_TXNS, current: `${totalTxns}`, required: `${MIN_TOTAL_TXNS}+`, icon: <TrendingUp className="w-4 h-4" />, weight: 25 },
      { label: "Add Money", passed: addMoneyTotal >= MIN_ADD_MONEY_AMOUNT, current: `৳${addMoneyTotal.toLocaleString()}`, required: `৳${MIN_ADD_MONEY_AMOUNT.toLocaleString()}+`, icon: <Wallet className="w-4 h-4" />, weight: 20 },
      { label: "Payments", passed: paymentCount >= MIN_PAYMENT_COUNT, current: `${paymentCount}`, required: `${MIN_PAYMENT_COUNT}+`, icon: <CreditCard className="w-4 h-4" />, weight: 15 },
      { label: "Shopping", passed: shoppingCount >= 2, current: `${shoppingCount}`, required: "2+", icon: <ShoppingBag className="w-4 h-4" />, weight: 15 },
    ];
    const score = checks.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0);
    const passedCount = checks.filter(c => c.passed).length;
    const maxAmount = score >= 80 ? 50000 : score >= 60 ? 25000 : score >= 40 ? 10000 : 5000;
    setEligibility({ eligible: passedCount >= 4, score, checks, maxAmount });
    setEligibilityLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadAll = async () => {
      const [, appResult] = await Promise.all([
        checkEligibility(),
        supabase.from("loan_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      const data = appResult.data || [];
      setApplications(data);
      setLoading(false);
      if (data.some(a => ["disbursed", "approved"].includes(a.status))) {
        setActiveTab("active");
      }
    };
    loadAll();
  }, [user, checkEligibility]);

  const handleApply = () => {
    if (!user) { toast.error("Please sign in first"); return; }
    if (!eligibility?.eligible) { toast.error("You are not eligible yet"); return; }
    setTermsAccepted(false);
    setLoanPin("");
    setLoanPinError("");
    setTermsOpen(true);
  };

  const handleConfirmLoan = async () => {
    if (!termsAccepted) { toast.error("Please accept the terms"); return; }
    if (loanPin.length < 4) { setLoanPinError("Enter your 4-digit PIN"); return; }
    setSubmitting(true); setLoanPinError("");
    const pinValid = await verifyPin(loanPin);
    if (!pinValid) { setLoanPinError("Incorrect PIN. Please try again."); setLoanPin(""); setSubmitting(false); return; }
    setTermsOpen(false);
    const { error } = await supabase.rpc("apply_loan", {
      p_amount: amountNum,
      p_tenure_days: tenureNum,
      p_interest_rate: SERVICE_FEE_PERCENT,
      p_emi_amount: calc.monthlyPayment,
    });
    if (error) toast.error("Failed to submit application");
    else {
      haptics.success();
      toast.success("Qard Hasan application submitted!");
      const { data } = await supabase.from("loan_applications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      setApplications(data || []);
      setActiveTab("active");
    }
    setSubmitting(false);
    setLoanPin("");
  };

  const activeLoans = applications.filter(a => ["disbursed", "approved", "pending"].includes(a.status));
  const historyLoans = applications.filter(a => ["repaid", "rejected"].includes(a.status));
  const scoreColor = !eligibility ? "hsl(var(--primary))" : eligibility.score >= 80 ? "hsl(142, 71%, 45%)" : eligibility.score >= 60 ? "hsl(36, 95%, 55%)" : "hsl(0, 74%, 55%)";
  const scoreGrade = !eligibility ? "—" : eligibility.score >= 80 ? "Excellent" : eligibility.score >= 60 ? "Good" : eligibility.score >= 40 ? "Fair" : "Building";

  const getLoanProgress = (app: any) => {
    const startDate = new Date(app.applied_at || app.created_at);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = app.tenure_days || 90;
    const totalInstallments = Math.ceil(totalDays / 30);
    const fee = Number(app.amount) * ((app.interest_rate || SERVICE_FEE_PERCENT) / 100);
    const totalAmount = Number(app.amount) + fee;
    // Real repaid amount from DB takes precedence; falls back to time-based estimate.
    const dbRepaid = Number(app.repaid_amount ?? 0);
    const timeRepaid = Math.min(totalAmount, (totalAmount / totalInstallments) * Math.floor(elapsed / 30));
    const paidAmount = Math.max(dbRepaid, timeRepaid);
    const remaining = Math.max(0, totalAmount - paidAmount);
    const progress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
    const installmentsPaid = Math.min(totalInstallments, Math.floor((paidAmount / totalAmount) * totalInstallments));
    const nextDueDate = new Date(startDate);
    nextDueDate.setDate(nextDueDate.getDate() + (installmentsPaid + 1) * 30);
    const daysUntilDue = Math.max(0, Math.floor((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      progress, elapsed, totalDays, installmentsPaid, totalInstallments,
      totalAmount: Math.round(totalAmount), paidAmount: Math.round(paidAmount),
      remaining: Math.round(remaining), nextDueDate, daysUntilDue, fee: Math.round(fee),
      isOverdue: daysUntilDue <= 0 && installmentsPaid < totalInstallments,
    };
  };

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "apply", label: "Apply" },
    { key: "active", label: "Active", count: activeLoans.length },
    { key: "history", label: "History", count: historyLoans.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Qard Hasan Loan – Sharia-Compliant Micro Loans | EasyPay"
        description="Apply for interest-free Qard Hasan micro-loans through EasyPay. Transparent flat fee, instant disbursal to your wallet."
        path="/loan"
      />
      {/* Header */}
      <div className="sticky top-0 z-30 gradient-hero text-primary-foreground backdrop-blur-xl border-b border-primary/30 shadow-glow">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-primary-foreground">Qard Hasan</h1>
            <p className="text-[10px] text-muted-foreground">Interest-Free · Sharia Compliant</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10">
            <Heart className="w-3 h-3 text-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Halal</span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="px-4 pb-2 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? "text-primary-foreground"
                  : "text-muted-foreground bg-muted/30 hover:bg-muted/50"
              }`}
              style={activeTab === tab.key ? { background: "var(--gradient-primary)" } : undefined}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-white/20" : "bg-primary/10 text-primary"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto pb-8">
        <AnimatePresence mode="wait">

          {/* ═══════════ APPLY TAB ═══════════ */}
          {activeTab === "apply" && (
            <motion.div
              key="apply"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 pt-4"
            >
              {/* AI Rewards */}
              {aiLoanRewards.length > 0 && (
                <div className="mx-4">
                  <AiRewardBanner rewards={aiLoanRewards} onClaim={claimLoanReward} />
                </div>
              )}

              {/* ── Islamic Finance Banner ── */}
              <div className="mx-4">
                <div className="rounded-2xl bg-emerald-500/[0.06] ring-1 ring-emerald-500/15 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Scale className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">100% Interest-Free (Riba-Free)</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      Qard Hasan — a benevolent loan with only a one-time flat {SERVICE_FEE_PERCENT}% service fee. No compounding, no hidden charges, fully Sharia compliant.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Credit Score Hero ── */}
              <div className="mx-4">
                <div className="relative rounded-[20px] overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
                  <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/[0.03] -translate-y-1/2 translate-x-1/4" />
                  <div className="absolute bottom-0 left-8 w-20 h-20 rounded-full bg-white/[0.05] blur-2xl" />

                  <div className="relative p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/[0.18] flex items-center justify-center backdrop-blur-sm">
                            <Gauge className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-white/80 text-[10px] font-semibold tracking-widest uppercase">Trust Score</span>
                        </div>

                        {eligibilityLoading ? (
                          <div className="flex items-center gap-2 pt-2">
                            <Loader2 className="w-4 h-4 animate-spin text-white/70" />
                            <span className="text-white/70 text-xs">Analyzing...</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-[46px] font-black text-white leading-none tabular-nums">{eligibility?.score ?? 0}</span>
                              <div className="flex flex-col">
                                <span className="text-white/70 text-sm font-medium">/100</span>
                                <span className="text-[10px] font-semibold" style={{ color: scoreColor }}>{scoreGrade}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.15]">
                                <Target className="w-3 h-3 text-emerald-300" />
                                <span className="text-[10px] text-white/85 font-medium">
                                  Max: <span className="text-white font-bold">৳{(eligibility?.maxAmount ?? 0).toLocaleString()}</span>
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Radial Ring */}
                      {!eligibilityLoading && eligibility && (
                        <div className="relative w-[88px] h-[88px]">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                            <circle cx="44" cy="44" r="37" fill="none" stroke="white" strokeOpacity="0.15" strokeWidth="5.5" />
                            <circle cx="44" cy="44" r="37" fill="none"
                              stroke={scoreColor}
                              strokeWidth="5.5" strokeLinecap="round"
                              strokeDasharray={`${(eligibility.score / 100) * 232.5} 232.5`}
                              className="transition-all duration-1000 ease-out"
                              style={{ filter: `drop-shadow(0 0 6px ${scoreColor})` }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            {eligibility.eligible
                              ? <ShieldCheck className="w-6 h-6 text-emerald-300" />
                              : <AlertTriangle className="w-6 h-6 text-amber-300" />
                            }
                            <span className="text-[9px] text-white/80 font-semibold mt-0.5">
                              {eligibility.eligible ? "Eligible" : "Building"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Criteria */}
                    {!eligibilityLoading && eligibility && (
                      <div className="mt-4 grid grid-cols-5 gap-1.5">
                        {eligibility.checks.map((check, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-white/[0.14]">
                            <div className={check.passed ? "text-emerald-300" : "text-white/50"}>{check.icon}</div>
                            <span className="text-[8px] text-white/85 font-semibold text-center leading-tight">{check.label}</span>
                            {check.passed
                              ? <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                              : <XCircle className="w-3 h-3 text-white/40" />
                            }
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Loan Config Card ── */}
              <div className="mx-4">
                <div className="rounded-[20px] bg-card ring-1 ring-border/40 overflow-hidden">
                  <div className="p-5 space-y-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                        <HandCoins className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Configure Qard Hasan</p>
                        <p className="text-[10px] text-muted-foreground">Select amount & repayment period</p>
                      </div>
                    </div>

                    {/* Amount Dropdown */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Loan Amount</label>
                      <Select value={amount} onValueChange={setAmount}>
                        <SelectTrigger className="w-full h-14 rounded-2xl bg-muted/30 border-border/40 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                              <Banknote className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-left">
                              <p className="text-[9px] text-muted-foreground font-medium">Amount</p>
                              <SelectValue placeholder="Select amount" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {AMOUNTS.map(a => (
                            <SelectItem key={a} value={a.toString()} className="rounded-xl">
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-bold">৳{a.toLocaleString()}</span>
                                <span className="text-[9px] text-muted-foreground">
                                  Fee: ৳{Math.round(a * SERVICE_FEE_PERCENT / 100).toLocaleString()}
                                </span>
                                {eligibility && a > eligibility.maxAmount && (
                                  <span className="text-[9px] text-destructive font-medium">Over limit</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Duration Dropdown */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Repayment Period</label>
                      <Select value={tenure} onValueChange={setTenure}>
                        <SelectTrigger className="w-full h-14 rounded-2xl bg-muted/30 border-border/40 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                              <CalendarClock className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-left">
                              <p className="text-[9px] text-muted-foreground font-medium">Duration</p>
                              <SelectValue placeholder="Select duration" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {TENURES.map(t => (
                            <SelectItem key={t.days} value={t.days.toString()} className="rounded-xl">
                              <div className="flex items-center gap-3">
                                <span className="font-bold">{t.label}</span>
                                <span className="text-[10px] text-muted-foreground">({t.days} days)</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="mx-5 border-t border-border/30" />
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Monthly Installment</p>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-[34px] font-black text-foreground leading-none tabular-nums">৳{calc.monthlyPayment.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground font-medium">/mo</span>
                        </div>
                      </div>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                        <HandCoins className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Loan Amount", value: `৳${calc.loanAmount.toLocaleString()}`, icon: <DollarSign className="w-3 h-3" />, highlight: false },
                        { label: `Service Fee (${SERVICE_FEE_PERCENT}%)`, value: `৳${calc.serviceFee.toLocaleString()}`, icon: <Receipt className="w-3 h-3" />, highlight: false },
                        { label: "Total Payable", value: `৳${calc.totalPayable.toLocaleString()}`, icon: <Banknote className="w-3 h-3" />, highlight: true },
                        { label: "Installments", value: `${calc.installments} months`, icon: <Calendar className="w-3 h-3" />, highlight: false },
                      ].map((item, i) => (
                        <div key={i} className={`p-3 rounded-xl ${item.highlight ? "bg-primary/[0.06] ring-1 ring-primary/15" : "bg-muted/30"}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={item.highlight ? "text-primary" : "text-muted-foreground"}>{item.icon}</span>
                            <span className="text-[9px] text-muted-foreground font-medium">{item.label}</span>
                          </div>
                          <p className={`text-sm font-bold ${item.highlight ? "text-primary" : "text-foreground"}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* No-interest highlight */}
                    <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.04] ring-1 ring-emerald-500/10">
                      <Heart className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-[10px] text-muted-foreground">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">0% Interest</span> — Only a flat ৳{calc.serviceFee.toLocaleString()} service fee · Auto-debit from wallet
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Features ── */}
              <div className="mx-4 grid grid-cols-3 gap-2">
                {[
                  { icon: <Heart className="w-4 h-4" />, label: "Zero\nInterest", color: "text-emerald-500" },
                  { icon: <Shield className="w-4 h-4" />, label: "Sharia\nCompliant", color: "text-blue-500" },
                  { icon: <RefreshCw className="w-4 h-4" />, label: "Flexible\nRepayment", color: "text-amber-500" },
                ].map((f, i) => (
                  <div key={i} className="rounded-2xl bg-card ring-1 ring-border/40 p-3 flex flex-col items-center text-center gap-1.5">
                    <div className={`w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center ${f.color}`}>{f.icon}</div>
                    <span className="text-[10px] font-semibold text-foreground whitespace-pre-line leading-tight">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Apply Button */}
              <div className="mx-4">
                <Button
                  onClick={handleApply}
                  disabled={submitting || eligibilityLoading || !eligibility?.eligible || amountNum > (eligibility?.maxAmount ?? 0)}
                  className="w-full h-[54px] rounded-2xl font-bold text-sm shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-lg)] transition-all disabled:opacity-40 disabled:shadow-none"
                  style={eligibility?.eligible ? { background: "var(--gradient-primary)" } : undefined}
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : !eligibility?.eligible ? (
                    <><TrendingDown className="w-4 h-4 mr-2" />Improve Score to Apply</>
                  ) : amountNum > (eligibility?.maxAmount ?? 0) ? (
                    <><Ban className="w-4 h-4 mr-2" />Amount Exceeds Limit</>
                  ) : (
                    <><ArrowUpRight className="w-4 h-4 mr-1.5" />Apply for ৳{amountNum.toLocaleString()} Qard Hasan</>
                  )}
                </Button>
                <p className="text-center text-[9px] text-muted-foreground/60 mt-2">
                  No riba · One-time service fee only · Fully transparent
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══════════ ACTIVE TAB ═══════════ */}
          {activeTab === "active" && (
            <motion.div
              key="active"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 pt-4"
            >
              {activeLoans.length === 0 ? (
                <div className="mx-4 rounded-[20px] bg-card ring-1 ring-border/40 p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-muted/40">
                    <PiggyBank className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No Active Loans</p>
                  <p className="text-xs text-muted-foreground mt-1">Apply for Qard Hasan to see it here</p>
                  <Button onClick={() => setActiveTab("apply")} variant="outline" className="mt-4 rounded-xl text-xs">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />Apply Now
                  </Button>
                </div>
              ) : (
                activeLoans.map((app, i) => {
                  const sc = statusConfig[app.status] || statusConfig.pending;
                  const lp = getLoanProgress(app);
                  const isDisbursed = app.status === "disbursed";

                  return (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="mx-4"
                    >
                      <div className="rounded-[20px] bg-card ring-1 ring-border/40 overflow-hidden">
                        <div className="p-5 pb-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sc.bg}`}>
                                <span className={sc.color}>{sc.icon}</span>
                              </div>
                              <div>
                                <span className="text-lg font-black text-foreground tabular-nums">৳{Number(app.amount).toLocaleString()}</span>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(app.applied_at || app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${sc.bg} ${sc.color}`}>
                              {sc.icon}
                              <span className="text-[10px] font-bold">{sc.label}</span>
                            </div>
                          </div>

                          {isDisbursed && (
                            <div className="space-y-3">
                              {/* Progress */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] text-muted-foreground font-medium">Settlement Progress</span>
                                  <span className="text-[10px] font-bold text-primary">{lp.progress}%</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${lp.progress}%` }}
                                    transition={{ duration: 1.2, ease: "easeOut" }}
                                    className="h-full rounded-full"
                                    style={{ background: "var(--gradient-primary)" }}
                                  />
                                </div>
                              </div>

                              {/* Paid / Remaining */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-xl bg-emerald-500/[0.06] ring-1 ring-emerald-500/10">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Repaid</span>
                                  </div>
                                  <p className="text-sm font-bold text-foreground tabular-nums">
                                    <button onClick={() => setShowBalance(!showBalance)} className="inline-flex items-center gap-1">
                                      {showBalance ? `৳${lp.paidAmount.toLocaleString()}` : "৳•••••"}
                                      {showBalance ? <Eye className="w-3 h-3 text-muted-foreground" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                                    </button>
                                  </p>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-500/[0.06] ring-1 ring-amber-500/10">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <ArrowDownRight className="w-3 h-3 text-amber-500" />
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Remaining</span>
                                  </div>
                                  <p className="text-sm font-bold text-foreground tabular-nums">
                                    {showBalance ? `৳${lp.remaining.toLocaleString()}` : "৳•••••"}
                                  </p>
                                </div>
                              </div>

                              {/* Next Due & Installments */}
                              <div className="flex gap-2">
                                <div className={`flex-1 p-3 rounded-xl ring-1 ${lp.isOverdue ? "bg-destructive/[0.06] ring-destructive/15" : "bg-muted/30 ring-border/20"}`}>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[9px] text-muted-foreground font-medium">Next Due</span>
                                  </div>
                                  <p className={`text-xs font-bold ${lp.isOverdue ? "text-destructive" : "text-foreground"}`}>
                                    {lp.isOverdue ? "Overdue!" : `${lp.daysUntilDue} days`}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    {lp.nextDueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </p>
                                </div>
                                <div className="flex-1 p-3 rounded-xl bg-muted/30 ring-1 ring-border/20">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <BarChart3 className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[9px] text-muted-foreground font-medium">Installments</span>
                                  </div>
                                  <p className="text-xs font-bold text-foreground">{lp.installmentsPaid}/{lp.totalInstallments}</p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">completed</p>
                                </div>
                              </div>

                              {/* Settlement Info */}
                              <div className="p-3 rounded-xl bg-muted/20 ring-1 ring-border/20">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Timer className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-[10px] font-semibold text-foreground">Settlement Details</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="text-[9px] text-muted-foreground">Service Fee</p>
                                    <p className="text-[11px] font-bold text-foreground">৳{lp.fee.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-muted-foreground">Total Due</p>
                                    <p className="text-[11px] font-bold text-foreground">৳{lp.totalAmount.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-muted-foreground">Days Left</p>
                                    <p className="text-[11px] font-bold text-foreground">{Math.max(0, lp.totalDays - lp.elapsed)}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.04] ring-1 ring-emerald-500/10">
                                <Heart className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                <span className="text-[10px] text-muted-foreground">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">0% Interest</span> — Service fee ৳{lp.fee.toLocaleString()} already included
                                </span>
                              </div>

                              {/* Repay button */}
                              {lp.remaining > 0 && (
                                <button
                                  onClick={() => { setRepayLoan(app); setRepayAmount(String(lp.remaining)); setRepayPin(""); setRepayPinError(""); }}
                                  className="w-full h-11 rounded-xl text-primary-foreground font-bold text-[12px] flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform"
                                  style={{ background: "var(--gradient-primary)" }}
                                >
                                  <HandCoins className="w-4 h-4" />
                                  Repay Loan · ৳{lp.remaining.toLocaleString()} due
                                </button>
                              )}
                            </div>
                          )}

                          {app.status === "pending" && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/[0.05] ring-1 ring-amber-500/10">
                              <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 animate-pulse" />
                              <span className="text-[10px] text-muted-foreground">Under review. Usually takes 1-2 business days.</span>
                            </div>
                          )}

                          {app.status === "approved" && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.05] ring-1 ring-emerald-500/10">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-[10px] text-muted-foreground">Approved! Funds will be disbursed to your wallet shortly.</span>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-border/30 px-5 py-3 flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Heart className="w-3 h-3 text-emerald-500" />
                              0% Interest
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Timer className="w-3 h-3" />
                              {app.tenure_days}d
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            ৳{Number(app.emi_amount).toLocaleString()}/mo
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ═══════════ HISTORY TAB ═══════════ */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="space-y-3 pt-4 mx-4"
            >
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : historyLoans.length === 0 ? (
                <div className="rounded-[20px] bg-card ring-1 ring-border/40 p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-muted/40">
                    <FileText className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No History Yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Settled and rejected loans appear here</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <div className="rounded-2xl bg-card ring-1 ring-border/40 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <BadgeCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] text-muted-foreground font-medium">Total Settled</span>
                      </div>
                      <p className="text-lg font-black text-foreground tabular-nums">
                        ৳{historyLoans.filter(a => a.status === "repaid").reduce((s, a) => s + Number(a.amount), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-card ring-1 ring-border/40 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="text-[10px] text-muted-foreground font-medium">Completed</span>
                      </div>
                      <p className="text-lg font-black text-foreground tabular-nums">
                        {historyLoans.filter(a => a.status === "repaid").length} loans
                      </p>
                    </div>
                  </div>

                  {historyLoans.map((app, i) => {
                    const sc = statusConfig[app.status] || statusConfig.pending;
                    return (
                      <motion.div
                        key={app.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-[16px] bg-card ring-1 ring-border/40 p-4 hover:ring-border transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${sc.bg}`}>
                              <span className={sc.color}>{sc.icon}</span>
                            </div>
                            <div>
                              <span className="text-base font-black text-foreground tabular-nums">৳{Number(app.amount).toLocaleString()}</span>
                              <p className="text-[10px] text-muted-foreground">{app.tenure_days} days · 0% interest</p>
                            </div>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>
                            {sc.icon}
                            <span className="text-[10px] font-semibold">{sc.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(app.applied_at || app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Banknote className="w-3 h-3" />
                            ৳{Number(app.emi_amount).toLocaleString()}/mo
                          </div>
                        </div>
                        {app.notes && (
                          <p className="text-[10px] text-destructive mt-2 bg-destructive/5 rounded-lg px-2.5 py-1.5">{app.notes}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Terms Sheet ── */}
      <Sheet open={termsOpen} onOpenChange={setTermsOpen}>
        <SheetContent side="bottom" className="rounded-t-[24px] max-h-[85vh] p-0">
          <div className="px-5 pt-5 pb-3">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-foreground text-sm">
                <Scale className="w-4 h-4 text-primary" />
                Qard Hasan Terms & Conditions
              </SheetTitle>
            </SheetHeader>
          </div>

          <ScrollArea className="h-[45vh] px-5">
            <div className="space-y-4 pb-4">
              {[
                { title: "1. Sharia Compliance", text: "This is a Qard Hasan (benevolent loan) — completely interest-free (riba-free). The borrower repays only the principal amount plus a one-time flat service fee." },
                { title: "2. Service Fee", text: `A flat ${SERVICE_FEE_PERCENT}% one-time service fee of ৳${calc.serviceFee.toLocaleString()} is charged to cover administrative and operational costs. This fee does not compound or increase over time.` },
                { title: "3. Repayment", text: "Equal monthly installments auto-deducted from your wallet. Maintain sufficient balance. 3 consecutive misses may result in account restrictions." },
                { title: "4. No Penalty Interest", text: "Late payments do not accrue additional interest or riba. However, repeated defaults may affect your Trust Score and future eligibility." },
                { title: "5. Eligibility", text: "Approval depends on Trust Score, transaction history, and KYC verification. EasyPay reserves the right to decline applications." },
                { title: "6. Early Settlement", text: "Full early repayment is allowed at any time without penalty. Service fee remains unchanged regardless of early settlement." },
                { title: "7. Default & Recovery", text: "On default: account restrictions, deductions from incoming funds, and Trust Score reduction. No additional interest or charges are levied." },
                { title: "8. Data Privacy", text: "Transaction data is used solely for Trust Score calculation. No third-party sharing except as required by law." },
                { title: "9. Governing Principle", text: "This agreement follows Islamic finance principles (Qard Hasan). Governed by laws of the People's Republic of Bangladesh." },
              ].map((s, i) => (
                <div key={i}>
                  <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider mb-1">{s.title}</h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="px-5 pb-6 pt-3 border-t border-border/40 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} className="mt-0.5" />
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                I agree to the <span className="text-foreground font-semibold">Qard Hasan Terms</span>, including the {SERVICE_FEE_PERCENT}% service fee and repayment policies. I understand this loan is interest-free.
              </span>
            </label>

            {termsAccepted && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground text-center">Enter PIN to Confirm</p>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div key={i} animate={{ scale: loanPin.length > i ? 1.15 : 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={`w-4 h-4 rounded-full border-2 transition-colors ${loanPin.length > i ? "bg-primary border-transparent" : "border-muted-foreground/40 bg-transparent"}`}
                    />
                  ))}
                </div>
                {loanPinError && (
                  <p className="text-xs text-destructive flex items-center justify-center gap-1">
                    <AlertCircle size={12} /> {loanPinError}
                  </p>
                )}
                <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={loanPin}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > loanPin.length) haptics.light(); setLoanPin(v); setLoanPinError(""); }}
                  className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors"
                  placeholder="••••" />
              </div>
            )}

            <SlideToConfirm
              onConfirm={handleConfirmLoan}
              label={submitting ? "Applying…" : `Slide to Apply ৳${amountNum.toLocaleString()}`}
              disabled={!termsAccepted || loanPin.length < 4 || submitting}
              pinComplete={loanPin.length === 4 && termsAccepted}
              icon={Lock}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ═════════ REPAY LOAN SHEET ═════════ */}
      <Sheet open={!!repayLoan} onOpenChange={(o) => { if (!o) { setRepayLoan(null); setRepayAmount(""); setRepayPin(""); setRepayPinError(""); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <HandCoins className="w-5 h-5 text-primary" /> Repay Qard Hasan
            </SheetTitle>
          </SheetHeader>
          {repayLoan && (() => {
            const lp = getLoanProgress(repayLoan);
            const amt = parseFloat(repayAmount) || 0;
            const newOutstanding = Math.max(0, lp.remaining - amt);
            const isFull = amt >= lp.remaining && amt > 0;
            return (
              <div className="space-y-4 pb-4">
                <div className="rounded-2xl bg-muted/30 ring-1 ring-border/40 p-4 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Total Due</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">৳{lp.totalAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Repaid</p>
                    <p className="text-sm font-bold text-emerald-600 tabular-nums">৳{lp.paidAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Outstanding</p>
                    <p className="text-sm font-bold text-amber-600 tabular-nums">৳{lp.remaining.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Repay Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">৳</span>
                    <input
                      type="number" inputMode="decimal" min={1} max={lp.remaining}
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      className="w-full h-14 pl-10 pr-24 rounded-2xl bg-card border-2 border-border focus:border-primary text-xl font-bold tabular-nums focus:outline-none transition-colors"
                      placeholder="0"
                    />
                    <button
                      onClick={() => setRepayAmount(String(lp.remaining))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold"
                    >Pay All</button>
                  </div>
                  {amt > lp.remaining && (
                    <p className="text-[11px] text-destructive mt-1.5 flex items-center gap-1"><AlertCircle size={11} /> Exceeds outstanding</p>
                  )}
                </div>

                {amt > 0 && amt <= lp.remaining && (
                  <div className="rounded-2xl bg-primary/[0.06] ring-1 ring-primary/15 p-3 space-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Paying now</span><span className="font-bold text-foreground">৳{amt.toLocaleString()}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">After payment</span><span className={`font-bold ${isFull ? "text-emerald-600" : "text-foreground"}`}>{isFull ? "✓ Fully Settled" : `৳${newOutstanding.toLocaleString()} left`}</span></div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Confirm with PIN</label>
                  {repayPinError && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {repayPinError}</p>
                  )}
                  <input
                    type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
                    value={repayPin}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setRepayPin(v); setRepayPinError(""); }}
                    className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••"
                  />
                </div>

                <SlideToConfirm
                  onConfirm={handleRepayLoan}
                  label={repayProcessing ? "Processing…" : `Slide to Repay ৳${amt.toLocaleString()}`}
                  disabled={repayProcessing || amt <= 0 || amt > lp.remaining || repayPin.length < 4}
                  pinComplete={repayPin.length === 4 && amt > 0 && amt <= lp.remaining}
                  icon={Lock}
                />
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default LoanPage;
