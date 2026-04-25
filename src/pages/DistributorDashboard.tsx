import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Users, Wallet, TrendingUp, MapPin,
  Building2, Shield, BarChart3, Send, CheckCircle2, Clock,
  UserCheck, UserX, ChevronRight, DollarSign,
  Globe, Activity, Target, Zap, AlertTriangle, Eye, EyeOff,
  Bell, UserPlus, History, Headphones, ArrowRightLeft,
  Download, Search, X, ListChecks, Banknote, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { haptics } from "@/lib/haptics";
import SupportChat from "@/components/SupportChat";
import NotificationPreferences from "@/components/NotificationPreferences";
import ShareReceiptSheet, { ReceiptData } from "@/components/ShareReceiptSheet";
import TransactionHistory from "./TransactionHistory";
import { useUserSessionTimeout } from "@/hooks/use-user-session-timeout";

/* ─── Types ─── */
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

const statusColor: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  pending: "bg-accent/10 text-accent",
  suspended: "bg-destructive/10 text-destructive",
  terminated: "bg-muted text-muted-foreground",
};

const stagger = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] as const },
  }),
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const DistributorDashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useUserSessionTimeout("distributor");
  const { toast } = useToast();
  const { isDisabled } = useGlobalToggles();

  const [distInfo, setDistInfo] = useState<DistInfo | null>(null);
  const [balance, setBalance] = useState(0);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [isDist, setIsDist] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(false);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [txnCount, setTxnCount] = useState(0);

  // Sheets
  const [agentDetailSheet, setAgentDetailSheet] = useState<AgentRow | null>(null);
  const [floatSheet, setFloatSheet] = useState(false);
  const [selectedFloatAgent, setSelectedFloatAgent] = useState<AgentRow | null>(null);
  const [floatAmount, setFloatAmount] = useState("");
  const [floatProcessing, setFloatProcessing] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [subView, setSubView] = useState<"home" | "agents" | "territory" | "earnings" | "agentTxns" | "history">("home");
  const [settleSheet, setSettleSheet] = useState(false);
  const [settleAgent, setSettleAgent] = useState<AgentRow | null>(null);
  const [settleProcessing, setSettleProcessing] = useState(false);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const knownTxnIds = useRef(new Set<string>());
  const initialLoad = useRef(true);

  // Balance auto-hide
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleBalance = () => {
    setShowBalance(v => {
      if (!v) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowBalance(false), 5000);
      } else {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      }
      return !v;
    });
  };
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [roleRes, profileRes, distRes, txnRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "distributor"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("distributors").select("*").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    setIsDist((roleRes.data?.length ?? 0) > 0);
    setBalance(profileRes.data?.balance ?? 0);
    const txns = txnRes.data ?? [];
    setRecentTxns(txns);
    if (initialLoad.current) {
      txns.forEach((t: any) => knownTxnIds.current.add(t.id));
      initialLoad.current = false;
    }
    const today = new Date().toDateString();
    setTxnCount(txns.filter((t: any) => new Date(t.created_at).toDateString() === today).length);

    if (distRes.data) {
      setDistInfo(distRes.data as DistInfo);
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

  /* ── Realtime ── */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dist-txn-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, (payload) => {
        const newTxn = payload.new as any;
        if (!knownTxnIds.current.has(newTxn.id)) {
          knownTxnIds.current.add(newTxn.id);
          haptics.notify();
          setNotifications(prev => [{ id: newTxn.id, type: newTxn.type, amount: newTxn.amount, time: newTxn.created_at, phone: newTxn.recipient_phone, name: newTxn.recipient_name }, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
        loadData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, (payload) => {
        const newBal = parseFloat(String(payload.new.balance));
        if (!isNaN(newBal)) setBalance(newBal);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    const days: { label: string; volume: number; commission: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayLabel = d.toLocaleDateString("en-BD", { weekday: "short" });
      const dayTxns = recentTxns.filter(t => new Date(t.created_at).toDateString() === dateStr);
      days.push({
        label: dayLabel,
        volume: dayTxns.reduce((s, t) => s + t.amount, 0),
        commission: dayTxns.reduce((s, t) => s + (t.commission || 0), 0),
      });
    }
    return days;
  }, [recentTxns]);

  /* ── Agent status update ── */
  const updateAgentStatus = async (agentId: string, newStatus: string) => {
    const { error } = await supabase.from("agents").update({ status: newStatus as any }).eq("id", agentId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Agent status → ${newStatus}` });
      setAgentDetailSheet(null);
      loadData();
    }
  };

  /* ── Float distribution ── */
  const distributeFloat = async () => {
    if (!selectedFloatAgent || floatProcessing) return;
    setFloatProcessing(true);
    try {
      const agentProfile = await supabase.from("profiles").select("phone").eq("user_id", selectedFloatAgent.user_id).single();
      if (!agentProfile.data) throw new Error("Agent profile not found");
      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: agentProfile.data.phone,
        p_amount: Number(floatAmount),
        p_fee: 0,
        p_type: "send" as any,
        p_description: `Float distribution to ${selectedFloatAgent.business_name}`,
        p_reference: `FD-${Date.now()}`,
      });
      if (error) throw error;
      toast({ title: "Float Distributed", description: `৳${fmt(Number(floatAmount))} sent to ${selectedFloatAgent.business_name}` });
      setSelectedFloatAgent(null);
      setFloatAmount("");
      setFloatSheet(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setFloatProcessing(false);
    }
  };

  /* ── Commission Settlement ── */
  const settleCommission = async () => {
    if (!settleAgent || settleProcessing) return;
    setSettleProcessing(true);
    try {
      const agentProfile = await supabase.from("profiles").select("phone").eq("user_id", settleAgent.user_id).single();
      if (!agentProfile.data) throw new Error("Agent profile not found");
      const amount = settleAgent.commission_earned;
      if (amount <= 0) throw new Error("No commission to settle");
      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: agentProfile.data.phone,
        p_amount: amount,
        p_fee: 0,
        p_type: "send" as any,
        p_description: `Commission settlement for ${settleAgent.business_name}`,
        p_reference: `CS-${Date.now()}`,
      });
      if (error) throw error;
      // Reset agent commission_earned after settlement
      await supabase.from("agents").update({ commission_earned: 0 }).eq("id", settleAgent.id);
      toast({ title: "Settled", description: `৳${fmt(amount)} commission paid to ${settleAgent.business_name}` });
      setSettleAgent(null);
      setSettleSheet(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSettleProcessing(false);
    }
  };
  /* ── Auth guard ── */
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
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

  const activeAgents = agents.filter(a => a.status === "active").length;
  const pendingAgents = agents.filter(a => a.status === "pending").length;
  const totalCustomers = agents.reduce((s, a) => s + a.customers_onboarded, 0);
  const totalCommission = agents.reduce((s, a) => s + a.commission_earned, 0);
  const floatPct = Math.min(100, (balance / (distInfo?.max_float ?? 10000000)) * 100);
  const todayTxns = recentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayVolume = todayTxns.reduce((s, t) => s + t.amount, 0);

  const quickActions = [
    { icon: UserPlus, label: "Create Agent", bg: "rgba(156,39,176,0.12)", ring: "1px solid rgba(156,39,176,0.25)", path: "/distributor/create-agent", toggleKey: "distributor_create_agent" },
    { icon: Send, label: "Float Send", bg: "rgba(33,150,243,0.12)", ring: "1px solid rgba(33,150,243,0.25)", action: "float" as const, toggleKey: "distributor_float_send" },
    { icon: Users, label: "Agents", bg: "rgba(76,175,80,0.12)", ring: "1px solid rgba(76,175,80,0.25)", action: "agents" as const, toggleKey: "distributor_agents" },
    { icon: ListChecks, label: "Agent Txns", bg: "rgba(103,58,183,0.12)", ring: "1px solid rgba(103,58,183,0.25)", action: "agentTxns" as const, toggleKey: "distributor_agent_txns" },
    { icon: Banknote, label: "Settle", bg: "rgba(0,150,136,0.12)", ring: "1px solid rgba(0,150,136,0.25)", action: "settle" as const, toggleKey: "distributor_settle" },
    { icon: TrendingUp, label: "Earnings", bg: "rgba(0,188,212,0.12)", ring: "1px solid rgba(0,188,212,0.25)", action: "earnings" as const, toggleKey: "distributor_earnings" },
    { icon: History, label: "History", bg: "rgba(255,193,7,0.12)", ring: "1px solid rgba(255,193,7,0.25)", action: "history" as const, toggleKey: "distributor_history" },
    { icon: Headphones, label: "Support", bg: "rgba(120,120,140,0.12)", ring: "1px solid rgba(120,120,140,0.25)", action: "support" as const, toggleKey: "distributor_support" },
  ].filter(a => !a.toggleKey || !isDisabled(a.toggleKey));


  const handleQuickAction = (item: typeof quickActions[0]) => {
    if ("path" in item && item.path) {
      navigate(item.path);
    } else if ("action" in item) {
      if (item.action === "float") setFloatSheet(true);
      else if (item.action === "support") setSupportOpen(true);
      else if (item.action === "agents") setSubView("agents");
      else if (item.action === "earnings") setSubView("earnings");
      else if (item.action === "agentTxns") setSubView("agentTxns");
      else if (item.action === "settle") setSettleSheet(true);
      else if (item.action === "history") setSubView("history");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* ═══ Hero Header ═══ */}
      <header className="relative overflow-hidden">
        <div className="px-4 pt-5 pb-28" style={{ background: "linear-gradient(150deg, hsl(217 80% 50%) 0%, hsl(226 75% 40%) 60%, hsl(240 60% 30%) 100%)" }}>
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute top-32 -left-16 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative max-w-xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => subView !== "home" ? setSubView("home") : navigate("/")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => { setNotifOpen(true); setUnreadCount(0); }}
                  className="relative w-9 h-9 rounded-2xl glass-hero flex items-center justify-center text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                >
                  <Bell size={17} />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                <button onClick={loadData} className="tap-target text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                  <RefreshCw size={17} />
                </button>
              </div>
            </div>

            {/* Identity */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl glass-hero flex items-center justify-center">
                <Globe size={22} className="text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-primary-foreground truncate">{distInfo?.business_name || "Distributor Hub"}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {distInfo?.territory?.slice(0, 3).map(t => (
                    <span key={t} className="text-[9px] bg-white/15 rounded-full px-2 py-0.5 text-primary-foreground">{t}</span>
                  ))}
                  <span className="text-[10px] text-primary-foreground/70">• {txnCount} txns today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Balance Card ═══ */}
      <div className="max-w-xl mx-auto px-4 -mt-20 relative z-10">
        <Card className="p-5 border-0 shadow-elevated bg-card rounded-2xl">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Float Balance</p>
              <motion.button onClick={toggleBalance} whileTap={{ scale: 0.97 }} className="flex items-center mt-1">
                <AnimatePresence mode="wait">
                  {showBalance ? (
                    <motion.div key="shown" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-baseline gap-1">
                      <span className="text-lg font-semibold text-muted-foreground">৳</span>
                      <span className="text-3xl font-extrabold text-foreground tracking-tight">{fmt(balance)}</span>
                      <EyeOff size={14} className="ml-2 text-muted-foreground/50" />
                    </motion.div>
                  ) : (
                    <motion.div key="hidden" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="glass-hero rounded-2xl px-4 py-2 flex items-center gap-2 bg-muted/60 border border-border/40">
                      <Eye size={14} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">Tap to see balance</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className={`text-[9px] font-bold ${floatPct > 50 ? "text-primary border-primary/30" : floatPct > 20 ? "text-accent border-accent/30" : "text-destructive border-destructive/30"}`}>
                {floatPct > 50 ? "Healthy" : floatPct > 20 ? "Low" : "Critical"}
              </Badge>
              <p className="text-[10px] text-muted-foreground">Max ৳{fmt(distInfo?.max_float ?? 10000000)}</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${floatPct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded-full" style={{ background: "var(--gradient-addmoney)" }} />
          </div>
        </Card>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-5 space-y-5">
        <AnimatePresence mode="wait">
          {subView === "home" && (
            <motion.div key="home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {/* ═══ Quick Actions Grid 4×2 ═══ */}
              <div className="bg-card rounded-3xl shadow-card border border-border/60 p-4 mb-5">
                <div className="grid grid-cols-4 gap-y-5 gap-x-2">
                  {quickActions.map((item, i) => (
                    <motion.button
                      key={item.label}
                      custom={i}
                      initial="hidden"
                      animate="visible"
                      variants={stagger}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleQuickAction(item)}
                      className="flex flex-col items-center gap-1.5 press-effect"
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: item.bg, boxShadow: item.ring }}>
                        <item.icon size={20} className="text-foreground" />
                      </div>
                      <span className="text-[10px] font-semibold text-foreground/80 leading-tight text-center">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* ═══ Stats Grid ═══ */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: "Active Agents", value: activeAgents.toString(), icon: UserCheck, gradient: "gradient-cashout" },
                  { label: "Pending", value: pendingAgents.toString(), icon: Clock, gradient: "gradient-accent" },
                  { label: "Customers", value: totalCustomers.toString(), icon: Users, gradient: "gradient-addmoney" },
                  { label: "Network Earned", value: `৳${fmt(totalCommission)}`, icon: DollarSign, gradient: "gradient-send" },
                ].map((s, i) => (
                  <motion.div key={s.label} custom={i + 8} initial="hidden" animate="visible" variants={stagger}>
                    <Card className="p-3 border-0 shadow-card">
                      <div className={`w-8 h-8 rounded-lg ${s.gradient} flex items-center justify-center mb-2`}>
                        <s.icon size={16} className="text-primary-foreground" />
                      </div>
                      <p className="text-lg font-bold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* ═══ 7-Day Volume Chart ═══ */}
              <Card className="p-4 border-0 shadow-card mb-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" /> 7-Day Volume
                </h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="distVolGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(217,80%,50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(217,80%,50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220,12%,48%)" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                        formatter={(v: number) => [`৳${fmt(v)}`, "Volume"]}
                      />
                      <Area type="monotone" dataKey="volume" stroke="hsl(217,80%,50%)" strokeWidth={2} fill="url(#distVolGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* ═══ Network Health ═══ */}
              <Card className="p-4 border-0 shadow-card mb-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Activity size={14} className="text-accent" /> Network Health
                </h3>
                <div className="space-y-2">
                  {pendingAgents > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-accent/5 border border-accent/20">
                      <AlertTriangle size={14} className="text-accent shrink-0" />
                      <p className="text-xs text-foreground">{pendingAgents} agent{pendingAgents > 1 ? "s" : ""} pending approval</p>
                      <Button size="sm" variant="ghost" className="ml-auto h-6 text-[10px] text-accent" onClick={() => setSubView("agents")}>Review</Button>
                    </div>
                  )}
                  {agents.filter(a => a.status === "suspended").length > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/5 border border-destructive/20">
                      <UserX size={14} className="text-destructive shrink-0" />
                      <p className="text-xs text-foreground">{agents.filter(a => a.status === "suspended").length} suspended</p>
                    </div>
                  )}
                  {agents.length > 0 && pendingAgents === 0 && agents.filter(a => a.status === "suspended").length === 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                      <CheckCircle2 size={14} className="text-primary" />
                      <p className="text-xs text-foreground">All agents operational</p>
                    </div>
                  )}
                  {agents.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No agents in network</p>}
                </div>
              </Card>

              {/* ═══ Top Agents ═══ */}
              <Card className="p-4 border-0 shadow-card">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Target size={14} className="text-primary" /> Top Performing Agents
                </h3>
                {agents.length === 0 ? (
                  <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                      <Users className="w-7 h-7 text-muted-foreground" />
                    </motion.div>
                    <p className="text-sm font-semibold text-foreground">No agents yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Your top performers will appear here</p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {[...agents].sort((a, b) => b.commission_earned - a.commission_earned).slice(0, 5).map((ag, i) => (
                      <button key={ag.id} onClick={() => setAgentDetailSheet(ag)} className="w-full flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 press-effect text-left">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "gradient-accent text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{ag.business_name || "Agent"}</p>
                            <p className="text-[10px] text-muted-foreground">{ag.territory_code || "—"} · {ag.customers_onboarded} customers</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-primary">৳{fmt(ag.commission_earned)}</p>
                          <ChevronRight size={12} className="text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* ═══ Agents Sub-View ═══ */}
          {subView === "agents" && (
            <motion.div key="agents" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <AgentsGridView agents={agents} onAgentClick={setAgentDetailSheet} onStatusChange={updateAgentStatus} onCreateAgent={() => navigate("/distributor/create-agent")} />
            </motion.div>
          )}

          {/* ═══ Territory Sub-View ═══ */}
          {subView === "territory" && (
            <motion.div key="territory" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <TerritoryView distInfo={distInfo} agents={agents} />
            </motion.div>
          )}

          {/* ═══ Agent Txns Sub-View ═══ */}
          {subView === "agentTxns" && (
            <motion.div key="agentTxns" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <AgentTxnsView agents={agents} />
            </motion.div>
          )}

          {/* ═══ History Sub-View ═══ */}
          {subView === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <TransactionHistory filterTypes={["send", "receive", "addmoney"]} customLabels={{ addmoney: "Distributor" }} />
            </motion.div>
          )}

          {/* ═══ Earnings Sub-View ═══ */}
          {subView === "earnings" && (
            <motion.div key="earnings" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <EarningsView distInfo={distInfo} agents={agents} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Agent Detail Sheet ═══ */}
      <Sheet open={!!agentDetailSheet} onOpenChange={() => setAgentDetailSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto pb-8">
          {agentDetailSheet && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">{agentDetailSheet.business_name || "Agent Details"}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <Building2 size={20} className="text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{agentDetailSheet.business_name || "Unnamed Agent"}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${statusColor[agentDetailSheet.status]}`}>{agentDetailSheet.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{agentDetailSheet.territory_code || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Customers", value: agentDetailSheet.customers_onboarded },
                    { label: "Commission", value: `৳${fmt(agentDetailSheet.commission_earned)}` },
                    { label: "Max Float", value: `৳${fmt(agentDetailSheet.max_float)}` },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-muted/50 text-center">
                      <p className="text-sm font-bold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground">Joined {new Date(agentDetailSheet.created_at).toLocaleDateString()}</p>

                <div className="flex gap-2">
                  {agentDetailSheet.status === "pending" && (
                    <>
                      <Button onClick={() => updateAgentStatus(agentDetailSheet.id, "active")} className="flex-1 gradient-primary text-primary-foreground"><UserCheck size={14} className="mr-1" />Approve</Button>
                      <Button variant="destructive" onClick={() => updateAgentStatus(agentDetailSheet.id, "suspended")} className="flex-1"><UserX size={14} className="mr-1" />Reject</Button>
                    </>
                  )}
                  {agentDetailSheet.status === "active" && (
                    <>
                      <Button variant="outline" onClick={() => updateAgentStatus(agentDetailSheet.id, "suspended")} className="flex-1">Suspend</Button>
                      <Button onClick={() => { setSelectedFloatAgent(agentDetailSheet); setAgentDetailSheet(null); setFloatSheet(true); }} className="flex-1 gradient-addmoney text-primary-foreground"><Send size={14} className="mr-1" />Send Float</Button>
                    </>
                  )}
                  {agentDetailSheet.status === "suspended" && (
                    <Button onClick={() => updateAgentStatus(agentDetailSheet.id, "active")} className="flex-1 gradient-primary text-primary-foreground">Reactivate</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ Float Distribution Sheet ═══ */}
      <Sheet open={floatSheet} onOpenChange={setFloatSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-base">Distribute Float</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {selectedFloatAgent ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{selectedFloatAgent.business_name || "Agent"}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedFloatAgent.territory_code || "—"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFloatAgent(null)} className="h-7 text-[10px]">Change</Button>
                </div>
                <div>
                  <Label className="text-xs">Amount (৳)</Label>
                  <Input type="text" inputMode="numeric" placeholder="Enter float amount" value={floatAmount} onChange={e => setFloatAmount(e.target.value.replace(/\D/g, ""))} className="mt-1 rounded-xl h-11" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[10000, 25000, 50000, 100000].map(a => (
                    <button key={a} onClick={() => setFloatAmount(String(a))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground press-effect">৳{fmt(a)}</button>
                  ))}
                </div>
                <Button onClick={distributeFloat} disabled={!floatAmount || Number(floatAmount) < 1000 || floatProcessing} className="w-full gradient-addmoney text-primary-foreground rounded-xl h-11">
                  {floatProcessing ? "Sending…" : `Send ৳${floatAmount ? fmt(Number(floatAmount)) : "0"}`}
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                {agents.filter(a => a.status === "active").length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No active agents to distribute float to</p>
                ) : (
                  agents.filter(a => a.status === "active").map(ag => (
                    <button key={ag.id} onClick={() => setSelectedFloatAgent(ag)} className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 press-effect">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                          <Building2 size={14} className="text-primary-foreground" />
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
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Notifications Sheet ═══ */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="w-80 overflow-y-auto">
          <SheetHeader><SheetTitle className="text-sm">Notifications</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No notifications yet</p>
            ) : (
              notifications.slice(0, 20).map(n => (
                <div key={n.id} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs font-semibold text-foreground capitalize">{n.type} — ৳{fmt(n.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{n.name || n.phone || "—"} · {new Date(n.time).toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>
          <div className="mt-5 pt-4 border-t border-border/40">
            <NotificationPreferences scope="distributor" />
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Support Sheet ═══ */}
      <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[80vh]">
          <SheetHeader><SheetTitle className="text-sm">Support</SheetTitle></SheetHeader>
          <div className="mt-4 h-full">{user && <SupportChat userId={user.id} />}</div>
        </SheetContent>
      </Sheet>

      {/* ═══ Commission Settlement Sheet ═══ */}
      <Sheet open={settleSheet} onOpenChange={v => { setSettleSheet(v); if (!v) setSettleAgent(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8 max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base flex items-center gap-2"><Banknote size={16} className="text-primary" /> Commission Settlement</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {settleAgent ? (
              <>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                      <Building2 size={18} className="text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{settleAgent.business_name || "Agent"}</p>
                      <p className="text-[10px] text-muted-foreground">{settleAgent.territory_code || "—"}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSettleAgent(null)} className="h-7 text-[10px]">Change</Button>
                  </div>
                </div>

                <Card className="p-4 border-0 shadow-card">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Accumulated Commission</p>
                  <p className="text-2xl font-extrabold text-foreground">৳{fmt(settleAgent.commission_earned)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">This amount will be transferred to the agent's wallet and their commission counter will be reset to zero.</p>
                </Card>

                <Button
                  onClick={settleCommission}
                  disabled={settleAgent.commission_earned <= 0 || settleProcessing}
                  className="w-full gradient-primary text-primary-foreground rounded-xl h-11"
                >
                  {settleProcessing ? "Processing…" : `Settle ৳${fmt(settleAgent.commission_earned)}`}
                </Button>

                {settleAgent.commission_earned <= 0 && (
                  <p className="text-xs text-muted-foreground text-center">No pending commission to settle</p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Select an agent to settle commission:</p>
                {agents.filter(a => a.commission_earned > 0).length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 size={28} className="text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">All commissions are settled!</p>
                  </div>
                ) : (
                  agents.filter(a => a.commission_earned > 0).sort((a, b) => b.commission_earned - a.commission_earned).map(ag => (
                    <button key={ag.id} onClick={() => setSettleAgent(ag)} className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 press-effect">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                          <Building2 size={14} className="text-primary-foreground" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-foreground">{ag.business_name || "Agent"}</p>
                          <p className="text-[9px] text-muted-foreground">{ag.territory_code || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-primary">৳{fmt(ag.commission_earned)}</p>
                        <ChevronRight size={12} className="text-muted-foreground" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Agents Grid View ── */
const AgentsGridView = ({ agents, onAgentClick, onStatusChange, onCreateAgent }: {
  agents: AgentRow[];
  onAgentClick: (a: AgentRow) => void;
  onStatusChange: (id: string, status: string) => void;
  onCreateAgent: () => void;
}) => {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const [search, setSearch] = useState("");
  const filtered = (filter === "all" ? agents : agents.filter(a => a.status === filter))
    .filter(a => !search || (a.business_name || "").toLowerCase().includes(search.toLowerCase()) || (a.territory_code || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Header + Create */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Agent Network</h3>
        <Button size="sm" onClick={onCreateAgent} className="h-8 text-xs gap-1.5 gradient-primary text-primary-foreground rounded-xl">
          <UserPlus size={14} /> Create Agent
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10 text-xs" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {(["all", "active", "pending", "suspended"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all ${filter === f ? "gradient-addmoney text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"}`}>
            {f === "all" ? `All (${agents.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${agents.filter(a => a.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="p-8 border-0 shadow-card text-center">
          <Users size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No agents found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((ag, i) => (
            <motion.div key={ag.id} custom={i} initial="hidden" animate="visible" variants={stagger}>
              <Card className="p-3 border-0 shadow-card press-effect cursor-pointer" onClick={() => onAgentClick(ag)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-foreground truncate">{ag.business_name || "Agent"}</p>
                    <Badge className={`text-[8px] px-1.5 py-0 ${statusColor[ag.status]}`}>{ag.status}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="p-1.5 rounded-lg bg-muted/50 text-center">
                    <p className="text-[10px] font-bold text-foreground">{ag.customers_onboarded}</p>
                    <p className="text-[8px] text-muted-foreground">Customers</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-muted/50 text-center">
                    <p className="text-[10px] font-bold text-foreground">৳{fmt(ag.commission_earned)}</p>
                    <p className="text-[8px] text-muted-foreground">Earned</p>
                  </div>
                </div>
                <p className="text-[8px] text-muted-foreground mt-1.5 truncate">{ag.territory_code || "—"} · Since {new Date(ag.created_at).toLocaleDateString()}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Territory View ── */
const TerritoryView = ({ distInfo, agents }: { distInfo: DistInfo | null; agents: AgentRow[] }) => {
  const territories = distInfo?.territory ?? [];
  const agentsByTerritory = territories.map(t => ({
    name: t,
    agents: agents.filter(a => a.territory_code === t || a.territory_code?.startsWith(t.substring(0, 3).toUpperCase())),
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <MapPin size={14} className="text-primary" /> Territory Overview
      </h3>

      {/* Coverage stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 border-0 shadow-card text-center">
          <p className="text-lg font-bold text-foreground">{territories.length}</p>
          <p className="text-[9px] text-muted-foreground">Areas</p>
        </Card>
        <Card className="p-3 border-0 shadow-card text-center">
          <p className="text-lg font-bold text-foreground">{territories.length > 0 ? (agents.length / territories.length).toFixed(1) : 0}</p>
          <p className="text-[9px] text-muted-foreground">Avg Agents</p>
        </Card>
        <Card className="p-3 border-0 shadow-card text-center">
          <p className="text-lg font-bold text-foreground">{agents.reduce((s, a) => s + a.customers_onboarded, 0)}</p>
          <p className="text-[9px] text-muted-foreground">Total Reach</p>
        </Card>
      </div>

      {territories.length === 0 && (
        <Card className="p-6 border-0 shadow-card text-center">
          <MapPin size={28} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No territories assigned</p>
        </Card>
      )}

      {agentsByTerritory.map(t => (
        <Card key={t.name} className="p-4 border-0 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <MapPin size={12} className="text-primary" /> {t.name}
            </h4>
            <Badge variant="outline" className="text-[9px]">{t.agents.length} agents</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
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
        </Card>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Earnings View ── */
const EarningsView = ({ distInfo, agents }: { distInfo: DistInfo | null; agents: AgentRow[] }) => {
  const totalNetworkCommission = agents.reduce((s, a) => s + a.commission_earned, 0);
  const distRate = distInfo?.commission_rate ?? 0.002;
  const estimatedEarnings = totalNetworkCommission * distRate * 100;

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
                    <div className="h-full rounded-full transition-all" style={{ width: `${agPct}%`, background: "var(--gradient-addmoney)" }} />
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Agent Transactions View ── */
const AgentTxnsView = ({ agents }: { agents: AgentRow[] }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [search, setSearch] = useState("");

  const loadAgentTxns = useCallback(async (agentUserId: string) => {
    setLoadingTxns(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", agentUserId)
      .order("created_at", { ascending: false })
      .limit(50);
    setTxns(data ?? []);
    setLoadingTxns(false);
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    loadAgentTxns(selectedAgent.user_id);

    // Realtime subscription for selected agent's txns
    const channel = supabase
      .channel(`agent-txn-monitor-${selectedAgent.user_id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `user_id=eq.${selectedAgent.user_id}`,
      }, () => {
        loadAgentTxns(selectedAgent.user_id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedAgent, loadAgentTxns]);

  const txnColors: Record<string, string> = {
    send: "text-destructive",
    cashout: "text-destructive",
    cashin: "text-primary",
    receive: "text-primary",
    payment: "text-destructive",
    recharge: "text-destructive",
    paybill: "text-destructive",
    addmoney: "text-primary",
    banktransfer: "text-destructive",
    chargeback: "text-destructive",
  };

  const filteredTxns = txns.filter(t =>
    !search ||
    (t.recipient_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.recipient_phone || "").includes(search) ||
    (t.short_id || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.type || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <ListChecks size={14} className="text-primary" /> Agent Transaction Monitor
      </h3>

      {!selectedAgent ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Select an agent to monitor transactions:</p>
          {agents.length === 0 ? (
            <Card className="p-8 border-0 shadow-card text-center">
              <Users size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No agents in your network</p>
            </Card>
          ) : (
            agents.map(ag => (
              <button key={ag.id} onClick={() => setSelectedAgent(ag)} className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 press-effect">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                    <Building2 size={14} className="text-primary-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground">{ag.business_name || "Agent"}</p>
                    <Badge className={`text-[8px] px-1.5 py-0 ${statusColor[ag.status]}`}>{ag.status}</Badge>
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Agent header */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Building2 size={14} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{selectedAgent.business_name || "Agent"}</p>
                <p className="text-[9px] text-muted-foreground">{selectedAgent.territory_code || "—"} · {txns.length} txns loaded</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => loadAgentTxns(selectedAgent.user_id)}>
                <RefreshCw size={12} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedAgent(null); setTxns([]); }} className="h-7 text-[10px]">Back</Button>
            </div>
          </div>

          {/* Realtime badge */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Live monitoring</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, phone, ID, type..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-9 text-xs" />
          </div>

          {/* Transaction list */}
          {loadingTxns ? (
            <div className="flex justify-center py-8">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredTxns.length === 0 ? (
            <Card className="p-6 border-0 shadow-card text-center">
              <FileText size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{search ? "No matching transactions" : "No transactions yet"}</p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {filteredTxns.map(t => (
                <Card key={t.id} className="p-3 border-0 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[8px] capitalize">{t.type}</Badge>
                        <span className="text-[9px] text-muted-foreground font-mono">{t.short_id}</span>
                        <Badge variant="outline" className={`text-[8px] ${t.status === "completed" ? "text-primary border-primary/30" : t.status === "reversed" ? "text-destructive border-destructive/30" : "text-accent border-accent/30"}`}>{t.status}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {t.recipient_name || t.recipient_phone || t.description || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-sm font-bold ${txnColors[t.type] || "text-foreground"}`}>
                        {["receive", "cashin", "addmoney"].includes(t.type) ? "+" : "−"}৳{fmt(t.amount)}
                      </p>
                      {t.commission > 0 && <p className="text-[9px] text-primary">+৳{fmt(t.commission)} comm</p>}
                      <p className="text-[9px] text-muted-foreground">{new Date(t.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DistributorDashboard;
