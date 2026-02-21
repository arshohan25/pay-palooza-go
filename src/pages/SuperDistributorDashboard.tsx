import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Users, Wallet, TrendingUp, MapPin,
  Building2, Shield, BarChart3, Globe, Activity, Target,
  Zap, AlertTriangle, CheckCircle2, Clock, UserCheck, UserX,
  DollarSign, Layers, Network, PieChart, ArrowUpDown, Eye,
  ChevronRight, Send, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

/* ─── Types ─── */
type SDTab = "overview" | "distributors" | "agents" | "float" | "analytics" | "alerts";

interface DistRow {
  id: string;
  user_id: string;
  business_name: string;
  status: string;
  commission_rate: number;
  max_float: number;
  territory: string[] | null;
  created_at: string;
}

interface AgentRow {
  id: string;
  business_name: string | null;
  status: string;
  commission_earned: number;
  max_float: number;
  customers_onboarded: number;
  territory_code: string | null;
  distributor_id: string | null;
}

interface FraudRow {
  id: string;
  severity: string;
  status: string;
  rule_triggered: string;
  created_at: string;
}

/* ─── Helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const tabItems: { id: SDTab; icon: typeof Users; label: string }[] = [
  { id: "overview",     icon: BarChart3,     label: "Overview" },
  { id: "distributors", icon: Network,       label: "Distributors" },
  { id: "agents",       icon: Users,         label: "All Agents" },
  { id: "float",        icon: Wallet,        label: "Float Pool" },
  { id: "analytics",    icon: PieChart,      label: "Analytics" },
  { id: "alerts",       icon: AlertTriangle, label: "Alerts" },
];

const statusColor: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  pending: "bg-accent/10 text-accent",
  suspended: "bg-destructive/10 text-destructive",
  terminated: "bg-muted text-muted-foreground",
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const SuperDistributorDashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<SDTab>("overview");
  const [balance, setBalance] = useState(0);
  const [distributors, setDistributors] = useState<DistRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [alerts, setAlerts] = useState<FraudRow[]>([]);
  const [isSD, setIsSD] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [roleRes, profileRes, distRes, agentRes, alertRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_distributor"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("distributors").select("*").order("created_at", { ascending: false }),
      supabase.from("agents").select("*").order("created_at", { ascending: false }),
      supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    setIsSD((roleRes.data?.length ?? 0) > 0);
    setBalance(profileRes.data?.balance ?? 0);
    setDistributors((distRes.data ?? []) as DistRow[]);
    setAgents((agentRes.data ?? []) as AgentRow[]);
    setAlerts((alertRes.data ?? []) as FraudRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (authLoading || loading) {
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

  if (isSD === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Crown size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Super Distributor Access Required</p>
        <p className="text-sm text-muted-foreground max-w-xs">This dashboard is restricted to super distributors.</p>
        <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft size={16} className="mr-2" />Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="relative overflow-hidden px-4 pt-6 pb-20" style={{
        background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 50%, hsl(300 45% 22%) 100%)"
      }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 30%, hsl(0 0% 100% / 0.3) 0%, transparent 50%)" }} />
        <div className="relative max-w-xl mx-auto text-primary-foreground">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate("/")} className="tap-target"><ArrowLeft size={22} /></button>
            <div className="flex items-center gap-1.5">
              <Crown size={16} />
              <h1 className="text-lg font-bold">Super Distributor</h1>
            </div>
            <button onClick={loadData} className="tap-target"><RefreshCw size={18} /></button>
          </div>
          <p className="text-xs opacity-70">System-wide network oversight & management</p>
        </div>
      </header>

      {/* ── Stats strip ── */}
      <div className="max-w-xl mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Float", value: `৳${fmt(balance)}`, icon: Wallet },
            { label: "Distributors", value: distributors.length.toString(), icon: Network },
            { label: "Agents", value: agents.length.toString(), icon: Users },
            { label: "Alerts", value: alerts.filter(a => a.status === "open").length.toString(), icon: AlertTriangle },
          ].map(s => (
            <Card key={s.label} className="p-2.5 border-0 shadow-elevated text-center">
              <s.icon size={14} className="text-primary mx-auto mb-1" />
              <p className="text-xs font-bold text-foreground">{s.value}</p>
              <p className="text-[8px] text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
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
                  active ? "text-primary-foreground shadow-glow" : "bg-card text-muted-foreground border border-border"
                }`}
                style={active ? { background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" } : undefined}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-xl mx-auto px-4 py-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
            {activeTab === "overview"     && <SDOverview distributors={distributors} agents={agents} alerts={alerts} balance={balance} />}
            {activeTab === "distributors" && <DistributorsTab distributors={distributors} agents={agents} toast={toast} onRefresh={loadData} />}
            {activeTab === "agents"       && <AllAgentsTab agents={agents} distributors={distributors} />}
            {activeTab === "float"        && <FloatPoolTab distributors={distributors} balance={balance} toast={toast} onRefresh={loadData} />}
            {activeTab === "analytics"    && <AnalyticsTab distributors={distributors} agents={agents} alerts={alerts} />}
            {activeTab === "alerts"       && <AlertsTab alerts={alerts} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Overview ── */
const SDOverview = ({ distributors, agents, alerts, balance }: { distributors: DistRow[]; agents: AgentRow[]; alerts: FraudRow[]; balance: number }) => {
  const activeDist = distributors.filter(d => d.status === "active").length;
  const activeAgents = agents.filter(a => a.status === "active").length;
  const totalCustomers = agents.reduce((s, a) => s + a.customers_onboarded, 0);
  const totalCommission = agents.reduce((s, a) => s + a.commission_earned, 0);
  const openAlerts = alerts.filter(a => a.status === "open").length;
  const allTerritories = [...new Set(distributors.flatMap(d => d.territory ?? []))];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Active Distributors", value: activeDist.toString(), icon: Network, color: "gradient-payment" },
          { label: "Active Agents", value: activeAgents.toString(), icon: Users, color: "gradient-cashout" },
          { label: "Total Customers", value: fmt(totalCustomers), icon: Target, color: "gradient-addmoney" },
          { label: "Network Commission", value: `৳${fmt(totalCommission)}`, icon: DollarSign, color: "gradient-accent" },
        ].map(s => (
          <Card key={s.label} className="p-3 border-0 shadow-card">
            <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
              <s.icon size={16} className="text-primary-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Network Health */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity size={14} className="text-primary" /> Network Health
        </h3>
        <div className="space-y-2">
          {openAlerts > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle size={14} className="text-destructive" />
              <p className="text-xs text-foreground font-medium">{openAlerts} open fraud alert{openAlerts > 1 ? "s" : ""}</p>
            </div>
          )}
          {distributors.filter(d => d.status === "pending").length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/5 border border-accent/20">
              <Clock size={14} className="text-accent" />
              <p className="text-xs text-foreground font-medium">{distributors.filter(d => d.status === "pending").length} distributors awaiting approval</p>
            </div>
          )}
          {agents.filter(a => a.status === "pending").length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/5 border border-accent/20">
              <Users size={14} className="text-accent" />
              <p className="text-xs text-foreground font-medium">{agents.filter(a => a.status === "pending").length} agents pending approval</p>
            </div>
          )}
          {openAlerts === 0 && distributors.filter(d => d.status === "pending").length === 0 && agents.filter(a => a.status === "pending").length === 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 size={14} className="text-primary" />
              <p className="text-xs text-foreground font-medium">All systems operational</p>
            </div>
          )}
        </div>
      </Card>

      {/* Territory coverage */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MapPin size={14} className="text-primary" /> Territory Coverage
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {allTerritories.map(t => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
          {allTerritories.length === 0 && <p className="text-xs text-muted-foreground">No territories assigned</p>}
        </div>
      </Card>

      {/* Top Distributors */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Crown size={14} className="text-accent" /> Top Distributors
        </h3>
        {distributors.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No distributors in network</p>
        ) : (
          <div className="space-y-2">
            {distributors.slice(0, 5).map((d, i) => {
              const dAgents = agents.filter(a => a.distributor_id === d.id);
              return (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? "gradient-accent text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>{i + 1}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{d.business_name}</p>
                      <p className="text-[9px] text-muted-foreground">{dAgents.length} agents · {(d.territory ?? []).join(", ") || "—"}</p>
                    </div>
                  </div>
                  <Badge className={`text-[9px] ${statusColor[d.status]}`}>{d.status}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── Distributors Tab ── */
const DistributorsTab = ({ distributors, agents, toast, onRefresh }: { distributors: DistRow[]; agents: AgentRow[]; toast: any; onRefresh: () => void }) => {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const filtered = filter === "all" ? distributors : distributors.filter(d => d.status === filter);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("distributors").update({ status: status as any }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Updated", description: `Distributor status: ${status}` }); onRefresh(); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-0 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Distributor Network</h3>
          <Badge variant="secondary" className="text-[10px]">{distributors.length} total</Badge>
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
          {(["all", "active", "pending", "suspended"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {f === "all" ? `All (${distributors.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${distributors.filter(d => d.status === f).length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No distributors found</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(d => {
              const dAgents = agents.filter(a => a.distributor_id === d.id);
              return (
                <div key={d.id} className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg gradient-payment flex items-center justify-center">
                        <Network size={14} className="text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{d.business_name}</p>
                        <p className="text-[9px] text-muted-foreground">{(d.territory ?? []).join(", ") || "No territory"}</p>
                      </div>
                    </div>
                    <Badge className={`text-[9px] ${statusColor[d.status]}`}>{d.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-1.5 rounded-lg bg-background">
                      <p className="text-[9px] text-muted-foreground">Agents</p>
                      <p className="text-xs font-bold text-foreground">{dAgents.length}</p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-background">
                      <p className="text-[9px] text-muted-foreground">Rate</p>
                      <p className="text-xs font-bold text-foreground">{(d.commission_rate * 100).toFixed(2)}%</p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-background">
                      <p className="text-[9px] text-muted-foreground">Max Float</p>
                      <p className="text-xs font-bold text-foreground">৳{fmt(d.max_float)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {d.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(d.id, "active")} className="flex-1 h-7 text-[10px] gradient-primary text-primary-foreground">
                          <UserCheck size={12} className="mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(d.id, "suspended")} className="flex-1 h-7 text-[10px]">Reject</Button>
                      </>
                    )}
                    {d.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(d.id, "suspended")} className="flex-1 h-7 text-[10px]">Suspend</Button>
                    )}
                    {d.status === "suspended" && (
                      <Button size="sm" onClick={() => updateStatus(d.id, "active")} className="flex-1 h-7 text-[10px] gradient-primary text-primary-foreground">Reactivate</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── All Agents Tab ── */
const AllAgentsTab = ({ agents, distributors }: { agents: AgentRow[]; distributors: DistRow[] }) => {
  const getDistName = (distId: string | null) => {
    if (!distId) return "Unassigned";
    return distributors.find(d => d.id === distId)?.business_name ?? "Unknown";
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-0 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">All Agents (System-wide)</h3>
          <Badge variant="secondary" className="text-[10px]">{agents.length} total</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Active", count: agents.filter(a => a.status === "active").length, color: "text-primary" },
            { label: "Pending", count: agents.filter(a => a.status === "pending").length, color: "text-accent" },
            { label: "Suspended", count: agents.filter(a => a.status === "suspended").length, color: "text-destructive" },
          ].map(s => (
            <div key={s.label} className="p-2 rounded-lg bg-muted/50 text-center">
              <p className={`text-sm font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No agents in system</p>
        ) : (
          <div className="space-y-2">
            {agents.map(ag => (
              <div key={ag.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${ag.status === "active" ? "bg-primary" : ag.status === "pending" ? "bg-accent" : "bg-destructive"}`} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{ag.business_name || "Agent"}</p>
                    <p className="text-[9px] text-muted-foreground">{ag.territory_code || "—"} · {getDistName(ag.distributor_id)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-foreground">{ag.customers_onboarded} cust.</p>
                  <p className="text-[9px] text-primary">৳{fmt(ag.commission_earned)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── Float Pool Tab ── */
const FloatPoolTab = ({ distributors, balance, toast, onRefresh }: { distributors: DistRow[]; balance: number; toast: any; onRefresh: () => void }) => {
  const [selectedDist, setSelectedDist] = useState<DistRow | null>(null);
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const totalMaxFloat = distributors.reduce((s, d) => s + d.max_float, 0);

  const distributeFloat = async () => {
    if (!selectedDist || processing) return;
    setProcessing(true);
    try {
      const profile = await supabase.from("profiles").select("phone").eq("user_id", selectedDist.user_id).single();
      if (!profile.data) throw new Error("Distributor profile not found");
      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: profile.data.phone,
        p_amount: Number(amount),
        p_fee: 0,
        p_type: "send" as any,
        p_description: `Float allocation to ${selectedDist.business_name}`,
        p_reference: `SDF-${Date.now()}`,
      });
      if (error) throw error;
      toast({ title: "Float Allocated", description: `৳${fmt(Number(amount))} sent to ${selectedDist.business_name}` });
      setSelectedDist(null);
      setAmount("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Master Float Pool</h3>
        <p className="text-2xl font-bold text-foreground">৳{fmt(balance)}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Network max capacity: ৳{fmt(totalMaxFloat)}</p>
        <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, totalMaxFloat > 0 ? (balance / totalMaxFloat) * 100 : 0)}%`, background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }} />
        </div>
      </Card>

      <Card className="p-5 border-0 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Send size={14} className="text-primary" /> Allocate Float to Distributor
        </h3>

        {selectedDist ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div>
                <p className="text-xs font-semibold text-foreground">{selectedDist.business_name}</p>
                <p className="text-[10px] text-muted-foreground">Max: ৳{fmt(selectedDist.max_float)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDist(null)} className="h-7 text-[10px]">Change</Button>
            </div>
            <div>
              <Label className="text-xs">Amount (৳)</Label>
              <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[50000, 100000, 500000, 1000000].map(a => (
                <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground press-effect">৳{fmt(a)}</button>
              ))}
            </div>
            <Button onClick={distributeFloat} disabled={!amount || Number(amount) < 1000 || processing} className="w-full text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>
              {processing ? "Allocating…" : `Allocate ৳${amount ? fmt(Number(amount)) : "0"}`}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {distributors.filter(d => d.status === "active").length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No active distributors</p>
            ) : (
              distributors.filter(d => d.status === "active").map(d => (
                <button key={d.id} onClick={() => setSelectedDist(d)} className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 press-effect">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg gradient-payment flex items-center justify-center">
                      <Network size={12} className="text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">{d.business_name}</p>
                      <p className="text-[9px] text-muted-foreground">{(d.territory ?? []).join(", ")}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── Analytics Tab ── */
const AnalyticsTab = ({ distributors, agents, alerts }: { distributors: DistRow[]; agents: AgentRow[]; alerts: FraudRow[] }) => {
  const totalCustomers = agents.reduce((s, a) => s + a.customers_onboarded, 0);
  const totalCommission = agents.reduce((s, a) => s + a.commission_earned, 0);
  const avgAgentsPerDist = distributors.length > 0 ? (agents.length / distributors.length).toFixed(1) : "0";
  const allTerritories = [...new Set(distributors.flatMap(d => d.territory ?? []))];

  // Dist by agent count
  const distStats = distributors.map(d => ({
    name: d.business_name,
    agents: agents.filter(a => a.distributor_id === d.id).length,
    customers: agents.filter(a => a.distributor_id === d.id).reduce((s, a) => s + a.customers_onboarded, 0),
    commission: agents.filter(a => a.distributor_id === d.id).reduce((s, a) => s + a.commission_earned, 0),
  })).sort((a, b) => b.agents - a.agents);

  return (
    <div className="space-y-4">
      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 size={14} className="text-primary" /> System Metrics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Territories", value: allTerritories.length.toString() },
            { label: "Avg Agents/Dist", value: avgAgentsPerDist },
            { label: "Total Customers", value: fmt(totalCustomers) },
            { label: "Network Commission", value: `৳${fmt(totalCommission)}` },
            { label: "Open Alerts", value: alerts.filter(a => a.status === "open").length.toString() },
            { label: "Resolved Alerts", value: alerts.filter(a => a.status === "resolved").length.toString() },
          ].map(m => (
            <div key={m.label} className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-lg font-bold text-foreground">{m.value}</p>
              <p className="text-[9px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Distributor Performance</h3>
        {distStats.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No data</p>
        ) : (
          <div className="space-y-3">
            {distStats.map(d => {
              const maxAgents = Math.max(...distStats.map(x => x.agents), 1);
              return (
                <div key={d.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">{d.agents} agents · {d.customers} cust.</p>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(d.agents / maxAgents) * 100}%`, background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── Alerts Tab ── */
const AlertsTab = ({ alerts }: { alerts: FraudRow[] }) => {
  const severityIcon: Record<string, string> = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-0 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Fraud & Security Alerts</h3>
          <Badge variant="secondary" className="text-[10px]">{alerts.length} total</Badge>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {(["open", "investigating", "resolved", "false_positive"] as const).map(s => (
            <div key={s} className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-sm font-bold text-foreground">{alerts.filter(a => a.status === s).length}</p>
              <p className="text-[8px] text-muted-foreground capitalize">{s.replace("_", " ")}</p>
            </div>
          ))}
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 size={32} className="text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No alerts — system is clean</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{severityIcon[a.severity] || "⚪"}</span>
                    <p className="text-xs font-semibold text-foreground">{a.rule_triggered}</p>
                  </div>
                  <Badge className={`text-[8px] ${
                    a.status === "open" ? "bg-destructive/10 text-destructive" :
                    a.status === "investigating" ? "bg-accent/10 text-accent" :
                    "bg-primary/10 text-primary"
                  }`}>{a.status}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SuperDistributorDashboard;
