import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Users, Wallet, TrendingUp, MapPin,
  Building2, Shield, BarChart3, Send, CheckCircle2, Clock,
  UserCheck, UserX, ChevronRight, ArrowUpDown, DollarSign,
  Globe, Activity, Target, Zap, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

/* ─── Types ─── */
type DistTab = "overview" | "agents" | "float" | "territory" | "earnings";

interface DistInfo {
  id: string;
  business_name: string;
  commission_rate: number;
  max_float: number;
  status: string;
  territory: string[] | null;
}

interface AgentRow {
  id: string;
  user_id: string;
  business_name: string | null;
  status: string;
  commission_earned: number;
  max_float: number;
  customers_onboarded: number;
  territory_code: string | null;
  created_at: string;
}

/* ─── Helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const tabItems: { id: DistTab; icon: typeof Users; label: string }[] = [
  { id: "overview",  icon: BarChart3,  label: "Overview" },
  { id: "agents",    icon: Users,      label: "Agents" },
  { id: "float",     icon: Wallet,     label: "Float" },
  { id: "territory", icon: MapPin,     label: "Territory" },
  { id: "earnings",  icon: TrendingUp, label: "Earnings" },
];

const statusColor: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  pending: "bg-accent/10 text-accent",
  suspended: "bg-destructive/10 text-destructive",
  terminated: "bg-muted text-muted-foreground",
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const DistributorDashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<DistTab>("overview");
  const [distInfo, setDistInfo] = useState<DistInfo | null>(null);
  const [balance, setBalance] = useState(0);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [isDist, setIsDist] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [roleRes, profileRes, distRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "distributor"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("distributors").select("*").eq("user_id", user.id).single(),
    ]);

    setIsDist((roleRes.data?.length ?? 0) > 0);
    setBalance(profileRes.data?.balance ?? 0);

    if (distRes.data) {
      setDistInfo(distRes.data as DistInfo);
      // Load agents under this distributor
      const { data: agentData } = await supabase
        .from("agents")
        .select("*")
        .eq("distributor_id", distRes.data.id)
        .order("created_at", { ascending: false });
      setAgents((agentData ?? []) as AgentRow[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Auth guard ── */
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

  if (isDist === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Building2 size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Distributor Access Required</p>
        <p className="text-sm text-muted-foreground max-w-xs">You need a distributor role to access this dashboard.</p>
        <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft size={16} className="mr-2" />Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="relative overflow-hidden px-4 pt-6 pb-20" style={{ background: "linear-gradient(150deg, hsl(217 80% 50%) 0%, hsl(226 75% 40%) 60%, hsl(240 60% 30%) 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, hsl(0 0% 100% / 0.3) 0%, transparent 50%)" }} />
        <div className="relative max-w-xl mx-auto text-primary-foreground">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate("/")} className="tap-target"><ArrowLeft size={22} /></button>
            <h1 className="text-lg font-bold">Distributor Hub</h1>
            <button onClick={loadData} className="tap-target"><RefreshCw size={18} /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl gradient-glass flex items-center justify-center">
              <Globe size={22} />
            </div>
            <div>
              <p className="font-bold text-base">{distInfo?.business_name || "Distributor"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {distInfo?.territory?.map(t => (
                  <span key={t} className="text-[9px] bg-white/20 rounded-full px-2 py-0.5">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Stats strip (overlapping) ── */}
      <div className="max-w-xl mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Float", value: `৳${fmt(balance)}`, icon: Wallet },
            { label: "Agents", value: agents.length.toString(), icon: Users },
            { label: "Rate", value: `${(distInfo?.commission_rate ?? 0.002) * 100}%`, icon: TrendingUp },
          ].map(s => (
            <Card key={s.label} className="p-3 border-0 shadow-elevated text-center">
              <s.icon size={16} className="text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
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
                  active ? "gradient-addmoney text-primary-foreground shadow-glow" : "bg-card text-muted-foreground border border-border"
                }`}
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
            {activeTab === "overview"  && <OverviewTab agents={agents} balance={balance} distInfo={distInfo} />}
            {activeTab === "agents"    && <AgentsTab agents={agents} toast={toast} onRefresh={loadData} distId={distInfo?.id} />}
            {activeTab === "float"     && <FloatDistTab agents={agents} balance={balance} maxFloat={distInfo?.max_float ?? 10000000} toast={toast} onRefresh={loadData} />}
            {activeTab === "territory" && <TerritoryTab distInfo={distInfo} agents={agents} />}
            {activeTab === "earnings"  && <EarningsTab distInfo={distInfo} agents={agents} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Overview Tab ── */
const OverviewTab = ({ agents, balance, distInfo }: { agents: AgentRow[]; balance: number; distInfo: DistInfo | null }) => {
  const activeAgents = agents.filter(a => a.status === "active").length;
  const pendingAgents = agents.filter(a => a.status === "pending").length;
  const totalCustomers = agents.reduce((s, a) => s + a.customers_onboarded, 0);
  const totalCommission = agents.reduce((s, a) => s + a.commission_earned, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Active Agents", value: activeAgents.toString(), icon: UserCheck, color: "gradient-cashout" },
          { label: "Pending Approval", value: pendingAgents.toString(), icon: Clock, color: "gradient-accent" },
          { label: "Total Customers", value: totalCustomers.toString(), icon: Users, color: "gradient-addmoney" },
          { label: "Network Commission", value: `৳${fmt(totalCommission)}`, icon: DollarSign, color: "gradient-send" },
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

      {/* Top Performing Agents */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Target size={14} className="text-primary" /> Top Performing Agents
        </h3>
        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No agents in your network yet</p>
        ) : (
          <div className="space-y-2">
            {[...agents].sort((a, b) => b.commission_earned - a.commission_earned).slice(0, 5).map((ag, i) => (
              <div key={ag.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? "gradient-accent text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>{i + 1}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{ag.business_name || "Agent"}</p>
                    <p className="text-[10px] text-muted-foreground">{ag.territory_code || "—"} · {ag.customers_onboarded} customers</p>
                  </div>
                </div>
                <p className="text-xs font-bold text-primary">৳{fmt(ag.commission_earned)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Performance Alerts */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity size={14} className="text-accent" /> Network Health
        </h3>
        <div className="space-y-2">
          {agents.filter(a => a.status === "pending").length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/5 border border-accent/20">
              <AlertTriangle size={14} className="text-accent" />
              <p className="text-xs text-foreground">{agents.filter(a => a.status === "pending").length} agents pending approval</p>
            </div>
          )}
          {agents.filter(a => a.status === "suspended").length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
              <UserX size={14} className="text-destructive" />
              <p className="text-xs text-foreground">{agents.filter(a => a.status === "suspended").length} agents suspended</p>
            </div>
          )}
          {agents.length > 0 && agents.filter(a => a.status === "pending").length === 0 && agents.filter(a => a.status === "suspended").length === 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 size={14} className="text-primary" />
              <p className="text-xs text-foreground">All agents operational</p>
            </div>
          )}
          {agents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No agents to monitor</p>
          )}
        </div>
      </Card>
    </div>
  );
};

/* ── Agents Tab ── */
const AgentsTab = ({ agents, toast, onRefresh, distId }: { agents: AgentRow[]; toast: any; onRefresh: () => void; distId?: string }) => {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const filtered = filter === "all" ? agents : agents.filter(a => a.status === filter);

  const updateAgentStatus = async (agentId: string, newStatus: string) => {
    const { error } = await supabase.from("agents").update({ status: newStatus as any }).eq("id", agentId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Agent status changed to ${newStatus}` });
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-0 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Agent Network</h3>
          <Badge variant="secondary" className="text-[10px]">{agents.length} total</Badge>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
          {(["all", "active", "pending", "suspended"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {f === "all" ? `All (${agents.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${agents.filter(a => a.status === f).length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No agents found</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(ag => (
              <div key={ag.id} className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                      <Building2 size={14} className="text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{ag.business_name || "Unnamed Agent"}</p>
                      <p className="text-[9px] text-muted-foreground">{ag.territory_code || "—"} · Since {new Date(ag.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge className={`text-[9px] ${statusColor[ag.status] || "bg-muted text-muted-foreground"}`}>{ag.status}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-1.5 rounded-lg bg-background">
                    <p className="text-[9px] text-muted-foreground">Customers</p>
                    <p className="text-xs font-bold text-foreground">{ag.customers_onboarded}</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-background">
                    <p className="text-[9px] text-muted-foreground">Commission</p>
                    <p className="text-xs font-bold text-foreground">৳{fmt(ag.commission_earned)}</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-background">
                    <p className="text-[9px] text-muted-foreground">Max Float</p>
                    <p className="text-xs font-bold text-foreground">৳{fmt(ag.max_float)}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {ag.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => updateAgentStatus(ag.id, "active")} className="flex-1 h-7 text-[10px] gradient-primary text-primary-foreground">
                        <UserCheck size={12} className="mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => updateAgentStatus(ag.id, "suspended")} className="flex-1 h-7 text-[10px]">
                        <UserX size={12} className="mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {ag.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => updateAgentStatus(ag.id, "suspended")} className="flex-1 h-7 text-[10px]">
                      Suspend
                    </Button>
                  )}
                  {ag.status === "suspended" && (
                    <Button size="sm" onClick={() => updateAgentStatus(ag.id, "active")} className="flex-1 h-7 text-[10px] gradient-primary text-primary-foreground">
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── Float Distribution Tab ── */
const FloatDistTab = ({ agents, balance, maxFloat, toast, onRefresh }: { agents: AgentRow[]; balance: number; maxFloat: number; toast: any; onRefresh: () => void }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const pct = Math.min(100, (balance / maxFloat) * 100);

  const distributeFloat = async () => {
    if (!selectedAgent || processing) return;
    setProcessing(true);
    try {
      // Transfer float to agent via transfer_money RPC
      const agentProfile = await supabase.from("profiles").select("phone").eq("user_id", selectedAgent.user_id).single();
      if (!agentProfile.data) throw new Error("Agent profile not found");

      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: agentProfile.data.phone,
        p_amount: Number(amount),
        p_fee: 0,
        p_type: "send" as any,
        p_description: `Float distribution to ${selectedAgent.business_name}`,
        p_reference: `FD-${Date.now()}`,
      });
      if (error) throw error;
      toast({ title: "Float Distributed", description: `৳${amount} sent to ${selectedAgent.business_name}` });
      setSelectedAgent(null);
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
      {/* Current float status */}
      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Your Float Pool</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Available</span>
          <span className="text-xl font-bold text-foreground">৳{fmt(balance)}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Max: ৳{fmt(maxFloat)}</span>
          <span className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% utilized</span>
        </div>
      </Card>

      {/* Distribute float */}
      <Card className="p-5 border-0 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Send size={14} className="text-primary" /> Distribute Float
        </h3>

        {selectedAgent ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div>
                <p className="text-xs font-semibold text-foreground">{selectedAgent.business_name || "Agent"}</p>
                <p className="text-[10px] text-muted-foreground">{selectedAgent.territory_code || "—"}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)} className="h-7 text-[10px]">Change</Button>
            </div>
            <div>
              <Label className="text-xs">Amount (৳)</Label>
              <Input type="text" inputMode="numeric" placeholder="Enter float amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[10000, 25000, 50000, 100000].map(a => (
                <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground press-effect">৳{fmt(a)}</button>
              ))}
            </div>
            <Button onClick={distributeFloat} disabled={!amount || Number(amount) < 1000 || processing} className="w-full gradient-addmoney text-primary-foreground">
              {processing ? "Sending…" : `Send ৳${amount ? fmt(Number(amount)) : "0"}`}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.filter(a => a.status === "active").length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No active agents to distribute float to</p>
            ) : (
              agents.filter(a => a.status === "active").map(ag => (
                <button
                  key={ag.id}
                  onClick={() => setSelectedAgent(ag)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 press-effect"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                      <Building2 size={12} className="text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">{ag.business_name || "Agent"}</p>
                      <p className="text-[9px] text-muted-foreground">Max: ৳{fmt(ag.max_float)}</p>
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

/* ── Territory Tab ── */
const TerritoryTab = ({ distInfo, agents }: { distInfo: DistInfo | null; agents: AgentRow[] }) => {
  const territories = distInfo?.territory ?? [];
  const agentsByTerritory = territories.map(t => ({
    name: t,
    agents: agents.filter(a => a.territory_code === t || a.territory_code?.startsWith(t.substring(0, 3).toUpperCase())),
  }));

  return (
    <div className="space-y-4">
      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MapPin size={14} className="text-primary" /> Assigned Territories
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {territories.map(t => (
            <Badge key={t} variant="secondary" className="text-xs px-3 py-1">
              <MapPin size={10} className="mr-1" /> {t}
            </Badge>
          ))}
          {territories.length === 0 && <p className="text-xs text-muted-foreground">No territories assigned</p>}
        </div>
      </Card>

      {/* Territory breakdown */}
      {agentsByTerritory.map(t => (
        <Card key={t.name} className="p-4 border-0 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <MapPin size={12} className="text-primary" /> {t.name}
            </h4>
            <Badge variant="outline" className="text-[9px]">{t.agents.length} agents</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-2 rounded-lg bg-primary/5 text-center">
              <p className="text-sm font-bold text-foreground">{t.agents.filter(a => a.status === "active").length}</p>
              <p className="text-[9px] text-muted-foreground">Active</p>
            </div>
            <div className="p-2 rounded-lg bg-accent/5 text-center">
              <p className="text-sm font-bold text-foreground">{t.agents.reduce((s, a) => s + a.customers_onboarded, 0)}</p>
              <p className="text-[9px] text-muted-foreground">Customers</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-sm font-bold text-foreground">৳{fmt(t.agents.reduce((s, a) => s + a.commission_earned, 0))}</p>
              <p className="text-[9px] text-muted-foreground">Earned</p>
            </div>
          </div>

          {t.agents.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2">No agents in this territory</p>
          )}
        </Card>
      ))}

      {/* Coverage stats */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Zap size={14} className="text-accent" /> Coverage Metrics
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Territory Coverage</span>
            <span className="text-xs font-bold text-foreground">{territories.length} areas</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Avg Agents/Territory</span>
            <span className="text-xs font-bold text-foreground">{territories.length > 0 ? (agents.length / territories.length).toFixed(1) : 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Network Reach</span>
            <span className="text-xs font-bold text-foreground">{agents.reduce((s, a) => s + a.customers_onboarded, 0)} customers</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

/* ── Earnings Tab ── */
const EarningsTab = ({ distInfo, agents }: { distInfo: DistInfo | null; agents: AgentRow[] }) => {
  const totalNetworkCommission = agents.reduce((s, a) => s + a.commission_earned, 0);
  const distRate = distInfo?.commission_rate ?? 0.002;
  const estimatedEarnings = totalNetworkCommission * distRate * 100; // rough estimate

  return (
    <div className="space-y-4">
      <Card className="p-5 border-0 shadow-card" style={{ background: "linear-gradient(150deg, hsl(217 80% 50%) 0%, hsl(226 75% 40%) 100%)" }}>
        <p className="text-xs text-primary-foreground/80 font-medium">Estimated Earnings</p>
        <p className="text-3xl font-bold text-primary-foreground mt-1">৳{fmt(Math.round(estimatedEarnings))}</p>
        <p className="text-[10px] text-primary-foreground/70 mt-1">Commission Rate: {(distRate * 100).toFixed(2)}%</p>
      </Card>

      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Revenue Breakdown</h3>
        <div className="space-y-3">
          {[
            { source: "Cash Out Commission", share: "40%", amount: Math.round(estimatedEarnings * 0.4) },
            { source: "Cash In Commission", share: "25%", amount: Math.round(estimatedEarnings * 0.25) },
            { source: "Bill Pay Commission", share: "15%", amount: Math.round(estimatedEarnings * 0.15) },
            { source: "Agent Onboarding", share: "10%", amount: Math.round(estimatedEarnings * 0.1) },
            { source: "Other", share: "10%", amount: Math.round(estimatedEarnings * 0.1) },
          ].map(r => (
            <div key={r.source} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-xs font-semibold text-foreground">{r.source}</p>
                <p className="text-[10px] text-muted-foreground">{r.share} of total</p>
              </div>
              <p className="text-xs font-bold text-primary">৳{fmt(r.amount)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Agent Performance</h3>
        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No agents yet</p>
        ) : (
          <div className="space-y-2">
            {[...agents].sort((a, b) => b.commission_earned - a.commission_earned).map(ag => {
              const agPct = totalNetworkCommission > 0 ? (ag.commission_earned / totalNetworkCommission) * 100 : 0;
              return (
                <div key={ag.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-foreground">{ag.business_name || "Agent"}</p>
                    <p className="text-[10px] text-muted-foreground">৳{fmt(ag.commission_earned)}</p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full gradient-addmoney rounded-full transition-all" style={{ width: `${agPct}%` }} />
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

export default DistributorDashboard;
