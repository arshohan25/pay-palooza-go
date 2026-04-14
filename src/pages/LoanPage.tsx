import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Landmark, TrendingUp,
  Calendar, Banknote, Sparkles, ChevronRight, ShieldCheck, AlertTriangle,
  TrendingDown, CreditCard, ShoppingBag, Wallet, FileText, ChevronDown
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

// Eligibility thresholds
const MIN_TOTAL_TXNS = 15;
const MIN_ADD_MONEY_AMOUNT = 5000;
const MIN_PAYMENT_COUNT = 5;
const MIN_ACCOUNT_AGE_DAYS = 30;

interface EligibilityResult {
  eligible: boolean;
  score: number; // 0-100
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

  // Check eligibility based on transaction profile
  const checkEligibility = useCallback(async () => {
    if (!user) return;
    setEligibilityLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 3, 1); // Last 3 months

    const [txnResult, profileResult] = await Promise.all([
      supabase
        .from("transactions")
        .select("type, amount, created_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("profiles")
        .select("created_at")
        .eq("user_id", user.id)
        .single(),
    ]);

    const txns = txnResult.data || [];
    const profileCreated = profileResult.data?.created_at ? new Date(profileResult.data.created_at) : now;
    const accountAgeDays = Math.floor((now.getTime() - profileCreated.getTime()) / (1000 * 60 * 60 * 24));

    const totalTxns = txns.length;
    const addMoneyTotal = txns.filter(t => t.type === "addmoney").reduce((s, t) => s + Number(t.amount), 0);
    const paymentCount = txns.filter(t => ["payment", "recharge", "paybill"].includes(t.type)).length;
    const shoppingCount = txns.filter(t => t.type === "payment").length;

    const checks = [
      {
        label: "Account Age",
        passed: accountAgeDays >= MIN_ACCOUNT_AGE_DAYS,
        current: `${accountAgeDays} days`,
        required: `${MIN_ACCOUNT_AGE_DAYS}+ days`,
        icon: <Calendar className="w-4 h-4" />,
      },
      {
        label: "Total Transactions",
        passed: totalTxns >= MIN_TOTAL_TXNS,
        current: `${totalTxns}`,
        required: `${MIN_TOTAL_TXNS}+`,
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        label: "Add Money Volume",
        passed: addMoneyTotal >= MIN_ADD_MONEY_AMOUNT,
        current: `৳${addMoneyTotal.toLocaleString()}`,
        required: `৳${MIN_ADD_MONEY_AMOUNT.toLocaleString()}+`,
        icon: <Wallet className="w-4 h-4" />,
      },
      {
        label: "Payment & Bills",
        passed: paymentCount >= MIN_PAYMENT_COUNT,
        current: `${paymentCount}`,
        required: `${MIN_PAYMENT_COUNT}+`,
        icon: <CreditCard className="w-4 h-4" />,
      },
      {
        label: "Shopping Activity",
        passed: shoppingCount >= 2,
        current: `${shoppingCount}`,
        required: "2+",
        icon: <ShoppingBag className="w-4 h-4" />,
      },
    ];

    const passedCount = checks.filter(c => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);
    // Need at least 4 out of 5 checks to be eligible
    const eligible = passedCount >= 4;

    setEligibility({ eligible, score, checks });
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
      user_id: user!.id,
      amount,
      tenure_days: tenure,
      interest_rate: INTEREST_RATE,
      emi_amount: emi.monthly,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted/60 backdrop-blur flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Loan</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto pb-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 rounded-[19px] overflow-hidden relative"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/[0.06] blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/[0.04] blur-xl" />
          <div className="relative p-5 pb-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-white/[0.12] backdrop-blur-sm flex items-center justify-center">
                <Landmark className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/70 text-xs font-medium tracking-wide uppercase">Quick Loan</span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-2">Get funds instantly</h2>
            <p className="text-white/60 text-sm mt-1">Low interest · Flexible tenure · No hidden fees</p>
            {activeApps.length > 0 && (
              <div className="mt-4 flex items-center gap-2 bg-white/[0.08] backdrop-blur-sm rounded-xl px-3 py-2">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="text-white/80 text-xs">{activeApps.length} active application{activeApps.length > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Eligibility Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mx-4 mt-4"
        >
          <div className="rounded-[19px] bg-card shadow-[var(--shadow-elevated)] overflow-hidden">
            {eligibilityLoading ? (
              <div className="p-6 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analyzing your profile...</span>
              </div>
            ) : eligibility ? (
              <>
                <button
                  onClick={() => setShowEligibilityDetails(v => !v)}
                  className="w-full p-4 pb-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      eligibility.eligible
                        ? "bg-emerald-500/10"
                        : "bg-amber-500/10"
                    }`}>
                      {eligibility.eligible
                        ? <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        : <AlertTriangle className="w-5 h-5 text-amber-500" />
                      }
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">
                        {eligibility.eligible ? "You're Eligible" : "Not Eligible Yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Credit score: {eligibility.score}/100
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Score ring */}
                    <div className="relative w-10 h-10">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15" fill="none"
                          stroke={eligibility.score >= 80 ? "hsl(var(--primary))" : eligibility.score >= 60 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${(eligibility.score / 100) * 94.2} 94.2`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                        {eligibility.score}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showEligibilityDetails ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <AnimatePresence>
                  {showEligibilityDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2">
                        {eligibility.checks.map((check, i) => (
                          <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                            check.passed ? "bg-emerald-500/5" : "bg-destructive/5"
                          }`}>
                            <div className={check.passed ? "text-emerald-500" : "text-destructive"}>
                              {check.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground">{check.label}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {check.current} / {check.required}
                              </p>
                            </div>
                            {check.passed
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                            }
                          </div>
                        ))}
                        {!eligibility.eligible && (
                          <p className="text-[11px] text-muted-foreground text-center pt-2">
                            Use Add Money, Payments & Shopping more to unlock loans
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : null}
          </div>
        </motion.div>

        {/* Amount Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-4 mt-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Loan Amount</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNTS.map(a => (
              <motion.button
                key={a}
                whileTap={{ scale: 0.96 }}
                onClick={() => setAmount(a)}
                className={`relative py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                  amount === a
                    ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "bg-card text-foreground shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)]"
                }`}
                style={amount === a ? { background: "var(--gradient-primary)" } : undefined}
              >
                ৳{a.toLocaleString()}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Tenure Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-4 mt-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Repayment Tenure</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TENURES.map(t => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.96 }}
                onClick={() => setTenure(t)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                  tenure === t
                    ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "bg-card text-foreground shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)]"
                }`}
                style={tenure === t ? { background: "var(--gradient-primary)" } : undefined}
              >
                {t >= 365 ? `${Math.round(t / 365)}y` : `${t}d`}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* EMI Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 mt-5"
        >
          <div className="rounded-[19px] bg-card shadow-[var(--shadow-elevated)] overflow-hidden">
            <div className="p-5 pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Monthly EMI</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-primary">৳{emi.monthly.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                  <TrendingUp className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Loan Amount", value: `৳${amount.toLocaleString()}` },
                { label: `Interest (${INTEREST_RATE}% flat)`, value: `৳${emi.interest.toLocaleString()}` },
                { label: "Total Repayment", value: `৳${emi.total.toLocaleString()}`, bold: true },
                { label: "Installments", value: `${emi.installments} months` },
              ].map((row, i) => (
                <div key={i} className={`flex justify-between items-center ${row.bold ? "pt-2 border-t border-border/50" : ""}`}>
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className={`text-sm ${row.bold ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Apply Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mx-4 mt-5"
        >
          <Button
            onClick={handleApply}
            disabled={submitting || eligibilityLoading || !eligibility?.eligible}
            className="w-full h-14 rounded-2xl font-bold text-base shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-lg)] transition-shadow disabled:opacity-50 disabled:shadow-none"
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
                <Sparkles className="w-4 h-4 mr-2" />
                Apply Now
              </>
            )}
          </Button>
        </motion.div>

        {/* Applications History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-4 mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">My Applications</h3>
            {applications.length > 0 && (
              <span className="text-xs text-muted-foreground">{applications.length} total</span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : applications.length === 0 ? (
            <div className="rounded-[19px] bg-card shadow-[var(--shadow-card)] p-8 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-muted">
                <Landmark className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No applications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Apply for your first loan above</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {applications.map((app, i) => {
                  const sc = statusConfig[app.status] || statusConfig.pending;
                  return (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-[19px] bg-card shadow-[var(--shadow-card)] p-4 hover:shadow-[var(--shadow-elevated)] transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-lg font-bold text-foreground">৳{Number(app.amount).toLocaleString()}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(app.applied_at || app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${sc.bg} ${sc.color}`}>
                          {sc.icon}
                          <span className="text-xs font-semibold">{sc.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{app.tenure_days}d</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Banknote className="w-3 h-3" />
                          <span>৳{Number(app.emi_amount).toLocaleString()}/mo</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground/40" />
                      </div>
                      {app.notes && (
                        <p className="text-xs text-destructive mt-2 bg-destructive/5 rounded-xl px-3 py-2">{app.notes}</p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      {/* Terms & Conditions Sheet */}
      <Sheet open={termsOpen} onOpenChange={setTermsOpen}>
        <SheetContent side="bottom" className="rounded-t-[24px] max-h-[85vh] p-0">
          <div className="px-5 pt-5 pb-3">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-foreground">
                <FileText className="w-5 h-5 text-primary" />
                Terms & Conditions
              </SheetTitle>
            </SheetHeader>
          </div>

          <ScrollArea className="h-[45vh] px-5">
            <div className="space-y-5 pb-4 text-sm leading-relaxed text-muted-foreground">
              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">1. Loan Agreement</h4>
                <p className="text-xs">
                  By applying for a loan, you enter into a binding agreement with EasyPay. The loan amount, tenure, 
                  and interest rate selected during application are final and cannot be modified after submission.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">2. Interest & Fees</h4>
                <p className="text-xs">
                  A flat interest rate of {INTEREST_RATE}% per annum applies. No hidden charges or processing fees. 
                  Late payments may incur additional penalties at 2% per month on the outstanding amount.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">3. Repayment</h4>
                <p className="text-xs">
                  EMI payments are automatically deducted from your EasyPay wallet on the due date each month. 
                  Ensure sufficient balance to avoid failed payments. Three consecutive missed payments may result 
                  in loan default and account restrictions.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">4. Eligibility</h4>
                <p className="text-xs">
                  Loan approval is subject to your transaction history, account standing, and KYC verification status. 
                  EasyPay reserves the right to reject applications without providing specific reasons.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">5. Prepayment</h4>
                <p className="text-xs">
                  You may repay the full outstanding amount before the tenure ends without any prepayment penalty. 
                  Partial prepayments are not allowed.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">6. Default & Recovery</h4>
                <p className="text-xs">
                  In case of default, EasyPay may: (a) restrict your account features, (b) deduct outstanding amounts 
                  from incoming funds, (c) report to credit bureaus, and (d) initiate legal recovery proceedings as 
                  permitted under applicable laws.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">7. Data Usage</h4>
                <p className="text-xs">
                  Your transaction data and profile information are used solely for creditworthiness assessment. 
                  We do not share personal financial data with third parties except as required by law or regulation.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">8. Governing Law</h4>
                <p className="text-xs">
                  This agreement is governed by the laws of the People's Republic of Bangladesh. Any disputes shall 
                  be resolved through the appropriate judicial authorities.
                </p>
              </section>
            </div>
          </ScrollArea>

          <div className="px-5 pb-6 pt-3 border-t border-border/50 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I have read and agree to the <span className="text-foreground font-medium">Terms & Conditions</span>, 
                including the interest rate, repayment schedule, and default policies.
              </span>
            </label>

            <Button
              onClick={handleConfirmLoan}
              disabled={!termsAccepted || submitting}
              className="w-full h-13 rounded-2xl font-bold text-sm shadow-[var(--shadow-glow)] transition-shadow disabled:opacity-50 disabled:shadow-none"
              style={termsAccepted ? { background: "var(--gradient-primary)" } : undefined}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Confirm & Submit Application
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
