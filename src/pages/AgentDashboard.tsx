import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine, ArrowUpFromLine, Wallet, TrendingUp,
  UserPlus, Receipt, ArrowLeft, RefreshCw, Users, DollarSign,
  BarChart3, Clock, CheckCircle2, XCircle, Phone, User,
  ChevronRight, Shield, Building2, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";
import { useNavigate } from "react-router-dom";

/* ─── Types ─── */
type AgentTab = "overview" | "cashin" | "cashout" | "register" | "billpay" | "float" | "commission";

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

const tabItems: { id: AgentTab; icon: typeof ArrowDownToLine; label: string }[] = [
  { id: "overview",   icon: BarChart3,       label: "Overview" },
  { id: "cashin",     icon: ArrowDownToLine, label: "Cash In" },
  { id: "cashout",    icon: ArrowUpFromLine, label: "Cash Out" },
  { id: "register",   icon: UserPlus,        label: "Register" },
  { id: "billpay",    icon: Receipt,         label: "Bill Pay" },
  { id: "float",      icon: Wallet,          label: "Float" },
  { id: "commission", icon: TrendingUp,      label: "Commission" },
];

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
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAgent === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Building2 size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Agent Access Required</p>
        <p className="text-sm text-muted-foreground max-w-xs">You need an agent role to access this dashboard. Contact your distributor or admin.</p>
        <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft size={16} className="mr-2" />Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="gradient-hero text-primary-foreground px-4 pt-6 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, hsl(0 0% 100% / 0.2) 0%, transparent 50%)"
        }} />
        <div className="relative max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate("/")} className="tap-target">
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-lg font-bold">Agent Portal</h1>
            <button onClick={loadData} className="tap-target">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gradient-glass flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <p className="font-bold text-base">{agentInfo?.business_name || "Agent Shop"}</p>
              <p className="text-xs opacity-80">{agentInfo?.territory_code || "BD"} · {agentInfo?.status || "active"}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Float Balance Card (overlapping header) ── */}
      <div className="max-w-xl mx-auto px-4 -mt-10 relative z-10">
        <Card className="p-4 shadow-elevated border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Float Balance</p>
              <p className="text-2xl font-bold text-foreground">৳{fmt(balance)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-medium">Max Float</p>
              <p className="text-sm font-semibold text-foreground">৳{fmt(agentInfo?.max_float ?? 500000)}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary rounded-full transition-all"
              style={{ width: `${Math.min(100, (balance / (agentInfo?.max_float ?? 500000)) * 100)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* ── Tab strip ── */}
      <div className="max-w-xl mx-auto px-4 mt-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
          {tabItems.map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all press-effect ${
                  active
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "bg-card text-muted-foreground border border-border"
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="max-w-xl mx-auto px-4 py-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview"   && <OverviewTab balance={balance} agentInfo={agentInfo} recentTxns={recentTxns} />}
            {activeTab === "cashin"     && <CashInTab toast={toast} onDone={loadData} />}
            {activeTab === "cashout"    && <CashOutTab toast={toast} onDone={loadData} />}
            {activeTab === "register"   && <RegisterTab toast={toast} onDone={loadData} />}
            {activeTab === "billpay"    && <BillPayTab toast={toast} onDone={loadData} />}
            {activeTab === "float"      && <FloatTab balance={balance} maxFloat={agentInfo?.max_float ?? 500000} />}
            {activeTab === "commission" && <CommissionTab agentInfo={agentInfo} recentTxns={recentTxns} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Overview Tab ── */
const OverviewTab = ({ balance, agentInfo, recentTxns }: { balance: number; agentInfo: AgentInfo | null; recentTxns: any[] }) => {
  const stats = [
    { label: "Today's Transactions", value: recentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString()).length.toString(), icon: Clock, color: "gradient-accent" },
    { label: "Commission Earned", value: `৳${fmt(agentInfo?.commission_earned ?? 0)}`, icon: TrendingUp, color: "gradient-cashout" },
    { label: "Customers Onboarded", value: (agentInfo?.customers_onboarded ?? 0).toString(), icon: Users, color: "gradient-addmoney" },
    { label: "Float Balance", value: `৳${fmt(balance)}`, icon: Wallet, color: "gradient-send" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="p-3 border-0 shadow-card">
            <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
              <s.icon size={16} className="text-primary-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Recent Activity</h3>
        {recentTxns.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {recentTxns.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    tx.type === "cashin" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}>
                    {tx.type === "cashin" ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground capitalize">{tx.type}</p>
                    <p className="text-[10px] text-muted-foreground">{tx.recipient_phone || "—"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${tx.type === "receive" || tx.type === "cashin" ? "text-primary" : "text-foreground"}`}>
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
  );
};

/* ── Cash In Tab ── */
const CashInTab = ({ toast, onDone }: { toast: any; onDone: () => void }) => {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [processing, setProcessing] = useState(false);
  const [pin, setPin] = useState("");
  const [ref, setRef] = useState("");

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
        p_description: "Agent Cash In",
        p_reference: `CI-${Date.now()}`,
      });
      if (error) throw error;
      setRef(`CI-${Date.now()}`);
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
      <Card className="p-6 border-0 shadow-card text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-primary" />
        </div>
        <p className="text-lg font-bold text-foreground">Cash In Successful</p>
        <p className="text-sm text-muted-foreground">৳{fmt(Number(amount))} deposited to {phone}</p>
        <Button onClick={() => { setStep("form"); setPhone(""); setAmount(""); setPin(""); }} className="w-full mt-2">New Transaction</Button>
      </Card>
    );
  }

  if (step === "confirm") {
    return (
      <Card className="p-5 border-0 shadow-card space-y-4">
        <h3 className="text-base font-bold text-foreground text-center">Confirm Cash In</h3>
        <div className="space-y-2 bg-muted/50 rounded-xl p-4">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer</span><span className="font-semibold text-foreground">{phone}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-foreground">৳{fmt(Number(amount))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee</span><span className="font-semibold text-primary">Free</span></div>
        </div>
        <div>
          <Label className="text-xs">Enter PIN</Label>
          <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em]" />
        </div>
        <SlideToConfirm onConfirm={handleConfirm} disabled={pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Deposit"} />
        <Button variant="ghost" onClick={() => setStep("form")} className="w-full">Cancel</Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl gradient-cashout flex items-center justify-center">
          <ArrowDownToLine size={18} className="text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Cash In</h3>
          <p className="text-[10px] text-muted-foreground">Deposit money to customer wallet</p>
        </div>
      </div>
      <div>
        <Label className="text-xs">Customer Phone</Label>
        <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} />
      </div>
      <div>
        <Label className="text-xs">Amount (৳)</Label>
        <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {[500, 1000, 2000, 5000].map(a => (
          <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground press-effect">৳{fmt(a)}</button>
        ))}
      </div>
      <Button onClick={() => setStep("confirm")} disabled={phone.length < 11 || !amount || Number(amount) < 10} className="w-full gradient-primary text-primary-foreground">
        Continue
      </Button>
    </Card>
  );
};

/* ── Cash Out Tab ── */
const CashOutTab = ({ toast, onDone }: { toast: any; onDone: () => void }) => {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [processing, setProcessing] = useState(false);
  const [pin, setPin] = useState("");
  const fee = Number(amount) > 0 ? Math.round(Number(amount) * 0.0185) : 0;
  const commission = Number(amount) > 0 ? Math.round(Number(amount) * 0.01) : 0;

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: phone,
        p_amount: Number(amount),
        p_fee: fee,
        p_type: "cashout" as any,
        p_recipient_type: "cashout" as any,
        p_commission: commission,
        p_description: "Agent Cash Out",
        p_reference: `CO-${Date.now()}`,
      });
      if (error) throw error;
      setStep("done");
      toast({ title: "Cash Out Successful", description: `৳${amount} withdrawn for ${phone}` });
      onDone();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (step === "done") {
    return (
      <Card className="p-6 border-0 shadow-card text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-primary" />
        </div>
        <p className="text-lg font-bold text-foreground">Cash Out Complete</p>
        <p className="text-sm text-muted-foreground">৳{fmt(Number(amount))} given to {phone}</p>
        <p className="text-xs text-primary font-semibold">Commission earned: ৳{fmt(commission)}</p>
        <Button onClick={() => { setStep("form"); setPhone(""); setAmount(""); setPin(""); }} className="w-full mt-2">New Transaction</Button>
      </Card>
    );
  }

  if (step === "confirm") {
    return (
      <Card className="p-5 border-0 shadow-card space-y-4">
        <h3 className="text-base font-bold text-foreground text-center">Confirm Cash Out</h3>
        <div className="space-y-2 bg-muted/50 rounded-xl p-4">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer</span><span className="font-semibold text-foreground">{phone}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-foreground">৳{fmt(Number(amount))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee (1.85%)</span><span className="font-semibold text-destructive">৳{fmt(fee)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Your Commission</span><span className="font-semibold text-primary">৳{fmt(commission)}</span></div>
        </div>
        <div>
          <Label className="text-xs">Enter PIN</Label>
          <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em]" />
        </div>
        <SlideToConfirm onConfirm={handleConfirm} disabled={pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Confirm"} />
        <Button variant="ghost" onClick={() => setStep("form")} className="w-full">Cancel</Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl gradient-send flex items-center justify-center">
          <ArrowUpFromLine size={18} className="text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Cash Out</h3>
          <p className="text-[10px] text-muted-foreground">Withdraw from customer wallet</p>
        </div>
      </div>
      <div>
        <Label className="text-xs">Customer Phone</Label>
        <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} />
      </div>
      <div>
        <Label className="text-xs">Amount (৳)</Label>
        <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} />
        {Number(amount) > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">Fee: ৳{fmt(fee)} · Commission: ৳{fmt(commission)}</p>
        )}
      </div>
      <Button onClick={() => setStep("confirm")} disabled={phone.length < 11 || !amount || Number(amount) < 30} className="w-full gradient-primary text-primary-foreground">
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
      // Create user account via Supabase auth
      const email = `${phone}@easypay.local`;
      const { data: authData, error: authErr } = await supabase.auth.signUp({
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
      <Card className="p-6 border-0 shadow-card text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <UserPlus size={28} className="text-primary" />
        </div>
        <p className="text-lg font-bold text-foreground">Registration Complete</p>
        <p className="text-sm text-muted-foreground">{name || phone} has been onboarded</p>
        <Button onClick={() => { setDone(false); setPhone(""); setName(""); setNid(""); }} className="w-full mt-2">Register Another</Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl gradient-addmoney flex items-center justify-center">
          <UserPlus size={18} className="text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Register Customer</h3>
          <p className="text-[10px] text-muted-foreground">Onboard new customer to EasyPay</p>
        </div>
      </div>
      <div>
        <Label className="text-xs">Phone Number</Label>
        <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} />
      </div>
      <div>
        <Label className="text-xs">Full Name</Label>
        <Input placeholder="Customer name" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">NID Number (Optional)</Label>
        <Input type="text" inputMode="numeric" placeholder="NID number" value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Button onClick={handleRegister} disabled={phone.length < 11 || processing} className="w-full gradient-primary text-primary-foreground">
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
      <Card className="p-6 border-0 shadow-card text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-primary" />
        </div>
        <p className="text-lg font-bold text-foreground">Bill Paid</p>
        <p className="text-sm text-muted-foreground">৳{fmt(Number(amount))} to {selected}</p>
        <Button onClick={() => { setStep("select"); setSelected(null); setAmount(""); setAccountNo(""); setPin(""); }} className="w-full mt-2">Pay Another</Button>
      </Card>
    );
  }

  if (step === "form" && selected) {
    return (
      <Card className="p-5 border-0 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("select")}><ArrowLeft size={16} /></Button>
          <h3 className="text-base font-bold text-foreground">{selected}</h3>
        </div>
        <div>
          <Label className="text-xs">Account / Meter Number</Label>
          <Input placeholder="Enter account number" value={accountNo} onChange={e => setAccountNo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Bill Amount (৳)</Label>
          <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <Label className="text-xs">Enter PIN</Label>
          <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em]" />
        </div>
        <SlideToConfirm onConfirm={handlePay} disabled={!accountNo || !amount || pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Pay Bill"} />
      </Card>
    );
  }

  return (
    <Card className="p-5 border-0 shadow-card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl gradient-payment flex items-center justify-center">
          <Receipt size={18} className="text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Pay Bills</h3>
          <p className="text-[10px] text-muted-foreground">Pay utility bills for customers</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {providers.map(p => (
          <button
            key={p.name}
            onClick={() => { setSelected(p.name); setStep("form"); }}
            className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/50 press-effect text-left"
          >
            <span className="text-xl">{p.icon}</span>
            <div>
              <p className="text-xs font-semibold text-foreground">{p.name}</p>
              <p className="text-[9px] text-muted-foreground">{p.category}</p>
            </div>
          </button>
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
      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-4">Float Status</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Current Float</span>
          <span className="text-lg font-bold text-foreground">৳{fmt(balance)}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
          <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Max: ৳{fmt(maxFloat)}</span>
          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>{status}</Badge>
        </div>
      </Card>

      <Card className="p-5 border-0 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-foreground">Float Request</h3>
        <p className="text-xs text-muted-foreground">Request float from your distributor when balance is low.</p>
        <div className="flex gap-2">
          {[10000, 25000, 50000].map(a => (
            <Button key={a} variant="outline" size="sm" className="flex-1 text-xs">৳{fmt(a)}</Button>
          ))}
        </div>
        <Button className="w-full gradient-primary text-primary-foreground">Request Float</Button>
      </Card>

      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Float Guidelines</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>• Maintain minimum ৳5,000 float at all times</p>
          <p>• Maximum daily float limit: ৳{fmt(maxFloat)}</p>
          <p>• Float requests processed within 2 hours</p>
          <p>• Contact distributor for emergency float</p>
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
      <Card className="p-5 border-0 shadow-card gradient-hero text-primary-foreground">
        <p className="text-xs opacity-80 font-medium">Total Commission Earned</p>
        <p className="text-3xl font-bold mt-1">৳{fmt(totalCommission)}</p>
        <p className="text-[10px] opacity-70 mt-1">From {agentInfo?.customers_onboarded ?? 0} customers onboarded</p>
      </Card>

      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Commission Rates</h3>
        <div className="space-y-2">
          {[
            { type: "Cash Out", rate: "1.00%", desc: "Per transaction" },
            { type: "Cash In", rate: "0.50%", desc: "Per transaction" },
            { type: "Bill Pay", rate: "0.30%", desc: "Per bill" },
            { type: "Registration", rate: "৳20", desc: "Per new customer" },
          ].map(r => (
            <div key={r.type} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-xs font-semibold text-foreground">{r.type}</p>
                <p className="text-[10px] text-muted-foreground">{r.desc}</p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-bold">{r.rate}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Recent Commissions</h3>
        {commissionTxns.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No commission transactions yet</p>
        ) : (
          <div className="space-y-2">
            {commissionTxns.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-foreground capitalize">{tx.type}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-xs font-bold text-primary">+৳{fmt(tx.commission)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AgentDashboard;
