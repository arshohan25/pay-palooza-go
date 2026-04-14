import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Landmark, TrendingUp,
  Calendar, Banknote, Sparkles, ChevronRight, ShieldCheck, AlertTriangle,
  TrendingDown, CreditCard, ShoppingBag, Wallet, FileText, ChevronDown,
  Percent, ArrowUpRight, Info, PiggyBank, BarChart3, RefreshCw, Target,
  CircleDollarSign, BadgeCheck, Timer, ArrowDownRight, Receipt, Star,
  Gauge, Shield, Eye, EyeOff, DollarSign, CalendarClock, Ban
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useAiRewards } from "@/hooks/use-ai-rewards";
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
const INTEREST_RATE = 5;

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

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bg: string; glow: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-500", label: "Under Review", bg: "bg-amber-500/10", glow: "shadow-amber-500/20" },
  approved: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-500", label: "Approved", bg: "bg-emerald-500/10", glow: "shadow-emerald-500/20" },
  rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-destructive", label: "Rejected", bg: "bg-destructive/10", glow: "shadow-destructive/20" },
  disbursed: { icon: <Banknote className="w-3.5 h-3.5" />, color: "text-blue-500", label: "Active Loan", bg: "bg-blue-500/10", glow: "shadow-blue-500/20" },
  repaid: { icon: <BadgeCheck className="w-3.5 h-3.5" />, color: "text-muted-foreground", label: "Fully Repaid", bg: "bg-muted", glow: "" },
};

type TabType = "apply" | "active" | "history";

const LoanPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [detailApp, setDetailApp] = useState<any | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const { rewards: aiLoanRewards, claimReward: claimLoanReward } = useAiRewards("loan");

  useEffect(() => {
    if (!kycLoading && kycStatus !== "verified") {
      toast.error("Please complete KYC verification to use this feature.");
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate]);

  const amountNum = parseInt(amount) || 5000;
  const tenureNum = parseInt(tenure) || 90;

  const emi = useMemo(() => {
    const interest = (amountNum * INTEREST_RATE * (tenureNum / 365)) / 100;
    const total = amountNum + interest;
    const installments = Math.ceil(tenureNum / 30);
    const processingFee = Math.round(amountNum * 0.01);
    return {
      total: Math.round(total),
      interest: Math.round(interest),
      monthly: Math.round(total / installments),
      installments,
      processingFee,
      dailyRate: parseFloat((INTEREST_RATE / 365).toFixed(4)),
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
      { label: "Transaction Volume", passed: totalTxns >= MIN_TOTAL_TXNS, current: `${totalTxns}`, required: `${MIN_TOTAL_TXNS}+`, icon: <TrendingUp className="w-4 h-4" />, weight: 25 },
      { label: "Total Add Money", passed: addMoneyTotal >= MIN_ADD_MONEY_AMOUNT, current: `৳${addMoneyTotal.toLocaleString()}`, required: `৳${MIN_ADD_MONEY_AMOUNT.toLocaleString()}+`, icon: <Wallet className="w-4 h-4" />, weight: 20 },
      { label: "Payment Activity", passed: paymentCount >= MIN_PAYMENT_COUNT, current: `${paymentCount}`, required: `${MIN_PAYMENT_COUNT}+`, icon: <CreditCard className="w-4 h-4" />, weight: 15 },
      { label: "Shopping History", passed: shoppingCount >= 2, current: `${shoppingCount}`, required: "2+", icon: <ShoppingBag className="w-4 h-4" />, weight: 15 },
    ];
    const passedCount = checks.filter(c => c.passed).length;
    const score = checks.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0);
    const maxAmount = score >= 80 ? 50000 : score >= 60 ? 25000 : score >= 40 ? 10000 : 5000;
    setEligibility({ eligible: passedCount >= 4, score, checks, maxAmount });
    setEligibilityLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    checkEligibility();
    supabase.from("loan_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setApplications(data || []);
        setLoading(false);
        // Auto-switch to active tab if there are active loans
        if (data && data.some(a => ["disbursed", "approved"].includes(a.status))) {
          setActiveTab("active");
        }
      });
  }, [user, checkEligibility]);

  if (kycLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const handleApply = () => {
    if (!user) { toast.error("Please sign in first"); return; }
    if (!eligibility?.eligible) { toast.error("You are not eligible for a loan yet"); return; }
    setTermsAccepted(false);
    setTermsOpen(true);
  };

  const handleConfirmLoan = async () => {
    if (!termsAccepted) { toast.error("Please accept the terms & conditions"); return; }
    setTermsOpen(false);
    setSubmitting(true);
    const { error } = await supabase.from("loan_applications").insert({
      user_id: user!.id, amount: amountNum, tenure_days: tenureNum, interest_rate: INTEREST_RATE, emi_amount: emi.monthly,
    } as any);
    if (error) toast.error("Failed to submit application");
    else {
      toast.success("Loan application submitted!");
      const { data } = await supabase.from("loan_applications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      setApplications(data || []);
      setActiveTab("active");
    }
    setSubmitting(false);
  };

  const activeLoans = applications.filter(a => ["disbursed", "approved", "pending"].includes(a.status));
  const historyLoans = applications.filter(a => ["repaid", "rejected"].includes(a.status));
  const scoreColor = !eligibility ? "hsl(var(--primary))" : eligibility.score >= 80 ? "hsl(142, 71%, 45%)" : eligibility.score >= 60 ? "hsl(36, 95%, 55%)" : "hsl(0, 74%, 55%)";
  const scoreGrade = !eligibility ? "—" : eligibility.score >= 80 ? "Excellent" : eligibility.score >= 60 ? "Good" : eligibility.score >= 40 ? "Fair" : "Building";

  // Simulated repayment data for active loans
  const getLoanProgress = (app: any) => {
    const startDate = new Date(app.applied_at || app.created_at);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = app.tenure_days || 90;
    const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));
    const installmentsPaid = Math.floor(elapsed / 30);
    const totalInstallments = Math.ceil(totalDays / 30);
    const totalAmount = Number(app.amount) + (Number(app.amount) * (app.interest_rate || INTEREST_RATE) * (totalDays / 365)) / 100;
    const paidAmount = Math.min(totalAmount, (totalAmount / totalInstallments) * installmentsPaid);
    const remaining = Math.max(0, totalAmount - paidAmount);
    const nextDueDate = new Date(startDate);
    nextDueDate.setDate(nextDueDate.getDate() + (installmentsPaid + 1) * 30);
    const daysUntilDue = Math.max(0, Math.floor((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      progress,
      elapsed,
      totalDays,
      installmentsPaid,
      totalInstallments,
      totalAmount: Math.round(totalAmount),
      paidAmount: Math.round(paidAmount),
      remaining: Math.round(remaining),
      nextDueDate,
      daysUntilDue,
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
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">Instant Loan</h1>
            <p className="text-[10px] text-muted-foreground">Powered by EasyPay Credit</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10">
            <Gauge className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-semibold text-primary">{eligibility?.score ?? 0}%</span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="px-4 pb-2 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all relative ${
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

              {/* ── Credit Score Hero ── */}
              <div className="mx-4">
                <div className="relative rounded-[20px] overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
                  <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/[0.03] -translate-y-1/2 translate-x-1/4" />
                  <div className="absolute bottom-0 left-8 w-20 h-20 rounded-full bg-white/[0.05] blur-2xl" />

                  <div className="relative p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/[0.12] flex items-center justify-center backdrop-blur-sm">
                            <Landmark className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-white/50 text-[10px] font-semibold tracking-widest uppercase">Credit Score</span>
                        </div>

                        {eligibilityLoading ? (
                          <div className="flex items-center gap-2 pt-2">
                            <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                            <span className="text-white/40 text-xs">Analyzing profile...</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-[46px] font-black text-white leading-none tabular-nums">{eligibility?.score ?? 0}</span>
                              <div className="flex flex-col">
                                <span className="text-white/40 text-sm font-medium">/100</span>
                                <span className="text-[10px] font-semibold" style={{ color: scoreColor }}>{scoreGrade}</span>
                              </div>
                            </div>

                            {/* Max eligible amount */}
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.08]">
                                <Target className="w-3 h-3 text-emerald-400" />
                                <span className="text-[10px] text-white/60 font-medium">
                                  Max Eligible: <span className="text-white font-bold">৳{(eligibility?.maxAmount ?? 0).toLocaleString()}</span>
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Radial Score Ring */}
                      {!eligibilityLoading && eligibility && (
                        <div className="relative w-[88px] h-[88px]">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                            <circle cx="44" cy="44" r="37" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="5.5" />
                            <circle cx="44" cy="44" r="37" fill="none"
                              stroke={scoreColor}
                              strokeWidth="5.5" strokeLinecap="round"
                              strokeDasharray={`${(eligibility.score / 100) * 232.5} 232.5`}
                              className="transition-all duration-1000 ease-out"
                              style={{ filter: `drop-shadow(0 0 6px ${scoreColor})` }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            {eligibility.eligible ? (
                              <ShieldCheck className="w-6 h-6 text-emerald-400" />
                            ) : (
                              <AlertTriangle className="w-6 h-6 text-amber-400" />
                            )}
                            <span className="text-[9px] text-white/50 font-semibold mt-0.5">
                              {eligibility.eligible ? "Eligible" : "Building"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Criteria Grid */}
                    {!eligibilityLoading && eligibility && (
                      <div className="mt-4 grid grid-cols-5 gap-1.5">
                        {eligibility.checks.map((check, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-white/[0.06]">
                            <div className={check.passed ? "text-emerald-400" : "text-white/20"}>
                              {check.icon}
                            </div>
                            <span className="text-[8px] text-white/40 font-medium text-center leading-tight">{check.label}</span>
                            {check.passed
                              ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              : <XCircle className="w-3 h-3 text-white/15" />
                            }
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Loan Configuration Card ── */}
              <div className="mx-4">
                <div className="rounded-[20px] bg-card ring-1 ring-border/40 overflow-hidden">
                  <div className="p-5 space-y-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                        <CircleDollarSign className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Configure Your Loan</p>
                        <p className="text-[10px] text-muted-foreground">Select amount and repayment duration</p>
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
                              <div className="flex items-center justify-between gap-6">
                                <span className="font-bold">৳{a.toLocaleString()}</span>
                                {eligibility && a > eligibility.maxAmount && (
                                  <span className="text-[9px] text-destructive font-medium">Over limit</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tenure Dropdown */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Repayment Duration</label>
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

                  {/* EMI Summary */}
                  <div className="mx-5 border-t border-border/30" />
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Monthly EMI</p>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-[34px] font-black text-foreground leading-none tabular-nums">৳{emi.monthly.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground font-medium">/mo</span>
                        </div>
                      </div>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                        <Percent className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Principal", value: `৳${amountNum.toLocaleString()}`, icon: <DollarSign className="w-3 h-3" /> },
                        { label: `Interest (${INTEREST_RATE}%)`, value: `৳${emi.interest.toLocaleString()}`, icon: <Percent className="w-3 h-3" /> },
                        { label: "Processing Fee", value: `৳${emi.processingFee.toLocaleString()}`, icon: <Receipt className="w-3 h-3" /> },
                        { label: "Total Payable", value: `৳${emi.total.toLocaleString()}`, icon: <Banknote className="w-3 h-3" />, highlight: true },
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

                    {/* Schedule Preview */}
                    <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/20 ring-1 ring-border/20">
                      <Timer className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-[10px] text-muted-foreground">
                        {emi.installments} installments · {emi.dailyRate}% daily · Auto-debit from wallet
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Key Features ── */}
              <div className="mx-4 grid grid-cols-3 gap-2">
                {[
                  { icon: <Sparkles className="w-4 h-4" />, label: "Instant\nApproval", color: "text-amber-500" },
                  { icon: <Shield className="w-4 h-4" />, label: "No Hidden\nCharges", color: "text-emerald-500" },
                  { icon: <RefreshCw className="w-4 h-4" />, label: "Flexible\nRepayment", color: "text-blue-500" },
                ].map((f, i) => (
                  <div key={i} className="rounded-2xl bg-card ring-1 ring-border/40 p-3 flex flex-col items-center text-center gap-1.5">
                    <div className={`w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center ${f.color}`}>{f.icon}</div>
                    <span className="text-[10px] font-semibold text-foreground whitespace-pre-line leading-tight">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* ── Apply Button ── */}
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
                    <>
                      <TrendingDown className="w-4 h-4 mr-2" />
                      Improve Score to Apply
                    </>
                  ) : amountNum > (eligibility?.maxAmount ?? 0) ? (
                    <>
                      <Ban className="w-4 h-4 mr-2" />
                      Amount Exceeds Limit
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4 mr-1.5" />
                      Apply for ৳{amountNum.toLocaleString()} Loan
                    </>
                  )}
                </Button>
                <p className="text-center text-[9px] text-muted-foreground/60 mt-2">
                  By applying you agree to credit assessment and auto-debit policies
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
                  <p className="text-xs text-muted-foreground mt-1">Apply for a loan to see it here</p>
                  <Button onClick={() => setActiveTab("apply")} variant="outline" className="mt-4 rounded-xl text-xs">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
                    Apply Now
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
                        {/* Header */}
                        <div className="p-5 pb-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${sc.bg}`}>
                                <span className={sc.color}>{sc.icon}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-black text-foreground tabular-nums">
                                    ৳{Number(app.amount).toLocaleString()}
                                  </span>
                                </div>
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

                          {/* Progress for disbursed */}
                          {isDisbursed && (
                            <div className="space-y-3">
                              {/* Progress bar */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] text-muted-foreground font-medium">Repayment Progress</span>
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

                              {/* Key metrics */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-xl bg-emerald-500/[0.06] ring-1 ring-emerald-500/10">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Paid</span>
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

                              {/* Next Due / Schedule */}
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
                                  <p className="text-xs font-bold text-foreground">
                                    {lp.installmentsPaid}/{lp.totalInstallments}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">completed</p>
                                </div>
                              </div>

                              {/* Settlement info */}
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/[0.04] ring-1 ring-primary/10">
                                <Info className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                <span className="text-[10px] text-muted-foreground">
                                  Settlement: {lp.totalDays - lp.elapsed} days remaining · EMI ৳{Number(app.emi_amount).toLocaleString()}/mo
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Pending/Approved status info */}
                          {app.status === "pending" && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/[0.05] ring-1 ring-amber-500/10">
                              <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 animate-pulse" />
                              <span className="text-[10px] text-muted-foreground">Your application is under review. Usually takes 1-2 business days.</span>
                            </div>
                          )}

                          {app.status === "approved" && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.05] ring-1 ring-emerald-500/10">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-[10px] text-muted-foreground">Approved! Funds will be disbursed to your wallet shortly.</span>
                            </div>
                          )}
                        </div>

                        {/* Quick Stats Footer */}
                        <div className="border-t border-border/30 px-5 py-3 flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Percent className="w-3 h-3" />
                              {app.interest_rate || INTEREST_RATE}% p.a.
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Timer className="w-3 h-3" />
                              {app.tenure_days}d tenure
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Banknote className="w-3 h-3" />
                            ৳{Number(app.emi_amount).toLocaleString()}/mo
                          </div>
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
                  <p className="text-xs text-muted-foreground mt-1">Completed and rejected loans appear here</p>
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <div className="rounded-2xl bg-card ring-1 ring-border/40 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <BadgeCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] text-muted-foreground font-medium">Total Repaid</span>
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
                              <p className="text-[10px] text-muted-foreground">{app.tenure_days} days tenure</p>
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
                <FileText className="w-4 h-4 text-primary" />
                Loan Terms & Conditions
              </SheetTitle>
            </SheetHeader>
          </div>

          <ScrollArea className="h-[45vh] px-5">
            <div className="space-y-4 pb-4">
              {[
                { title: "1. Loan Agreement", text: "By applying, you enter a binding agreement with EasyPay. Loan amount, tenure, and rate are final after submission." },
                { title: "2. Interest & Fees", text: `Flat interest rate of ${INTEREST_RATE}% p.a. Processing fee: 1% of principal. No hidden charges. Late payment penalty: 2% per month on outstanding.` },
                { title: "3. Repayment", text: "EMI auto-deducted from wallet monthly. Maintain sufficient balance. 3 consecutive misses may trigger default." },
                { title: "4. Eligibility", text: "Approval depends on transaction history, account standing, and KYC. EasyPay may reject without specific reasons." },
                { title: "5. Prepayment", text: "Full prepayment allowed without penalty. Partial prepayments are not permitted." },
                { title: "6. Default & Recovery", text: "On default: account restrictions, deductions from incoming funds, credit bureau reporting, and legal proceedings may follow." },
                { title: "7. Data Usage", text: "Transaction data used solely for creditworthiness. No third-party sharing except as required by law." },
                { title: "8. Governing Law", text: "Governed by laws of the People's Republic of Bangladesh. Disputes resolved through appropriate judicial authorities." },
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
                I agree to the <span className="text-foreground font-semibold">Terms & Conditions</span>, including interest, repayment, and default policies.
              </span>
            </label>
            <Button
              onClick={handleConfirmLoan}
              disabled={!termsAccepted || submitting}
              className="w-full h-12 rounded-2xl font-bold text-sm shadow-[var(--shadow-glow)] transition-all disabled:opacity-40 disabled:shadow-none"
              style={termsAccepted ? { background: "var(--gradient-primary)" } : undefined}
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Confirm ৳{amountNum.toLocaleString()} Loan
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default LoanPage;
