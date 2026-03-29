import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, AlertCircle, Landmark } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AMOUNTS = [1000, 5000, 10000, 25000, 50000];
const TENURES = [30, 60, 90, 180];
const INTEREST_RATE = 5; // % flat

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock className="w-4 h-4" />, color: "bg-yellow-500/15 text-yellow-600", label: "Under Review" },
  approved: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-emerald-500/15 text-emerald-600", label: "Approved" },
  rejected: { icon: <XCircle className="w-4 h-4" />, color: "bg-destructive/15 text-destructive", label: "Rejected" },
  disbursed: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-blue-500/15 text-blue-600", label: "Disbursed" },
  repaid: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-muted text-muted-foreground", label: "Repaid" },
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

  if (kycLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

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

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold text-foreground">Loan</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Amount Selector */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-foreground">Apply for a Loan</h2>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Select Amount</p>
              <div className="flex flex-wrap gap-2">
                {AMOUNTS.map(a => (
                  <button key={a} onClick={() => setAmount(a)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${amount === a ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    ৳{a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Select Tenure</p>
              <div className="flex flex-wrap gap-2">
                {TENURES.map(t => (
                  <button key={t} onClick={() => setTenure(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tenure === t ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {t} days
                  </button>
                ))}
              </div>
            </div>

            {/* EMI Breakdown */}
            <div className="bg-muted/50 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Loan Amount</span><span className="font-semibold text-foreground">৳{amount.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Interest ({INTEREST_RATE}% flat)</span><span className="font-semibold text-foreground">৳{emi.interest.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Repayment</span><span className="font-semibold text-foreground">৳{emi.total.toLocaleString()}</span></div>
              <div className="border-t border-border my-1" />
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monthly EMI ({emi.installments} months)</span><span className="font-bold text-primary">৳{emi.monthly.toLocaleString()}</span></div>
            </div>

            <Button onClick={handleApply} disabled={submitting} className="w-full rounded-xl h-12 font-bold">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply Now"}
            </Button>
          </CardContent>
        </Card>

        {/* My Applications */}
        <div>
          <h3 className="font-bold text-foreground mb-3">My Applications</h3>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : applications.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No loan applications yet</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {applications.map((app, i) => {
                const sc = statusConfig[app.status] || statusConfig.pending;
                return (
                  <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-foreground">৳{Number(app.amount).toLocaleString()}</span>
                          <Badge variant="secondary" className={sc.color}>{sc.icon}<span className="ml-1">{sc.label}</span></Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>Tenure: {app.tenure_days} days · EMI: ৳{Number(app.emi_amount).toLocaleString()}/mo</p>
                          <p>Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
                          {app.notes && <p className="text-destructive">{app.notes}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanPage;
