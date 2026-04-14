import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Landmark, TrendingUp, Calendar, Banknote, Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AMOUNTS = [1000, 3000, 5000, 10000, 25000, 50000];
const TENURES = [30, 60, 90, 180, 365];
const INTEREST_RATE = 5;

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

  useEffect(() => {
    if (!user) return;
    supabase.from("loan_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setApplications(data || []); setLoading(false); });
  }, [user]);

  if (kycLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const handleApply = async () => {
    if (!user) { toast.error("Please sign in first"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("loan_applications").insert({
      user_id: user.id,
      amount,
      tenure_days: tenure,
      interest_rate: INTEREST_RATE,
      emi_amount: emi.monthly,
    } as any);
    if (error) toast.error("Failed to submit application");
    else {
      toast.success("Loan application submitted!");
      const { data } = await supabase.from("loan_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setApplications(data || []);
    }
    setSubmitting(false);
  };

  const activeApps = applications.filter(a => ["pending", "approved", "disbursed"].includes(a.status));

  return (
    <div className="min-h-screen bg-background">
      {/* Header with gradient */}
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
          {/* Bokeh effects */}
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
            {/* Monthly EMI highlight */}
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

            {/* Breakdown */}
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
            disabled={submitting}
            className="w-full h-14 rounded-2xl font-bold text-base shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-lg)] transition-shadow"
            style={{ background: "var(--gradient-primary)" }}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
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
    </div>
  );
};

export default LoanPage;
