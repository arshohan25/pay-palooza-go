import Seo from "@/components/Seo";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Heart, Zap, Smartphone, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLAN_CATEGORIES = [
  { key: "life", label: "Life", icon: Heart, color: "text-red-500" },
  { key: "health", label: "Health", icon: Shield, color: "text-emerald-500" },
  { key: "accident", label: "Accident", icon: Zap, color: "text-amber-500" },
  { key: "device", label: "Device", icon: Smartphone, color: "text-blue-500" },
];

const PLANS: Record<string, { name: string; coverage: number; premium: number; duration: number; benefits: string[] }[]> = {
  life: [
    { name: "Basic Life Cover", coverage: 100000, premium: 150, duration: 12, benefits: ["Death benefit ৳1,00,000", "Accident cover included", "No medical exam required"] },
    { name: "Premium Life Cover", coverage: 500000, premium: 500, duration: 12, benefits: ["Death benefit ৳5,00,000", "Critical illness rider", "Family coverage", "24/7 claim support"] },
  ],
  health: [
    { name: "Essential Health", coverage: 50000, premium: 200, duration: 12, benefits: ["Hospitalization cover", "Medicine reimbursement", "Lab test coverage"] },
    { name: "Complete Health", coverage: 200000, premium: 600, duration: 12, benefits: ["Full hospitalization", "Surgery cover", "OPD benefits", "Dental & vision"] },
  ],
  accident: [
    { name: "Personal Accident", coverage: 100000, premium: 100, duration: 12, benefits: ["Accidental death benefit", "Disability cover", "Medical expenses"] },
    { name: "Family Accident", coverage: 300000, premium: 250, duration: 12, benefits: ["Family coverage up to 4", "Accidental death benefit", "Hospital cash", "Ambulance charges"] },
  ],
  device: [
    { name: "Phone Protection", coverage: 15000, premium: 50, duration: 6, benefits: ["Screen damage", "Water damage", "Theft protection"] },
    { name: "Gadget Shield", coverage: 50000, premium: 120, duration: 12, benefits: ["Covers phone + laptop", "Accidental damage", "Theft & loss", "Worldwide coverage"] },
  ],
};

const InsurancePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const [category, setCategory] = useState("life");
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS["life"][0] | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "my">("browse");

  useEffect(() => {
    if (!user) return;
    supabase.from("insurance_policies").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setPolicies(data || []); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!kycLoading && kycStatus !== "verified") {
      toast.error("Please complete KYC verification to use this feature.");
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate]);

  

  const handlePurchase = async (plan: typeof PLANS["life"][0]) => {
    if (!user) { toast.error("Please sign in first"); return; }
    setPurchasing(true);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.duration);

    const { error } = await supabase.from("insurance_policies").insert({
      user_id: user.id,
      plan_type: category,
      plan_name: plan.name,
      coverage_amount: plan.coverage,
      premium: plan.premium,
      duration_months: plan.duration,
      expires_at: expiresAt.toISOString(),
    } as any);

    if (error) toast.error("Failed to purchase plan");
    else {
      toast.success("Insurance plan activated!");
      setSelectedPlan(null);
      const { data } = await supabase.from("insurance_policies").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setPolicies(data || []);
    }
    setPurchasing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => { if (selectedPlan) setSelectedPlan(null); else navigate(-1); }} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold text-foreground">{selectedPlan ? selectedPlan.name : "Insurance"}</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {selectedPlan ? (
          /* Plan Detail */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-3xl font-bold text-foreground">৳{selectedPlan.coverage.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Coverage Amount</p>
                </div>
                <div className="flex justify-between text-sm bg-muted/50 rounded-xl p-3">
                  <div><p className="text-muted-foreground">Premium</p><p className="font-bold text-foreground">৳{selectedPlan.premium}/mo</p></div>
                  <div className="text-right"><p className="text-muted-foreground">Duration</p><p className="font-bold text-foreground">{selectedPlan.duration} months</p></div>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-2">Benefits</p>
                  <ul className="space-y-2">
                    {selectedPlan.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button onClick={() => handlePurchase(selectedPlan)} disabled={purchasing} className="w-full rounded-xl h-12 font-bold">
                  {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Purchase for ৳${selectedPlan.premium}/mo`}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 bg-muted/50 rounded-xl p-1">
              <button onClick={() => setTab("browse")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "browse" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Browse Plans</button>
              <button onClick={() => setTab("my")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "my" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>My Policies</button>
            </div>

            {tab === "browse" ? (
              <>
                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {PLAN_CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => setCategory(c.key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${category === c.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <c.icon className="w-4 h-4" />{c.label}
                    </button>
                  ))}
                </div>

                {/* Plan Cards */}
                <div className="space-y-3">
                  {PLANS[category]?.map((plan, i) => (
                    <motion.div key={plan.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPlan(plan)}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-foreground">{plan.name}</h3>
                            <Badge variant="secondary">৳{plan.premium}/mo</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Coverage: ৳{plan.coverage.toLocaleString()} · {plan.duration} months</p>
                          <p className="text-xs text-primary mt-1 font-medium">Tap to view details →</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              /* My Policies */
              loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : policies.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No active policies</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {policies.map((p, i) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-foreground text-sm">{p.plan_name}</h3>
                            <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Coverage: ৳{Number(p.coverage_amount).toLocaleString()} · ৳{Number(p.premium).toLocaleString()}/mo</p>
                          {p.expires_at && <p className="text-xs text-muted-foreground">Expires: {new Date(p.expires_at).toLocaleDateString()}</p>}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InsurancePage;
