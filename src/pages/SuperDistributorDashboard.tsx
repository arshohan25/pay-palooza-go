import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Users, Wallet, TrendingUp, MapPin,
  Building2, Shield, BarChart3, Send, CheckCircle2, Clock,
  UserCheck, UserX, ChevronRight, DollarSign,
  Globe, Activity, Target, Zap, AlertTriangle, Eye, EyeOff,
  Bell, UserPlus, History, Headphones, Network, PieChart,
  Crown, Banknote, Search, X, ListChecks, FileBarChart, Download, FileText,
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
import TransactionHistory from "./TransactionHistory";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useUserSessionTimeout } from "@/hooks/use-user-session-timeout";

/* ─── Types ─── */
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
  user_id: string;
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
const SuperDistributorDashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useUserSessionTimeout("super_distributor");
  const { toast } = useToast();

  const [balance, setBalance] = useState(0);
  const [distributors, setDistributors] = useState<DistRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [alerts, setAlerts] = useState<FraudRow[]>([]);
  const [isSD, setIsSD] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(false);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [txnCount, setTxnCount] = useState(0);

  // Sub-views
  const [subView, setSubView] = useState<"home" | "distributors" | "agents" | "alerts" | "analytics" | "distTxns" | "settle" | "reconcile" | "history">("home");

  // Sheets
  const [distDetailSheet, setDistDetailSheet] = useState<DistRow | null>(null);
  const [floatSheet, setFloatSheet] = useState(false);
  const [selectedFloatDist, setSelectedFloatDist] = useState<DistRow | null>(null);
  const [floatAmount, setFloatAmount] = useState("");
  const [floatProcessing, setFloatProcessing] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

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

    const [roleRes, profileRes, distRes, agentRes, alertRes, txnRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_distributor"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("distributors").select("*").order("created_at", { ascending: false }),
      supabase.from("agents").select("*").order("created_at", { ascending: false }),
      supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    setIsSD((roleRes.data?.length ?? 0) > 0);
    setBalance(profileRes.data?.balance ?? 0);
    setDistributors((distRes.data ?? []) as DistRow[]);
    setAgents((agentRes.data ?? []) as AgentRow[]);
    setAlerts((alertRes.data ?? []) as FraudRow[]);

    const txns = txnRes.data ?? [];
    setRecentTxns(txns);
    if (initialLoad.current) {
      txns.forEach((t: any) => knownTxnIds.current.add(t.id));
      initialLoad.current = false;
    }
    const today = new Date().toDateString();
    setTxnCount(txns.filter((t: any) => new Date(t.created_at).toDateString() === today).length);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Realtime ── */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("sd-txn-realtime")
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
    const days: { label: string; volume: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayLabel = d.toLocaleDateString("en-BD", { weekday: "short" });
      const dayTxns = recentTxns.filter(t => new Date(t.created_at).toDateString() === dateStr);
      days.push({ label: dayLabel, volume: dayTxns.reduce((s, t) => s + t.amount, 0) });
    }
    return days;
  }, [recentTxns]);

  /* ── Distributor status update ── */
  const updateDistStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("distributors").update({ status: newStatus as any }).eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Distributor status → ${newStatus}` });
      setDistDetailSheet(null);
      loadData();
    }
  };

  /* ── Float distribution ── */
  const distributeFloat = async () => {
    if (!selectedFloatDist || floatProcessing) return;
    setFloatProcessing(true);
    try {
      const profile = await supabase.from("profiles").select("phone").eq("user_id", selectedFloatDist.user_id).single();
      if (!profile.data) throw new Error("Distributor profile not found");
      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: profile.data.phone,
        p_amount: Number(floatAmount),
        p_fee: 0,
        p_type: "send" as any,
        p_description: `Float allocation to ${selectedFloatDist.business_name}`,
        p_reference: `FA-${Date.now()}`,
      });
      if (error) throw error;
      toast({ title: "Float Allocated", description: `৳${fmt(Number(floatAmount))} sent to ${selectedFloatDist.business_name}` });
      setSelectedFloatDist(null);
      setFloatAmount("");
      setFloatSheet(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setFloatProcessing(false);
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

  const activeDist = distributors.filter(d => d.status === "active").length;
  const pendingDist = distributors.filter(d => d.status === "pending").length;
  const activeAgents = agents.filter(a => a.status === "active").length;
  const totalCustomers = agents.reduce((s, a) => s + a.customers_onboarded, 0);
  const totalCommission = agents.reduce((s, a) => s + a.commission_earned, 0);
  const openAlerts = alerts.filter(a => a.status === "open").length;
  const todayTxns = recentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayVolume = todayTxns.reduce((s, t) => s + t.amount, 0);

  const { isDisabled } = useGlobalToggles();

  const quickActions = [
    { icon: UserPlus, label: "Create Dist.", bg: "rgba(156,39,176,0.12)", ring: "1px solid rgba(156,39,176,0.25)", path: "/super-distributor/create-distributor", toggleKey: "super_distributor_create" },
    { icon: Send, label: "Float Send", bg: "rgba(33,150,243,0.12)", ring: "1px solid rgba(33,150,243,0.25)", action: "float" as const, toggleKey: "super_distributor_float_send" },
    { icon: Network, label: "Distributors", bg: "rgba(76,175,80,0.12)", ring: "1px solid rgba(76,175,80,0.25)", action: "distributors" as const, toggleKey: "super_distributor_distributors" },
    { icon: ListChecks, label: "Dist Txns", bg: "rgba(103,58,183,0.12)", ring: "1px solid rgba(103,58,183,0.25)", action: "distTxns" as const, toggleKey: "super_distributor_dist_txns" },
    { icon: Banknote, label: "Settle", bg: "rgba(0,150,136,0.12)", ring: "1px solid rgba(0,150,136,0.25)", action: "settle" as const, toggleKey: "super_distributor_settle" },
    { icon: FileBarChart, label: "Reconcile", bg: "rgba(255,152,0,0.12)", ring: "1px solid rgba(255,152,0,0.25)", action: "reconcile" as const, toggleKey: "super_distributor_reconcile" },
    { icon: BarChart3, label: "Analytics", bg: "rgba(0,188,212,0.12)", ring: "1px solid rgba(0,188,212,0.25)", action: "analytics" as const, toggleKey: "super_distributor_analytics" },
    { icon: History, label: "History", bg: "rgba(255,193,7,0.12)", ring: "1px solid rgba(255,193,7,0.25)", action: "history" as const, toggleKey: "super_distributor_history" },
    { icon: AlertTriangle, label: "Alerts", bg: "rgba(244,67,54,0.12)", ring: "1px solid rgba(244,67,54,0.25)", action: "alerts" as const, toggleKey: "super_distributor_alerts" },
    { icon: Headphones, label: "Support", bg: "rgba(120,120,140,0.12)", ring: "1px solid rgba(120,120,140,0.25)", action: "support" as const, toggleKey: "super_distributor_support" },
  ].filter(a => !a.toggleKey || !isDisabled(a.toggleKey));

  const handleQuickAction = (item: typeof quickActions[0]) => {
    if ("path" in item && item.path) {
      navigate(item.path);
    } else if ("action" in item) {
      if (item.action === "float") setFloatSheet(true);
      else if (item.action === "support") setSupportOpen(true);
      else if (item.action === "distributors") setSubView("distributors");
      else if (item.action === "alerts") setSubView("alerts");
      else if (item.action === "analytics") setSubView("analytics");
      else if (item.action === "distTxns") setSubView("distTxns");
      else if (item.action === "settle") setSubView("settle");
      else if (item.action === "reconcile") setSubView("reconcile");
      else if (item.action === "history") setSubView("history");
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════ */
  /* ── Sub-views ── */
  if (subView === "distributors") return <DistributorsView distributors={distributors} agents={agents} onBack={() => setSubView("home")} onRefresh={loadData} toast={toast} />;
  if (subView === "agents") return <AllAgentsView agents={agents} distributors={distributors} onBack={() => setSubView("home")} />;
  if (subView === "alerts") return <AlertsView alerts={alerts} onBack={() => setSubView("home")} />;
  if (subView === "analytics") return <AnalyticsView distributors={distributors} agents={agents} alerts={alerts} balance={balance} onBack={() => setSubView("home")} />;
  if (subView === "distTxns") return <DistTxnsView distributors={distributors} onBack={() => setSubView("home")} />;
  if (subView === "settle") return <SettleView distributors={distributors} balance={balance} onBack={() => setSubView("home")} onRefresh={loadData} toast={toast} />;
  if (subView === "reconcile") return <ReconcileView distributors={distributors} userId={user!.id} onBack={() => setSubView("home")} />;
  if (subView === "history") return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => setSubView("home")} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-primary-foreground">Transaction History</h1>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4">
        <TransactionHistory filterTypes={["send", "receive", "addmoney"]} customLabels={{ addmoney: "Distributor" }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* ═══ Hero Header ═══ */}
      <header className="relative overflow-hidden">
        <div className="px-4 pt-5 pb-28" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 50%, hsl(300 45% 22%) 100%)" }}>
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute top-32 -left-16 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => navigate("/")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground transition-colors">
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

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl glass-hero flex items-center justify-center">
                <Crown size={22} className="text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-primary-foreground truncate">Super Distributor</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-primary-foreground/70">{distributors.length} distributors · {agents.length} agents · {txnCount} txns today</span>
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
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Master Float Pool</p>
              <motion.button onClick={toggleBalance} whileTap={{ scale: 0.97 }} className="flex items-center mt-1">
                {showBalance ? (
                  <motion.span key="bal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-extrabold text-foreground tracking-tight">৳{fmt(balance)}</motion.span>
                ) : (
                  <span className="text-2xl font-extrabold text-foreground tracking-tight">৳ • • • • •</span>
                )}
                {showBalance ? <EyeOff size={14} className="ml-2 text-muted-foreground" /> : <Eye size={14} className="ml-2 text-muted-foreground" />}
              </motion.button>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Today's Volume</p>
              <p className="text-sm font-bold text-foreground">৳{fmt(todayVolume)}</p>
            </div>
          </div>

          {/* Float usage bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: "60%" }} transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: "linear-gradient(90deg, hsl(270 60% 50%), hsl(300 50% 45%))" }} />
          </div>
        </Card>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        {/* ═══ Quick Actions Grid ═══ */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((item, i) => (
            <motion.button
              key={item.label}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={stagger}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleQuickAction(item)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl press-effect transition-all active:scale-95"
              style={{ background: item.bg, border: item.ring }}
            >
              <item.icon size={22} className="text-foreground" />
              <span className="text-[10px] font-semibold text-foreground leading-tight text-center">{item.label}</span>
            </motion.button>
          ))}
        </div>

        {/* ═══ Stats Grid ═══ */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Active Dist.", value: activeDist.toString(), color: "text-primary" },
            { label: "Pending", value: pendingDist.toString(), color: "text-accent" },
            { label: "Agents", value: activeAgents.toString(), color: "text-primary" },
            { label: "Alerts", value: openAlerts.toString(), color: "text-destructive" },
          ].map((s, i) => (
            <motion.div key={s.label} custom={i + 8} initial="hidden" animate="visible" variants={stagger}>
              <Card className="p-2.5 border-0 shadow-card text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[8px] text-muted-foreground font-semibold">{s.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ═══ 7-Day Volume Chart ═══ */}
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-primary" /> 7-Day Volume
          </h3>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sdVolFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(270 60% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(270 60% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 12 }} formatter={(v: any) => [`৳${fmt(v)}`, "Volume"]} />
                <Area type="monotone" dataKey="volume" stroke="hsl(270 60% 50%)" strokeWidth={2} fill="url(#sdVolFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ═══ Network Health ═══ */}
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
            {pendingDist > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/5 border border-accent/20">
                <Clock size={14} className="text-accent" />
                <p className="text-xs text-foreground font-medium">{pendingDist} distributor{pendingDist > 1 ? "s" : ""} awaiting approval</p>
              </div>
            )}
            {agents.filter(a => a.status === "pending").length > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/5 border border-accent/20">
                <Users size={14} className="text-accent" />
                <p className="text-xs text-foreground font-medium">{agents.filter(a => a.status === "pending").length} agents pending approval</p>
              </div>
            )}
            {openAlerts === 0 && pendingDist === 0 && agents.filter(a => a.status === "pending").length === 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <CheckCircle2 size={14} className="text-primary" />
                <p className="text-xs text-foreground font-medium">All systems operational</p>
              </div>
            )}
          </div>
        </Card>

        {/* ═══ Top Distributors ═══ */}
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
                  <button key={d.id} onClick={() => setDistDetailSheet(d)} className="w-full flex items-center justify-between py-2 px-1 border-b border-border/50 last:border-0 press-effect text-left">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                      }`}>{i + 1}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{d.business_name}</p>
                        <p className="text-[9px] text-muted-foreground">{dAgents.length} agents · {(d.territory ?? []).join(", ") || "—"}</p>
                      </div>
                    </div>
                    <Badge className={`text-[9px] ${statusColor[d.status]}`}>{d.status}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ═══ Distributor Detail Sheet ═══ */}
      <Sheet open={!!distDetailSheet} onOpenChange={() => setDistDetailSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-base">Distributor Details</SheetTitle></SheetHeader>
          {distDetailSheet && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(156,39,176,0.12)" }}>
                  <Network size={22} className="text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{distDetailSheet.business_name}</p>
                  <Badge className={`text-[9px] ${statusColor[distDetailSheet.status]}`}>{distDetailSheet.status}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-muted/50 text-center">
                  <p className="text-[9px] text-muted-foreground">Rate</p>
                  <p className="text-sm font-bold text-foreground">{(distDetailSheet.commission_rate * 100).toFixed(2)}%</p>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/50 text-center">
                  <p className="text-[9px] text-muted-foreground">Max Float</p>
                  <p className="text-sm font-bold text-foreground">৳{fmt(distDetailSheet.max_float)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/50 text-center">
                  <p className="text-[9px] text-muted-foreground">Agents</p>
                  <p className="text-sm font-bold text-foreground">{agents.filter(a => a.distributor_id === distDetailSheet.id).length}</p>
                </div>
              </div>
              {distDetailSheet.territory && distDetailSheet.territory.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Territories</p>
                  <div className="flex flex-wrap gap-1">
                    {distDetailSheet.territory.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {distDetailSheet.status === "pending" && (
                  <>
                    <Button onClick={() => updateDistStatus(distDetailSheet.id, "active")} className="flex-1 text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>
                      <UserCheck size={14} className="mr-1.5" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={() => updateDistStatus(distDetailSheet.id, "suspended")} className="flex-1">Reject</Button>
                  </>
                )}
                {distDetailSheet.status === "active" && (
                  <Button variant="outline" onClick={() => updateDistStatus(distDetailSheet.id, "suspended")} className="flex-1">Suspend</Button>
                )}
                {distDetailSheet.status === "suspended" && (
                  <Button onClick={() => updateDistStatus(distDetailSheet.id, "active")} className="flex-1 text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>Reactivate</Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ Float Distribution Sheet ═══ */}
      <Sheet open={floatSheet} onOpenChange={setFloatSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-base">Allocate Float</SheetTitle></SheetHeader>
          <div className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">Your balance: <span className="font-bold text-foreground">৳{fmt(balance)}</span></p>
            {selectedFloatDist ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{selectedFloatDist.business_name}</p>
                    <p className="text-[10px] text-muted-foreground">Max: ৳{fmt(selectedFloatDist.max_float)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFloatDist(null)} className="h-7 text-[10px]">Change</Button>
                </div>
                <div>
                  <Label className="text-xs">Amount (৳)</Label>
                  <Input type="text" inputMode="numeric" placeholder="Enter amount" value={floatAmount} onChange={e => setFloatAmount(e.target.value.replace(/\D/g, ""))} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[100000, 500000, 1000000, 5000000].map(a => (
                    <button key={a} onClick={() => setFloatAmount(String(a))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground press-effect">৳{fmt(a)}</button>
                  ))}
                </div>
                <Button onClick={distributeFloat} disabled={!floatAmount || Number(floatAmount) < 1000 || floatProcessing} className="w-full text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>
                  {floatProcessing ? "Allocating…" : `Allocate ৳${floatAmount ? fmt(Number(floatAmount)) : "0"}`}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {distributors.filter(d => d.status === "active").length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No active distributors</p>
                ) : (
                  distributors.filter(d => d.status === "active").map(d => (
                    <button key={d.id} onClick={() => setSelectedFloatDist(d)} className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 press-effect">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(156,39,176,0.12)" }}>
                          <Network size={12} className="text-foreground" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-foreground">{d.business_name}</p>
                          <p className="text-[9px] text-muted-foreground">{(d.territory ?? []).join(", ") || "—"}</p>
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
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[70vh] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-base">Notifications</SheetTitle></SheetHeader>
          <div className="space-y-2 pt-4">
            {notifications.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                  <Bell className="w-7 h-7 text-muted-foreground" />
                </motion.div>
                <p className="text-sm font-semibold text-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground mt-1">Alerts will appear here</p>
              </motion.div>
            ) : notifications.map(n => (
              <div key={n.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/20 border border-border/30">
                <div>
                  <p className="text-xs font-semibold text-foreground capitalize">{n.type}</p>
                  <p className="text-[10px] text-muted-foreground">{n.name || n.phone || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-foreground">৳{fmt(n.amount)}</p>
                  <p className="text-[9px] text-muted-foreground">{new Date(n.time).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-border/40">
            <NotificationPreferences scope="distributor" />
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Support Sheet ═══ */}
      <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-5 pb-3"><SheetTitle className="text-base">Support</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-hidden">{user && <SupportChat userId={user.id} />}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Distributors Sub-View ── */
const DistributorsView = ({ distributors, agents, onBack, onRefresh, toast }: {
  distributors: DistRow[]; agents: AgentRow[]; onBack: () => void; onRefresh: () => void; toast: any;
}) => {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const [search, setSearch] = useState("");
  const filtered = (filter === "all" ? distributors : distributors.filter(d => d.status === filter))
    .filter(d => !search || d.business_name.toLowerCase().includes(search.toLowerCase()));

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("distributors").update({ status: status as any }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Updated", description: `Distributor status: ${status}` }); onRefresh(); }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-primary-foreground">Distributor Network</h1>
          <Badge className="ml-auto text-[10px] bg-white/15 text-primary-foreground border-0">{distributors.length}</Badge>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search distributors…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {(["all", "active", "pending", "suspended"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>{f === "all" ? `All (${distributors.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${distributors.filter(d => d.status === f).length})`}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-muted-foreground" />
            </motion.div>
            <p className="text-sm font-semibold text-foreground">No distributors found</p>
            <p className="text-xs text-muted-foreground mt-1">Distributors will appear here</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filtered.map(d => {
              const dAgents = agents.filter(a => a.distributor_id === d.id);
              return (
                <Card key={d.id} className="p-3 border-0 shadow-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(156,39,176,0.12)" }}>
                        <Network size={14} className="text-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{d.business_name}</p>
                        <p className="text-[9px] text-muted-foreground">{(d.territory ?? []).join(", ") || "No territory"}</p>
                      </div>
                    </div>
                    <Badge className={`text-[9px] ${statusColor[d.status]}`}>{d.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-1.5 rounded-lg bg-muted/50">
                      <p className="text-[9px] text-muted-foreground">Agents</p>
                      <p className="text-xs font-bold text-foreground">{dAgents.length}</p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-muted/50">
                      <p className="text-[9px] text-muted-foreground">Rate</p>
                      <p className="text-xs font-bold text-foreground">{(d.commission_rate * 100).toFixed(2)}%</p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-muted/50">
                      <p className="text-[9px] text-muted-foreground">Max Float</p>
                      <p className="text-xs font-bold text-foreground">৳{fmt(d.max_float)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {d.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(d.id, "active")} className="flex-1 h-7 text-[10px] text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>
                          <UserCheck size={12} className="mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(d.id, "suspended")} className="flex-1 h-7 text-[10px]">Reject</Button>
                      </>
                    )}
                    {d.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(d.id, "suspended")} className="flex-1 h-7 text-[10px]">Suspend</Button>
                    )}
                    {d.status === "suspended" && (
                      <Button size="sm" onClick={() => updateStatus(d.id, "active")} className="flex-1 h-7 text-[10px] text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>Reactivate</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── All Agents Sub-View ── */
const AllAgentsView = ({ agents, distributors, onBack }: { agents: AgentRow[]; distributors: DistRow[]; onBack: () => void }) => {
  const [search, setSearch] = useState("");
  const getDistName = (distId: string | null) => distId ? distributors.find(d => d.id === distId)?.business_name ?? "Unknown" : "Unassigned";
  const filtered = agents.filter(a => !search || (a.business_name || "").toLowerCase().includes(search.toLowerCase()) || (a.territory_code || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-primary-foreground">All Agents</h1>
          <Badge className="ml-auto text-[10px] bg-white/15 text-primary-foreground border-0">{agents.length}</Badge>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search agents…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Active", count: agents.filter(a => a.status === "active").length, color: "text-primary" },
            { label: "Pending", count: agents.filter(a => a.status === "pending").length, color: "text-accent" },
            { label: "Suspended", count: agents.filter(a => a.status === "suspended").length, color: "text-destructive" },
          ].map(s => (
            <Card key={s.label} className="p-2.5 border-0 shadow-card text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
              <Users className="w-7 h-7 text-muted-foreground" />
            </motion.div>
            <p className="text-sm font-semibold text-foreground">No agents found</p>
            <p className="text-xs text-muted-foreground mt-1">Agents will appear here</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {filtered.map(ag => (
              <Card key={ag.id} className="p-3 border-0 shadow-card">
                <div className="flex items-center justify-between">
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Alerts Sub-View ── */
const AlertsView = ({ alerts, onBack }: { alerts: FraudRow[]; onBack: () => void }) => {
  const severityIcon: Record<string, string> = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-primary-foreground">Fraud & Security Alerts</h1>
          <Badge className="ml-auto text-[10px] bg-white/15 text-primary-foreground border-0">{alerts.length}</Badge>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {(["open", "investigating", "resolved", "false_positive"] as const).map(s => (
            <Card key={s} className="p-2.5 border-0 shadow-card text-center">
              <p className="text-lg font-bold text-foreground">{alerts.filter(a => a.status === s).length}</p>
              <p className="text-[8px] text-muted-foreground capitalize">{s.replace("_", " ")}</p>
            </Card>
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
              <Card key={a.id} className="p-3 border-0 shadow-card space-y-1">
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Analytics Sub-View ── */
const AnalyticsView = ({ distributors, agents, alerts, balance, onBack }: {
  distributors: DistRow[]; agents: AgentRow[]; alerts: FraudRow[]; balance: number; onBack: () => void;
}) => {
  const totalCustomers = agents.reduce((s, a) => s + a.customers_onboarded, 0);
  const totalCommission = agents.reduce((s, a) => s + a.commission_earned, 0);
  const avgAgentsPerDist = distributors.length > 0 ? (agents.length / distributors.length).toFixed(1) : "0";
  const allTerritories = [...new Set(distributors.flatMap(d => d.territory ?? []))];

  const distStats = distributors.map(d => ({
    name: d.business_name,
    agents: agents.filter(a => a.distributor_id === d.id).length,
    customers: agents.filter(a => a.distributor_id === d.id).reduce((s, a) => s + a.customers_onboarded, 0),
  })).sort((a, b) => b.agents - a.agents);

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-primary-foreground">Analytics</h1>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Territories", value: allTerritories.length.toString() },
            { label: "Avg Agents/Dist", value: avgAgentsPerDist },
            { label: "Total Customers", value: fmt(totalCustomers) },
            { label: "Network Commission", value: `৳${fmt(totalCommission)}` },
            { label: "Open Alerts", value: alerts.filter(a => a.status === "open").length.toString() },
            { label: "Master Float", value: `৳${fmt(balance)}` },
          ].map(m => (
            <Card key={m.label} className="p-3 border-0 shadow-card">
              <p className="text-lg font-bold text-foreground">{m.value}</p>
              <p className="text-[9px] text-muted-foreground">{m.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-2">Territory Coverage</h3>
          <div className="flex flex-wrap gap-1.5">
            {allTerritories.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
            {allTerritories.length === 0 && <p className="text-xs text-muted-foreground">No territories assigned</p>}
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">Distributor Performance</h3>
          {distStats.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No data</p>
          ) : (
            <div className="space-y-3">
              {distStats.map(d => {
                const maxA = Math.max(...distStats.map(x => x.agents), 1);
                return (
                  <div key={d.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground">{d.agents} agents · {d.customers} cust.</p>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(d.agents / maxA) * 100}%`, background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

/* ── Distributor Transaction Monitoring Sub-View ── */
const DistTxnsView = ({ distributors, onBack }: { distributors: DistRow[]; onBack: () => void }) => {
  const [selectedDist, setSelectedDist] = useState<DistRow | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadDistTxns = useCallback(async (userId: string) => {
    setTxnLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setTxns(data ?? []);
    setTxnLoading(false);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!selectedDist) return;
    loadDistTxns(selectedDist.user_id);
    const channel = supabase
      .channel(`sd-dist-txn-monitor-${selectedDist.user_id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `user_id=eq.${selectedDist.user_id}`,
      }, () => {
        loadDistTxns(selectedDist.user_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDist, loadDistTxns]);

  const filteredTxns = txns.filter(t =>
    !search ||
    (t.recipient_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.recipient_phone || "").includes(search) ||
    (t.short_id || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.type || "").toLowerCase().includes(search.toLowerCase())
  );

  const txnTypeColor: Record<string, string> = {
    send: "text-destructive", receive: "text-primary", cashout: "text-accent",
    cashin: "text-primary", addmoney: "text-primary", payment: "text-destructive",
    recharge: "text-destructive", paybill: "text-destructive", banktransfer: "text-accent",
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={selectedDist ? () => setSelectedDist(null) : onBack} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-primary-foreground">{selectedDist ? selectedDist.business_name : "Distributor Transactions"}</h1>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        {!selectedDist ? (
          <>
            <p className="text-xs text-muted-foreground">Select a distributor to view their transactions in real-time</p>
            <div className="space-y-2">
              {distributors.map(d => (
                <button key={d.id} onClick={() => setSelectedDist(d)} className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 press-effect shadow-card">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(156,39,176,0.12)" }}>
                      <Network size={14} className="text-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">{d.business_name}</p>
                      <p className="text-[9px] text-muted-foreground">{(d.territory ?? []).join(", ") || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] ${statusColor[d.status]}`}>{d.status}</Badge>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </div>
                </button>
              ))}
              {distributors.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No distributors in network</p>}
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, phone, ID, type…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Live — updates automatically</span>
              <Badge variant="secondary" className="text-[9px] ml-auto">{txns.length} txns</Badge>
            </div>
            {txnLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredTxns.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-7 h-7 text-muted-foreground" />
                </motion.div>
                <p className="text-sm font-semibold text-foreground">No transactions found</p>
                <p className="text-xs text-muted-foreground mt-1">Transactions will appear here</p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {filteredTxns.map(t => (
                  <Card key={t.id} className="p-3 border-0 shadow-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold capitalize ${txnTypeColor[t.type] || "text-foreground"}`}>{t.type}</span>
                          <span className="text-[9px] text-muted-foreground">#{t.short_id}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.recipient_name || t.recipient_phone || t.description || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${["receive", "cashin", "addmoney"].includes(t.type) ? "text-primary" : "text-foreground"}`}>
                          {["receive", "cashin", "addmoney"].includes(t.type) ? "+" : "-"}৳{fmt(t.amount)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{new Date(t.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    {t.fee > 0 && <p className="text-[9px] text-muted-foreground mt-1">Fee: ৳{fmt(t.fee)} · Balance: ৳{fmt(t.balance_after ?? 0)}</p>}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ── Commission Settlement Sub-View ── */
const SettleView = ({ distributors, balance, onBack, onRefresh, toast }: {
  distributors: DistRow[]; balance: number; onBack: () => void; onRefresh: () => void; toast: any;
}) => {
  const [processing, setProcessing] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [selectedDist, setSelectedDist] = useState<DistRow | null>(null);
  const [distBalances, setDistBalances] = useState<Record<string, { balance: number; phone: string }>>({});
  const [loadingBalances, setLoadingBalances] = useState(true);

  // Load distributor balances + phones
  useEffect(() => {
    const load = async () => {
      setLoadingBalances(true);
      const userIds = distributors.map(d => d.user_id);
      if (userIds.length === 0) { setLoadingBalances(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("user_id, balance, phone")
        .in("user_id", userIds);
      const map: Record<string, { balance: number; phone: string }> = {};
      (data ?? []).forEach(p => { map[p.user_id] = { balance: p.balance, phone: p.phone }; });
      setDistBalances(map);
      setLoadingBalances(false);
    };
    load();
  }, [distributors]);

  const settleCommission = async () => {
    if (!selectedDist || processing) return;
    setProcessing(true);
    try {
      const distProfile = distBalances[selectedDist.user_id];
      if (!distProfile) throw new Error("Distributor profile not found");
      const amount = Number(settleAmount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      if (amount > balance) throw new Error("Insufficient float balance");

      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: distProfile.phone,
        p_amount: amount,
        p_fee: 0,
        p_type: "send" as any,
        p_description: `Commission settlement for ${selectedDist.business_name}`,
        p_reference: `CS-SD-${Date.now()}`,
      });
      if (error) throw error;

      toast({ title: "Settled", description: `৳${fmt(amount)} commission paid to ${selectedDist.business_name}` });
      setSelectedDist(null);
      setSettleAmount("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const activeDists = distributors.filter(d => d.status === "active");
  const totalNetworkCommission = activeDists.reduce((s, d) => s + (d.commission_rate * 100), 0);

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={selectedDist ? () => setSelectedDist(null) : onBack} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-primary-foreground">Commission Settlement</h1>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        {/* Summary Card */}
        <Card className="p-4 border-0 shadow-card">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <p className="text-[9px] text-muted-foreground">Your Float</p>
              <p className="text-sm font-bold text-foreground">৳{fmt(balance)}</p>
            </div>
            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-center">
              <p className="text-[9px] text-muted-foreground">Active Distributors</p>
              <p className="text-sm font-bold text-foreground">{activeDists.length}</p>
            </div>
          </div>
        </Card>

        {!selectedDist ? (
          <>
            <p className="text-xs text-muted-foreground">Select a distributor to settle commission</p>
            {loadingBalances ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {activeDists.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No active distributors</p>
                ) : (
                  activeDists.map(d => {
                    const db = distBalances[d.user_id];
                    return (
                      <button key={d.id} onClick={() => setSelectedDist(d)} className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 press-effect shadow-card">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,150,136,0.12)" }}>
                            <Banknote size={14} className="text-foreground" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-semibold text-foreground">{d.business_name}</p>
                            <p className="text-[9px] text-muted-foreground">Rate: {(d.commission_rate * 100).toFixed(2)}% · Balance: ৳{fmt(db?.balance ?? 0)}</p>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        ) : (
          <Card className="p-5 border-0 shadow-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,150,136,0.12)" }}>
                <Banknote size={20} className="text-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{selectedDist.business_name}</p>
                <p className="text-[10px] text-muted-foreground">Commission Rate: {(selectedDist.commission_rate * 100).toFixed(2)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-muted/50 text-center">
                <p className="text-[9px] text-muted-foreground">Dist. Balance</p>
                <p className="text-sm font-bold text-foreground">৳{fmt(distBalances[selectedDist.user_id]?.balance ?? 0)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/50 text-center">
                <p className="text-[9px] text-muted-foreground">Max Float</p>
                <p className="text-sm font-bold text-foreground">৳{fmt(selectedDist.max_float)}</p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Settlement Amount (৳)</Label>
              <Input type="text" inputMode="numeric" placeholder="Enter commission amount" value={settleAmount} onChange={e => setSettleAmount(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[5000, 10000, 25000, 50000].map(a => (
                <button key={a} onClick={() => setSettleAmount(String(a))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground press-effect">৳{fmt(a)}</button>
              ))}
            </div>
            <Button onClick={settleCommission} disabled={!settleAmount || Number(settleAmount) <= 0 || processing} className="w-full text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>
              {processing ? "Settling…" : `Settle ৳${settleAmount ? fmt(Number(settleAmount)) : "0"}`}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

/* ── Float Reconciliation Report Sub-View ── */
const ReconcileView = ({ distributors, userId, onBack }: {
  distributors: DistRow[]; userId: string; onBack: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [reconData, setReconData] = useState<{
    dist: DistRow;
    allocated: number;
    returned: number;
    net: number;
    txnCount: number;
    currentBalance: number;
  }[]>([]);
  const [totalAllocated, setTotalAllocated] = useState(0);
  const [totalReturned, setTotalReturned] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Get all float-related transactions from SD to distributors and vice versa
      const distUserIds = distributors.map(d => d.user_id);
      if (distUserIds.length === 0) { setLoading(false); return; }

      // Get SD's outgoing (allocated) transactions to distributors
      const { data: sdTxns } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .in("type", ["send"])
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1000);

      // Get distributor profiles for phone matching + current balances
      const { data: distProfiles } = await supabase
        .from("profiles")
        .select("user_id, phone, balance")
        .in("user_id", distUserIds);

      const phoneToUserId = new Map<string, string>();
      const userIdToBalance = new Map<string, number>();
      (distProfiles ?? []).forEach(p => {
        phoneToUserId.set(p.phone, p.user_id);
        userIdToBalance.set(p.user_id, p.balance);
      });

      // Get SD's phone for matching return transactions
      const { data: sdProfile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", userId)
        .single();
      const sdPhone = sdProfile?.phone ?? "";

      // Get distributor transactions sent back to SD (returns)
      const returnTxnPromises = distUserIds.map(uid =>
        supabase
          .from("transactions")
          .select("amount, recipient_phone, type")
          .eq("user_id", uid)
          .eq("status", "completed")
          .in("type", ["send"])
          .limit(500)
      );
      const returnResults = await Promise.all(returnTxnPromises);

      // Build reconciliation per distributor
      const distPhones = new Set<string>();
      (distProfiles ?? []).forEach(p => distPhones.add(p.phone));

      const results = distributors.map((dist, idx) => {
        const distProfile = (distProfiles ?? []).find(p => p.user_id === dist.user_id);
        const distPhone = distProfile?.phone ?? "";

        // Float allocated: SD sent to this distributor
        const allocated = (sdTxns ?? [])
          .filter(t => t.recipient_phone === distPhone && (t.description ?? "").toLowerCase().includes("float"))
          .reduce((s, t) => s + t.amount, 0);

        // Float returned: distributor sent back to SD
        const distReturnTxns = returnResults[idx]?.data ?? [];
        const returned = distReturnTxns
          .filter(t => t.recipient_phone === sdPhone)
          .reduce((s, t) => s + t.amount, 0);

        return {
          dist,
          allocated,
          returned,
          net: allocated - returned,
          txnCount: (sdTxns ?? []).filter(t => t.recipient_phone === distPhone).length + distReturnTxns.filter(t => t.recipient_phone === sdPhone).length,
          currentBalance: userIdToBalance.get(dist.user_id) ?? 0,
        };
      });

      setReconData(results);
      setTotalAllocated(results.reduce((s, r) => s + r.allocated, 0));
      setTotalReturned(results.reduce((s, r) => s + r.returned, 0));
      setLoading(false);
    };
    load();
  }, [distributors, userId]);

  const totalNet = totalAllocated - totalReturned;

  const exportCsv = () => {
    const headers = ["Distributor", "Status", "Territory", "Allocated (৳)", "Returned (৳)", "Net Outstanding (৳)", "Current Balance (৳)", "Max Float (৳)", "Utilization (%)", "Float Txns"];
    const rows = [headers.join(",")];
    reconData.forEach(r => {
      const util = r.dist.max_float > 0 ? ((r.currentBalance / r.dist.max_float) * 100).toFixed(1) : "0.0";
      rows.push([
        `"${r.dist.business_name}"`,
        r.dist.status,
        `"${(r.dist.territory ?? []).join(", ") || "—"}"`,
        r.allocated,
        r.returned,
        r.net,
        r.currentBalance,
        r.dist.max_float,
        util,
        r.txnCount,
      ].join(","));
    });
    rows.push("");
    rows.push(`"Total",,,${totalAllocated},${totalReturned},${totalNet},,,,`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `float-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text("Float Reconciliation Report", 14, 18);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);
    doc.text(`Total Allocated: ৳${fmt(totalAllocated)}  |  Total Returned: ৳${fmt(totalReturned)}  |  Net Outstanding: ৳${fmt(Math.abs(totalNet))}`, 14, 30);

    const tableRows = reconData.map(r => {
      const util = r.dist.max_float > 0 ? ((r.currentBalance / r.dist.max_float) * 100).toFixed(1) + "%" : "0%";
      return [r.dist.business_name, r.dist.status, (r.dist.territory ?? []).join(", ") || "—", `৳${fmt(r.allocated)}`, `৳${fmt(r.returned)}`, `৳${fmt(Math.abs(r.net))}`, `৳${fmt(r.currentBalance)}`, `৳${fmt(r.dist.max_float)}`, util, String(r.txnCount)];
    });

    (doc as any).autoTable({
      startY: 34,
      head: [["Distributor", "Status", "Territory", "Allocated", "Returned", "Net Out", "Balance", "Max Float", "Util.", "Txns"]],
      body: tableRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [103, 58, 183] },
    });

    doc.save(`float-reconciliation-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="tap-target text-primary-foreground"><ArrowLeft size={20} /></button>
            <h1 className="text-base font-bold text-primary-foreground">Float Reconciliation</h1>
          </div>
          {!loading && reconData.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 gap-1" onClick={exportCsv}>
                <Download size={12} /> CSV
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 gap-1" onClick={exportPdf}>
                <Download size={12} /> PDF
              </Button>
            </div>
          )}
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="p-3 border-0 shadow-card text-center">
                <p className="text-[9px] text-muted-foreground font-semibold">Total Allocated</p>
                <p className="text-sm font-bold text-primary">৳{fmt(totalAllocated)}</p>
              </Card>
              <Card className="p-3 border-0 shadow-card text-center">
                <p className="text-[9px] text-muted-foreground font-semibold">Total Returned</p>
                <p className="text-sm font-bold text-accent">৳{fmt(totalReturned)}</p>
              </Card>
              <Card className="p-3 border-0 shadow-card text-center">
                <p className="text-[9px] text-muted-foreground font-semibold">Net Outstanding</p>
                <p className={`text-sm font-bold ${totalNet > 0 ? "text-destructive" : "text-primary"}`}>৳{fmt(Math.abs(totalNet))}</p>
              </Card>
            </div>

            {/* Per-distributor breakdown */}
            <Card className="border-0 shadow-card overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileBarChart size={14} className="text-accent" /> Per-Distributor Breakdown
                </h3>
              </div>
              {reconData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No distributors</p>
              ) : (
                <div className="divide-y divide-border/30">
                  {reconData.map(r => {
                    const utilization = r.dist.max_float > 0 ? (r.currentBalance / r.dist.max_float) * 100 : 0;
                    return (
                      <div key={r.dist.id} className="p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,152,0,0.12)" }}>
                              <Network size={14} className="text-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{r.dist.business_name}</p>
                              <p className="text-[9px] text-muted-foreground">{r.txnCount} float txns · {(r.dist.territory ?? []).join(", ") || "—"}</p>
                            </div>
                          </div>
                          <Badge className={`text-[9px] ${statusColor[r.dist.status]}`}>{r.dist.status}</Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          <div className="p-2 rounded-lg bg-primary/5 text-center">
                            <p className="text-[8px] text-muted-foreground">Allocated</p>
                            <p className="text-[11px] font-bold text-primary">৳{fmt(r.allocated)}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-accent/5 text-center">
                            <p className="text-[8px] text-muted-foreground">Returned</p>
                            <p className="text-[11px] font-bold text-accent">৳{fmt(r.returned)}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50 text-center">
                            <p className="text-[8px] text-muted-foreground">Net Out</p>
                            <p className={`text-[11px] font-bold ${r.net > 0 ? "text-destructive" : "text-primary"}`}>৳{fmt(Math.abs(r.net))}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50 text-center">
                            <p className="text-[8px] text-muted-foreground">Balance</p>
                            <p className="text-[11px] font-bold text-foreground">৳{fmt(r.currentBalance)}</p>
                          </div>
                        </div>

                        {/* Float utilization bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[8px] text-muted-foreground">Float Utilization</p>
                            <p className="text-[8px] font-semibold text-muted-foreground">{utilization.toFixed(1)}% of ৳{fmt(r.dist.max_float)}</p>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(utilization, 100)}%`,
                                background: utilization > 80 ? "hsl(var(--destructive))" : utilization > 50 ? "hsl(40 80% 50%)" : "hsl(var(--primary))",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperDistributorDashboard;
