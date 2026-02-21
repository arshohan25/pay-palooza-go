import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine, Wallet, TrendingUp,
  UserPlus, Receipt, ArrowLeft, RefreshCw, Users,
  BarChart3, Clock, CheckCircle2, Phone,
  ChevronRight, Shield, Building2, Activity,
  Banknote, PieChart, Zap, Bell, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";
import { useNavigate } from "react-router-dom";

/* ─── Types ─── */
type AgentTab = "overview" | "cashin" | "register" | "billpay" | "float" | "commission";

interface AgentInfo {
  business_name: string | null;
  commission_earned: number;
  max_float: number;
  customers_onboarded: number;
  status: string;
  territory_code: string | null;
}

/* ─── Helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const COMMISSION_RATE = 0.00499; // 0.499%

const staggerChild = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] as const }
  }),
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const AgentDashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<AgentTab>("overview");
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [balance, setBalance] = useState(0);
  const [isAgent, setIsAgent] = useState<boolean | null>(null);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Load agent data ── */
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [roleRes, profileRes, agentRes, txnRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "agent"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("agents").select("*").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);

    setIsAgent((roleRes.data?.length ?? 0) > 0);
    setBalance(profileRes.data?.balance ?? 0);
    setAgentInfo(agentRes.data as AgentInfo | null);
    setRecentTxns(txnRes.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Auth guard ── */
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Login required</p>
        <Button onClick={() => navigate("/")} variant="outline">Go to Login</Button>
      </div>
    );
  }

  if (isAgent === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Building2 size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Agent Access Required</p>
        <p className="text-sm text-muted-foreground max-w-xs">Contact your distributor or admin for agent access.</p>
        <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft size={16} className="mr-2" />Back to Home</Button>
      </div>
    );
  }

  const floatPct = Math.min(100, (balance / (agentInfo?.max_float ?? 500000)) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero Header ── */}
      <header className="relative overflow-hidden">
        <div className="gradient-hero px-4 pt-5 pb-24">
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/5" />
          <div className="absolute top-32 -left-16 w-40 h-40 rounded-full bg-white/5" />

          <div className="relative max-w-xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => navigate("/")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <button onClick={loadData} className="tap-target text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  <RefreshCw size={17} />
                </button>
              </div>
            </div>

            {/* Agent identity */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl glass-hero flex items-center justify-center">
                <Building2 size={22} className="text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-primary-foreground truncate">{agentInfo?.business_name || "Agent Portal"}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className="bg-white/15 text-primary-foreground border-0 text-[9px] px-1.5 py-0 font-semibold backdrop-blur-sm">
                    {agentInfo?.territory_code || "BD"}
                  </Badge>
                  <span className="text-[10px] text-primary-foreground/70 capitalize">{agentInfo?.status || "active"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Float Card (overlaps header) ── */}
      <div className="max-w-xl mx-auto px-4 -mt-16 relative z-10">
        <Card className="p-5 border-0 shadow-elevated bg-card rounded-2xl">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Float Balance</p>
              <p className="text-3xl font-extrabold text-foreground mt-0.5">৳{fmt(balance)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className={`text-[9px] font-bold ${floatPct > 50 ? "text-primary border-primary/30" : floatPct > 20 ? "text-accent border-accent/30" : "text-destructive border-destructive/30"}`}>
                {floatPct > 50 ? "Healthy" : floatPct > 20 ? "Low" : "Critical"}
              </Badge>
              <p className="text-[10px] text-muted-foreground">Max ৳{fmt(agentInfo?.max_float ?? 500000)}</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${floatPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full gradient-primary rounded-full"
            />
          </div>
        </Card>
      </div>

      {/* ── Quick Action Tiles ── */}
      <div className="max-w-xl mx-auto px-4 mt-5">
        <div className="grid grid-cols-5 gap-3">
          {([
            { id: "cashin" as AgentTab, icon: ArrowDownToLine, label: "Cash In", gradient: "gradient-cashout" },
            { id: "register" as AgentTab, icon: UserPlus, label: "Register", gradient: "gradient-addmoney" },
            { id: "billpay" as AgentTab, icon: Receipt, label: "Bill Pay", gradient: "gradient-payment" },
            { id: "float" as AgentTab, icon: Wallet, label: "Float", gradient: "gradient-accent" },
            { id: "commission" as AgentTab, icon: TrendingUp, label: "Earnings", gradient: "gradient-send" },
          ]).map((item, i) => (
            <motion.button
              key={item.id}
              custom={i}
              variants={staggerChild}
              initial="hidden"
              animate="visible"
              whileTap={{ scale: 0.92 }}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all press-effect ${
                activeTab === item.id
                  ? "bg-primary/10 ring-1 ring-primary/20"
                  : "bg-card shadow-xs hover:shadow-card"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl ${item.gradient} flex items-center justify-center shadow-sm`}>
                <item.icon size={18} className="text-primary-foreground" />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground leading-tight">{item.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="max-w-xl mx-auto px-4 py-5 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            {activeTab === "overview" && <OverviewTab balance={balance} agentInfo={agentInfo} recentTxns={recentTxns} onTabChange={setActiveTab} />}
            {activeTab === "cashin" && <CashInTab toast={toast} onDone={loadData} />}
            {activeTab === "register" && <RegisterTab toast={toast} onDone={loadData} />}
            {activeTab === "billpay" && <BillPayTab toast={toast} onDone={loadData} />}
            {activeTab === "float" && <FloatTab balance={balance} maxFloat={agentInfo?.max_float ?? 500000} />}
            {activeTab === "commission" && <CommissionTab agentInfo={agentInfo} recentTxns={recentTxns} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Overview Tab ── */
const OverviewTab = ({ balance, agentInfo, recentTxns, onTabChange }: { balance: number; agentInfo: AgentInfo | null; recentTxns: any[]; onTabChange: (t: AgentTab) => void }) => {
  const todayTxns = recentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayVolume = todayTxns.reduce((sum, t) => sum + t.amount, 0);

  const stats = [
    { label: "Today's Txns", value: todayTxns.length.toString(), icon: Activity, color: "bg-primary/10 text-primary" },
    { label: "Volume", value: `৳${fmt(todayVolume)}`, icon: BarChart3, color: "bg-accent/10 text-accent" },
    { label: "Commission", value: `৳${fmt(agentInfo?.commission_earned ?? 0)}`, icon: TrendingUp, color: "bg-primary/10 text-primary" },
    { label: "Customers", value: (agentInfo?.customers_onboarded ?? 0).toString(), icon: Users, color: "bg-accent/10 text-accent" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            custom={i}
            variants={staggerChild}
            initial="hidden"
            animate="visible"
          >
            <Card className="p-4 border-0 shadow-card rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-xl ${s.color} flex items-center justify-center`}>
                  <s.icon size={15} />
                </div>
              </div>
              <p className="text-lg font-extrabold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground font-semibold">{s.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Commission rate notice */}
      <Card className="p-4 border-0 shadow-card rounded-2xl bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Banknote size={18} className="text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground">0.499% Commission</p>
            <p className="text-[10px] text-muted-foreground">You earn on every Cash In & Cash Out transaction</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </div>
      </Card>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
          {recentTxns.length > 0 && (
            <button className="text-[10px] font-bold text-primary">View All</button>
          )}
        </div>
        <Card className="border-0 shadow-card rounded-2xl overflow-hidden">
          {recentTxns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Clock size={28} className="mb-2 opacity-40" />
              <p className="text-xs font-medium">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentTxns.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.type === "cashin" || tx.type === "receive" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                  }`}>
                    <ArrowDownToLine size={15} className={tx.type === "cashin" || tx.type === "receive" ? "" : "rotate-180"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground capitalize truncate">{tx.type.replace(/([A-Z])/g, ' $1')}</p>
                    <p className="text-[10px] text-muted-foreground">{tx.recipient_phone || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-extrabold ${tx.type === "receive" || tx.type === "cashin" ? "text-primary" : "text-foreground"}`}>
                      {tx.type === "receive" || tx.type === "cashin" ? "+" : "-"}৳{fmt(tx.amount)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

/* ── Cash In Tab ── */
const CashInTab = ({ toast, onDone }: { toast: any; onDone: () => void }) => {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [processing, setProcessing] = useState(false);
  const [pin, setPin] = useState("");
  const commission = Number(amount) > 0 ? Math.round(Number(amount) * COMMISSION_RATE * 100) / 100 : 0;

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: phone,
        p_amount: Number(amount),
        p_fee: 0,
        p_type: "cashin" as any,
        p_recipient_type: "cashin" as any,
        p_commission: commission,
        p_description: "Agent Cash In",
        p_reference: `CI-${Date.now()}`,
      });
      if (error) throw error;
      setStep("done");
      toast({ title: "Cash In Successful", description: `৳${amount} deposited to ${phone}` });
      onDone();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (step === "done") {
    return (
      <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
        >
          <CheckCircle2 size={32} className="text-primary" />
        </motion.div>
        <div>
          <p className="text-lg font-extrabold text-foreground">Cash In Successful</p>
          <p className="text-sm text-muted-foreground mt-1">৳{fmt(Number(amount))} deposited to {phone}</p>
        </div>
        <div className="bg-primary/5 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground">Commission earned</p>
          <p className="text-sm font-bold text-primary">+৳{fmt(commission)}</p>
        </div>
        <Button onClick={() => { setStep("form"); setPhone(""); setAmount(""); setPin(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">
          New Transaction
        </Button>
      </Card>
    );
  }

  if (step === "confirm") {
    return (
      <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
        <h3 className="text-base font-extrabold text-foreground text-center">Confirm Cash In</h3>
        <div className="space-y-2.5 bg-muted/50 rounded-xl p-4">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer</span><span className="font-bold text-foreground">{phone}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee</span><span className="font-bold text-primary">Free</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Your Commission (0.499%)</span><span className="font-bold text-primary">৳{fmt(commission)}</span></div>
        </div>
        <div>
          <Label className="text-xs font-semibold">Enter PIN</Label>
          <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1" />
        </div>
        <SlideToConfirm onConfirm={handleConfirm} disabled={pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Deposit"} />
        <Button variant="ghost" onClick={() => setStep("form")} className="w-full text-muted-foreground">Cancel</Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-xl gradient-cashout flex items-center justify-center shadow-sm">
          <ArrowDownToLine size={20} className="text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-foreground">Cash In</h3>
          <p className="text-[10px] text-muted-foreground font-medium">Deposit to customer wallet · 0.499% commission</p>
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Customer Phone</Label>
        <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} className="rounded-xl h-11 mt-1" />
      </div>
      <div>
        <Label className="text-xs font-semibold">Amount (৳)</Label>
        <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
        {Number(amount) > 0 && (
          <p className="text-[10px] text-primary font-semibold mt-1.5">Commission: ৳{fmt(commission)}</p>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {[500, 1000, 2000, 5000, 10000].map(a => (
          <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground press-effect hover:bg-primary/10 hover:text-primary transition-colors">
            ৳{fmt(a)}
          </button>
        ))}
      </div>
      <Button onClick={() => setStep("confirm")} disabled={phone.length < 11 || !amount || Number(amount) < 10} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold">
        Continue
      </Button>
    </Card>
  );
};

/* ── Register Customer Tab ── */
const RegisterTab = ({ toast, onDone }: { toast: any; onDone: () => void }) => {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [nid, setNid] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const handleRegister = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const email = `${phone}@easypay.local`;
      const { error: authErr } = await supabase.auth.signUp({
        email,
        password: `${phone.slice(-4)}EP`,
        options: { data: { phone, name } }
      });
      if (authErr) throw authErr;
      setDone(true);
      toast({ title: "Customer Registered", description: `${name || phone} successfully onboarded` });
      onDone();
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (done) {
    return (
      <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
        >
          <UserPlus size={32} className="text-primary" />
        </motion.div>
        <p className="text-lg font-extrabold text-foreground">Registration Complete</p>
        <p className="text-sm text-muted-foreground">{name || phone} has been onboarded</p>
        <Button onClick={() => { setDone(false); setPhone(""); setName(""); setNid(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">
          Register Another
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-xl gradient-addmoney flex items-center justify-center shadow-sm">
          <UserPlus size={20} className="text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-foreground">Register Customer</h3>
          <p className="text-[10px] text-muted-foreground font-medium">Onboard new customer · ৳20 bonus</p>
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Phone Number</Label>
        <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} className="rounded-xl h-11 mt-1" />
      </div>
      <div>
        <Label className="text-xs font-semibold">Full Name</Label>
        <Input placeholder="Customer name" value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-11 mt-1" />
      </div>
      <div>
        <Label className="text-xs font-semibold">NID Number (Optional)</Label>
        <Input type="text" inputMode="numeric" placeholder="NID number" value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
      </div>
      <Button onClick={handleRegister} disabled={phone.length < 11 || processing} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold">
        {processing ? "Registering…" : "Register Customer"}
      </Button>
    </Card>
  );
};

/* ── Bill Pay Tab ── */
const BillPayTab = ({ toast, onDone }: { toast: any; onDone: () => void }) => {
  const providers = [
    { name: "DESCO", category: "Electricity", icon: "⚡" },
    { name: "DPDC", category: "Electricity", icon: "⚡" },
    { name: "Titas Gas", category: "Gas", icon: "🔥" },
    { name: "WASA", category: "Water", icon: "💧" },
    { name: "Link3", category: "Internet", icon: "🌐" },
    { name: "Carnival", category: "Internet", icon: "🌐" },
  ];

  const [selected, setSelected] = useState<string | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"select" | "form" | "done">("select");
  const [processing, setProcessing] = useState(false);
  const [pin, setPin] = useState("");

  const handlePay = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        type: "paybill" as any,
        amount: Number(amount),
        fee: 0,
        status: "completed" as any,
        description: `Bill Pay - ${selected}`,
        recipient_name: selected,
        reference: `BP-${Date.now()}`,
      });
      if (error) throw error;
      setStep("done");
      toast({ title: "Bill Paid", description: `৳${amount} paid to ${selected}` });
      onDone();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (step === "done") {
    return (
      <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
        >
          <CheckCircle2 size={32} className="text-primary" />
        </motion.div>
        <p className="text-lg font-extrabold text-foreground">Bill Paid</p>
        <p className="text-sm text-muted-foreground">৳{fmt(Number(amount))} to {selected}</p>
        <Button onClick={() => { setStep("select"); setSelected(null); setAmount(""); setAccountNo(""); setPin(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">
          Pay Another
        </Button>
      </Card>
    );
  }

  if (step === "form" && selected) {
    return (
      <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("select")} className="rounded-xl"><ArrowLeft size={16} /></Button>
          <h3 className="text-base font-extrabold text-foreground">{selected}</h3>
        </div>
        <div>
          <Label className="text-xs font-semibold">Account / Meter Number</Label>
          <Input placeholder="Enter account number" value={accountNo} onChange={e => setAccountNo(e.target.value)} className="rounded-xl h-11 mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold">Bill Amount (৳)</Label>
          <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold">Enter PIN</Label>
          <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1" />
        </div>
        <SlideToConfirm onConfirm={handlePay} disabled={!accountNo || !amount || pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Pay Bill"} />
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-xl gradient-payment flex items-center justify-center shadow-sm">
          <Receipt size={20} className="text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-foreground">Pay Bills</h3>
          <p className="text-[10px] text-muted-foreground font-medium">Pay utility bills for customers</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {providers.map((p, i) => (
          <motion.button
            key={p.name}
            custom={i}
            variants={staggerChild}
            initial="hidden"
            animate="visible"
            onClick={() => { setSelected(p.name); setStep("form"); }}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/40 press-effect text-left hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            <span className="text-xl">{p.icon}</span>
            <div>
              <p className="text-xs font-bold text-foreground">{p.name}</p>
              <p className="text-[9px] text-muted-foreground">{p.category}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </Card>
  );
};

/* ── Float Management Tab ── */
const FloatTab = ({ balance, maxFloat }: { balance: number; maxFloat: number }) => {
  const pct = Math.min(100, (balance / maxFloat) * 100);
  const status = pct > 50 ? "Healthy" : pct > 20 ? "Low" : "Critical";
  const statusColor = pct > 50 ? "text-primary" : pct > 20 ? "text-accent" : "text-destructive";

  return (
    <div className="space-y-4">
      <Card className="p-5 border-0 shadow-elevated rounded-2xl">
        <h3 className="text-sm font-extrabold text-foreground mb-4">Float Status</h3>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Current</p>
            <p className="text-2xl font-extrabold text-foreground">৳{fmt(balance)}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] font-bold ${statusColor}`}>{status}</Badge>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full gradient-primary rounded-full"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-right">Max: ৳{fmt(maxFloat)}</p>
      </Card>

      <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-3">
        <h3 className="text-sm font-extrabold text-foreground">Request Float</h3>
        <p className="text-xs text-muted-foreground">Request float from your distributor when balance is low.</p>
        <div className="flex gap-2">
          {[10000, 25000, 50000].map(a => (
            <Button key={a} variant="outline" size="sm" className="flex-1 text-xs rounded-xl font-bold">৳{fmt(a)}</Button>
          ))}
        </div>
        <Button className="w-full gradient-primary text-primary-foreground rounded-xl h-11 font-bold">Request Float</Button>
      </Card>

      <Card className="p-5 border-0 shadow-elevated rounded-2xl">
        <h3 className="text-sm font-extrabold text-foreground mb-3">Guidelines</h3>
        <div className="space-y-2.5 text-xs text-muted-foreground">
          <div className="flex items-start gap-2"><Zap size={12} className="text-primary mt-0.5 shrink-0" /><span>Maintain minimum ৳5,000 float at all times</span></div>
          <div className="flex items-start gap-2"><Zap size={12} className="text-primary mt-0.5 shrink-0" /><span>Maximum daily float limit: ৳{fmt(maxFloat)}</span></div>
          <div className="flex items-start gap-2"><Zap size={12} className="text-primary mt-0.5 shrink-0" /><span>Float requests processed within 2 hours</span></div>
          <div className="flex items-start gap-2"><Zap size={12} className="text-primary mt-0.5 shrink-0" /><span>Contact distributor for emergency float</span></div>
        </div>
      </Card>
    </div>
  );
};

/* ── Commission Tab ── */
const CommissionTab = ({ agentInfo, recentTxns }: { agentInfo: AgentInfo | null; recentTxns: any[] }) => {
  const totalCommission = agentInfo?.commission_earned ?? 0;
  const commissionTxns = recentTxns.filter(t => t.commission > 0);

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <Card className="p-6 border-0 shadow-elevated rounded-2xl gradient-hero text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5" />
        <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">Total Earnings</p>
        <p className="text-4xl font-extrabold mt-1">৳{fmt(totalCommission)}</p>
        <p className="text-[10px] opacity-60 mt-2">{agentInfo?.customers_onboarded ?? 0} customers onboarded</p>
      </Card>

      {/* Rates */}
      <Card className="p-5 border-0 shadow-elevated rounded-2xl">
        <h3 className="text-sm font-extrabold text-foreground mb-3">Commission Rates</h3>
        <div className="space-y-0">
          {[
            { type: "Cash In", rate: "0.499%", desc: "Per transaction" },
            { type: "Cash Out", rate: "0.499%", desc: "Per transaction" },
            { type: "Bill Pay", rate: "0.30%", desc: "Per bill" },
            { type: "Registration", rate: "৳20", desc: "Per customer" },
          ].map(r => (
            <div key={r.type} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
              <div>
                <p className="text-xs font-bold text-foreground">{r.type}</p>
                <p className="text-[10px] text-muted-foreground">{r.desc}</p>
              </div>
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-extrabold">{r.rate}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent commissions */}
      <Card className="p-5 border-0 shadow-elevated rounded-2xl">
        <h3 className="text-sm font-extrabold text-foreground mb-3">Recent Commissions</h3>
        {commissionTxns.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <PieChart size={28} className="mb-2 opacity-40" />
            <p className="text-xs font-medium">No commission transactions yet</p>
          </div>
        ) : (
          <div className="space-y-0">
            {commissionTxns.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                <div>
                  <p className="text-xs font-bold text-foreground capitalize">{tx.type}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-xs font-extrabold text-primary">+৳{fmt(tx.commission)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AgentDashboard;
