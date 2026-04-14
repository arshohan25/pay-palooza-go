import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Landmark, TrendingUp,
  Calendar, Banknote, Sparkles, ChevronRight, ShieldCheck, AlertTriangle,
  TrendingDown, CreditCard, ShoppingBag, Wallet, FileText, ChevronDown,
  Percent, ArrowUpRight, Info
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const AMOUNTS = [1000, 3000, 5000, 10000, 25000, 50000];
const TENURES = [30, 60, 90, 180, 365];
const INTEREST_RATE = 5;

const MIN_TOTAL_TXNS = 15;
const MIN_ADD_MONEY_AMOUNT = 5000;
const MIN_PAYMENT_COUNT = 5;
const MIN_ACCOUNT_AGE_DAYS = 30;

interface EligibilityResult {
  eligible: boolean;
  score: number;
  checks: {
    label: string;
    passed: boolean;
    current: string;
    required: string;
    icon: React.ReactNode;
  }[];
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bg: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-500", label: "Under Review", bg: "bg-amber-500/10" },
  approved: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-500", label: "Approved", bg: "bg-emerald-500/10" },
  rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-destructive", label: "Rejected", bg: "bg-destructive/10" },
  disbursed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-blue-500", label: "Disbursed", bg: "bg-blue-500/10" },
  repaid: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-muted-foreground", label: "Repaid", bg: "bg-muted" },
};

const LoanPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const [amount, setAmount] = useState(5000);
  const [tenure, setTenure] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showEligibilityDetails, setShowEligibilityDetails] = useState(false);

  useEffect(() => {
    if (!kycLoading && kycStatus !== "verified") {
      toast.error("Please complete KYC verification to use this feature.");
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate]);

  const emi = useMemo(() => {
    const interest = (amount * INTEREST_RATE * (tenure / 365)) / 100;
    const total = amount + interest;
    const installments = Math.ceil(tenure / 30);
    return { total: Math.round(total), interest: Math.round(interest), monthly: Math.round(total / installments), installments };
  }, [amount, tenure]);

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
      { label: "Account Age", passed: accountAgeDays >= MIN_ACCOUNT_AGE_DAYS, current: `${accountAgeDays} days`, required: `${MIN_ACCOUNT_AGE_DAYS}+ days`, icon: <Calendar className="w-4 h-4" /> },
      { label: "Transactions", passed: totalTxns >= MIN_TOTAL_TXNS, current: `${totalTxns}`, required: `${MIN_TOTAL_TXNS}+`, icon: <TrendingUp className="w-4 h-4" /> },
      { label: "Add Money", passed: addMoneyTotal >= MIN_ADD_MONEY_AMOUNT, current: `৳${addMoneyTotal.toLocaleString()}`, required: `৳${MIN_ADD_MONEY_AMOUNT.toLocaleString()}+`, icon: <Wallet className="w-4 h-4" /> },
      { label: "Payments", passed: paymentCount >= MIN_PAYMENT_COUNT, current: `${paymentCount}`, required: `${MIN_PAYMENT_COUNT}+`, icon: <CreditCard className="w-4 h-4" /> },
      { label: "Shopping", passed: shoppingCount >= 2, current: `${shoppingCount}`, required: "2+", icon: <ShoppingBag className="w-4 h-4" /> },
    ];
    const passedCount = checks.filter(c => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);
    setEligibility({ eligible: passedCount >= 4, score, checks });
    setEligibilityLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    checkEligibility();
    supabase.from("loan_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setApplications(data || []); setLoading(false); });
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
      user_id: user!.id, amount, tenure_days: tenure, interest_rate: INTEREST_RATE, emi_amount: emi.monthly,
    } as any);
    if (error) toast.error("Failed to submit application");
    else {
      toast.success("Loan application submitted!");
      const { data } = await supabase.from("loan_applications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      setApplications(data || []);
    }
    setSubmitting(false);
  };

  const activeApps = applications.filter(a => ["pending", "approved", "disbursed"].includes(a.status));
  const scoreColor = !eligibility ? "hsl(var(--primary))" : eligibility.score >= 80 ? "hsl(142, 71%, 45%)" : eligibility.score >= 60 ? "hsl(36, 95%, 55%)" : "hsl(0, 74%, 55%)";

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
          </div>
          {activeApps.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-semibold text-primary">{activeApps.length} Active</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto pb-8 space-y-4 pt-4">

        {/* ── Credit Score Hero ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="mx-4"
        >
          <div className="relative rounded-[20px] overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
            {/* Decorative */}
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/[0.03] -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/[0.04] translate-y-1/3 -translate-x-1/4 blur-xl" />

            <div className="relative p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.12] flex items-center justify-center">
                      <Landmark className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-white/50 text-[10px] font-semibold tracking-widest uppercase">Credit Score</span>
                  </div>
                  {eligibilityLoading ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                      <span className="text-white/40 text-xs">Analyzing...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[42px] font-black text-white leading-none tabular-nums">{eligibility?.score ?? 0}</span>
                        <span className="text-white/40 text-sm font-medium">/100</span>
                      </div>
                      <p className="text-white/50 text-[11px] font-medium">
                        {eligibility?.eligible ? "You qualify for instant loans" : "Keep transacting to unlock"}
                      </p>
                    </>
                  )}
                </div>

                {/* Radial Score Ring */}
                {!eligibilityLoading && eligibility && (
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="5" />
                      <circle cx="40" cy="40" r="34" fill="none"
                        stroke={scoreColor}
                        strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={`${(eligibility.score / 100) * 213.6} 213.6`}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {eligibility.eligible ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      )}
                      <span className="text-[9px] text-white/40 font-medium mt-0.5">
                        {eligibility.eligible ? "Eligible" : "Building"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Expandable Criteria */}
              {!eligibilityLoading && eligibility && (
                <button
                  onClick={() => setShowEligibilityDetails(v => !v)}
                  className="mt-3 flex items-center gap-1.5 text-white/40 text-[10px] font-medium hover:text-white/60 transition-colors"
                >
                  <Info className="w-3 h-3" />
                  {showEligibilityDetails ? "Hide" : "View"} eligibility criteria
                  <ChevronDown className={`w-3 h-3 transition-transform ${showEligibilityDetails ? "rotate-180" : ""}`} />
                </button>
              )}

              <AnimatePresence>
                {showEligibilityDetails && eligibility && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-1.5">
                      {eligibility.checks.map((check, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.06]">
                          <div className={check.passed ? "text-emerald-400" : "text-white/25"}>
                            {check.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-medium text-white/70">{check.label}</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/40">{check.current}</span>
                          {check.passed
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                          }
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Amount Selector ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mx-4"
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">Select Amount</p>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNTS.map(a => {
              const selected = amount === a;
              return (
                <motion.button
                  key={a}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setAmount(a)}
                  className={`relative py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                    selected
                      ? "text-primary-foreground ring-0"
                      : "bg-card text-foreground ring-1 ring-border/60 hover:ring-primary/30"
                  }`}
                  style={selected ? { background: "var(--gradient-primary)" } : undefined}
                >
                  <span className="relative z-10">৳{a >= 1000 ? `${a / 1000}K` : a}</span>
                  {selected && (
                    <motion.div
                      layoutId="amount-glow"
                      className="absolute inset-0 rounded-2xl shadow-[var(--shadow-glow)]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Tenure Pills ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mx-4"
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">Tenure</p>
          <div className="flex gap-2">
            {TENURES.map(t => {
              const selected = tenure === t;
              const label = t >= 365 ? `${Math.round(t / 365)} Year` : `${t} Days`;
              return (
                <motion.button
                  key={t}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTenure(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    selected
                      ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "bg-card text-foreground ring-1 ring-border/60 hover:ring-primary/30"
                  }`}
                  style={selected ? { background: "var(--gradient-primary)" } : undefined}
                >
                  {label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── EMI Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mx-4"
        >
          <div className="rounded-[20px] bg-card ring-1 ring-border/40 overflow-hidden">
            {/* EMI highlight */}
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Monthly EMI</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-[32px] font-black text-foreground leading-none tabular-nums">৳{emi.monthly.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground font-medium">/mo</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                <Percent className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>

            {/* Breakdown */}
            <div className="mx-5 border-t border-border/40" />
            <div className="p-5 pt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Principal", value: `৳${amount.toLocaleString()}` },
                { label: `Interest (${INTEREST_RATE}%)`, value: `৳${emi.interest.toLocaleString()}` },
                { label: "Total", value: `৳${emi.total.toLocaleString()}` },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${i === 2 ? "text-primary" : "text-foreground"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Info strip */}
            <div className="mx-5 mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/[0.04] ring-1 ring-primary/10">
              <Info className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">{emi.installments} installments · No hidden fees · Auto-debit from wallet</span>
            </div>
          </div>
        </motion.div>

        {/* ── Apply Button ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4"
        >
          <Button
            onClick={handleApply}
            disabled={submitting || eligibilityLoading || !eligibility?.eligible}
            className="w-full h-[52px] rounded-2xl font-bold text-sm shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-lg)] transition-all disabled:opacity-40 disabled:shadow-none"
            style={eligibility?.eligible ? { background: "var(--gradient-primary)" } : undefined}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : !eligibility?.eligible ? (
              <>
                <TrendingDown className="w-4 h-4 mr-2" />
                Improve Profile to Apply
              </>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4 mr-1.5" />
                Apply for ৳{amount.toLocaleString()}
              </>
            )}
          </Button>
        </motion.div>

        {/* ── Applications History ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mx-4 mt-4"
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">
            Application History
            {applications.length > 0 && <span className="text-primary ml-1.5">({applications.length})</span>}
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : applications.length === 0 ? (
            <div className="rounded-[20px] bg-card ring-1 ring-border/40 p-8 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-muted/60">
                <Landmark className="w-5 h-5 text-muted-foreground/60" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">No applications yet</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Your loan history will appear here</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {applications.map((app, i) => {
                const sc = statusConfig[app.status] || statusConfig.pending;
                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-[16px] bg-card ring-1 ring-border/40 p-4 hover:ring-border transition-all"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-black text-foreground tabular-nums">৳{Number(app.amount).toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground">for {app.tenure_days}d</span>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>
                        {sc.icon}
                        <span className="text-[10px] font-semibold">{sc.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(app.applied_at || app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Banknote className="w-3 h-3" />
                        ৳{Number(app.emi_amount).toLocaleString()}/mo
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground/30" />
                    </div>
                    {app.notes && (
                      <p className="text-[10px] text-destructive mt-2 bg-destructive/5 rounded-lg px-2.5 py-1.5">{app.notes}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
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
                { title: "2. Interest & Fees", text: `Flat interest rate of ${INTEREST_RATE}% p.a. No hidden charges. Late payment penalty: 2% per month on outstanding.` },
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
                  Confirm Application
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
