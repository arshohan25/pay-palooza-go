import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine, ArrowUpFromLine, Wallet, TrendingUp, UserPlus, Receipt,
  ArrowLeft, Menu, RefreshCw, Users, BarChart3, Activity,
  Building2, Bell, ArrowRightLeft, Share2, X, Eye, EyeOff,
  ChevronRight, Banknote, Shield, Clock, History,
  MessageCircleQuestion, CircleDollarSign, Headphones,
  ChevronDown, Phone, Mail, Landmark, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import SupportChat from "@/components/SupportChat";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ShareReceiptSheet, { ReceiptData } from "@/components/ShareReceiptSheet";
import AgentMenuDrawer from "@/components/AgentMenuDrawer";
import { useNavigate } from "react-router-dom";
import { useUserSessionTimeout } from "@/hooks/use-user-session-timeout";
import { haptics } from "@/lib/haptics";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useFutureFeatures } from "@/hooks/use-future-features";

/* ─── Types ─── */
interface AgentInfo {
  business_name: string | null;
  commission_earned: number;
  max_float: number;
  customers_onboarded: number;
  status: string;
  territory_code: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const stagger = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] as const },
  }),
};

/* ═══════════════════════════════════════════════════════════════════════ */
const AgentDashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useUserSessionTimeout("agent");
  const { isDisabled } = useGlobalToggles();
  const futureFeatures = useFutureFeatures();
  void futureFeatures.visibility.future_agent_liquidity_intel;

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [balance, setBalance] = useState(0);
  const [showBalance, setShowBalance] = useState(false);
  const [isAgent, setIsAgent] = useState<boolean | null>(null);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txnCount, setTxnCount] = useState(0);

  // Float Request & Support sheets
  const [floatSheetOpen, setFloatSheetOpen] = useState(false);
  const [supportSheetOpen, setSupportSheetOpen] = useState(false);
  const [supportTab, setSupportTab] = useState<"faq" | "chat">("faq");
  const [floatAmount, setFloatAmount] = useState("");
  const [floatNote, setFloatNote] = useState("");
  const [floatSubmitting, setFloatSubmitting] = useState(false);

  // Menu drawer
  const [menuOpen, setMenuOpen] = useState(false);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const knownTxnIds = useRef(new Set<string>());
  const initialLoad = useRef(true);

  // Txn detail + receipt
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

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

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [roleRes, profileRes, agentRes, txnRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "agent"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("agents").select("*").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).in("type", ["cashin", "cashout", "banktransfer", "paybill"]).order("created_at", { ascending: false }).limit(20),
    ]);
    setIsAgent((roleRes.data?.length ?? 0) > 0);
    setBalance(profileRes.data?.balance ?? 0);
    setAgentInfo(agentRes.data as AgentInfo | null);
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
      .channel("agent-txn-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, (payload) => {
        const newTxn = payload.new as any;
        if (!knownTxnIds.current.has(newTxn.id)) {
          knownTxnIds.current.add(newTxn.id);
          haptics.notify();
          setNotifications(prev => [{ id: newTxn.id, type: newTxn.type, amount: newTxn.amount, time: newTxn.created_at, phone: newTxn.recipient_phone, name: newTxn.recipient_name }, ...prev]);
          setUnreadCount(prev => prev + 1);
          if (new Date(newTxn.created_at).toDateString() === new Date().toDateString()) setTxnCount(prev => prev + 1);
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

  /* ── 7-day commission chart data ── */
  const chartData = useMemo(() => {
    const days: { label: string; date: string; commission: number; volume: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayLabel = d.toLocaleDateString("en-BD", { weekday: "short" });
      const dayTxns = recentTxns.filter(t => new Date(t.created_at).toDateString() === dateStr);
      days.push({
        label: dayLabel,
        date: dateStr,
        commission: dayTxns.reduce((s, t) => s + (t.commission || 0), 0),
        volume: dayTxns.reduce((s, t) => s + t.amount, 0),
      });
    }
    return days;
  }, [recentTxns]);

  /* ── Share receipt ── */
  const shareTxnReceipt = (tx: any) => {
    const typeLabels: Record<string, string> = { send: "Send Money", receive: "Received", cashout: "Cash Out", cashin: "Cash In", banktransfer: "Bank Transfer", payment: "Payment", recharge: "Recharge", paybill: "Bill Pay", addmoney: "Add Money" };
    const gradients: Record<string, string> = { send: "bg-gradient-to-b from-pink-500 to-rose-500", receive: "bg-gradient-to-b from-emerald-500 to-green-500", cashin: "bg-gradient-to-b from-emerald-500 to-green-500", cashout: "bg-gradient-to-b from-orange-500 to-amber-500", payment: "bg-gradient-to-b from-purple-500 to-violet-500", paybill: "bg-gradient-to-b from-amber-500 to-yellow-500", addmoney: "bg-gradient-to-b from-blue-500 to-indigo-500", banktransfer: "bg-gradient-to-b from-indigo-500 to-blue-600", recharge: "bg-gradient-to-b from-cyan-500 to-teal-500" };
    const rows = [
      { label: "Type", value: typeLabels[tx.type] || tx.type },
      { label: "Status", value: tx.status },
      ...(tx.recipient_phone ? [{ label: "To", value: tx.recipient_phone }] : []),
      ...(tx.recipient_name ? [{ label: "Name", value: tx.recipient_name }] : []),
      ...(tx.fee > 0 ? [{ label: "Fee", value: `৳${fmt(tx.fee)}` }] : []),
      ...(tx.commission > 0 ? [{ label: "Commission", value: `৳${fmt(tx.commission)}` }] : []),
      { label: "Date", value: new Date(tx.created_at).toLocaleString("en-BD") },
    ];
    setReceiptData({ title: typeLabels[tx.type] || tx.type, amount: `৳${fmt(tx.amount)}`, gradient: gradients[tx.type] || "bg-gradient-to-b from-gray-500 to-gray-600", rows, txnId: tx.short_id || tx.id });
    setReceiptOpen(true);
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
  const todayTxns = recentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayVolume = todayTxns.reduce((sum, t) => sum + t.amount, 0);
  const todayCommission = todayTxns.reduce((sum, t) => sum + (t.commission || 0), 0);

  const quickActions = [
    { icon: ArrowDownToLine, label: "Cash In", bg: "rgba(76,175,80,0.12)", ring: "1px solid rgba(76,175,80,0.25)", path: "/agent/cashin", toggleKey: "agent_cash_in" },
    { icon: ArrowRightLeft, label: "B2B Send", bg: "rgba(233,30,99,0.12)", ring: "1px solid rgba(233,30,99,0.25)", path: "/agent/b2b", toggleKey: "agent_b2b" },
    { icon: Banknote, label: "Bank", bg: "rgba(33,150,243,0.12)", ring: "1px solid rgba(33,150,243,0.25)", path: "/agent/bank", toggleKey: "agent_bank_transfer" },
    { icon: Receipt, label: "Bill Pay", bg: "rgba(255,193,7,0.12)", ring: "1px solid rgba(255,193,7,0.25)", path: "/agent/billpay", toggleKey: "agent_bill_pay" },
    { icon: UserPlus, label: "Register", bg: "rgba(156,39,176,0.12)", ring: "1px solid rgba(156,39,176,0.25)", path: "/agent/register", toggleKey: "agent_register" },
    { icon: CircleDollarSign, label: "Float Req", bg: "rgba(255,87,34,0.12)", ring: "1px solid rgba(255,87,34,0.25)", action: "float" as const, toggleKey: "agent_float_request" },
    { icon: History, label: "History", bg: "rgba(0,188,212,0.12)", ring: "1px solid rgba(0,188,212,0.25)", path: "/agent/history", toggleKey: "agent_history" },
    { icon: Headphones, label: "Support", bg: "rgba(120,120,140,0.12)", ring: "1px solid rgba(120,120,140,0.25)", action: "support" as const, toggleKey: "agent_support" },
  ].filter(a => !a.toggleKey || !isDisabled(a.toggleKey));

  const stats = [
    { label: "Today's Txns", value: txnCount.toString(), icon: Activity, color: "bg-primary/10 text-primary" },
    { label: "Volume", value: `৳${fmt(todayVolume)}`, icon: BarChart3, color: "bg-accent/10 text-accent" },
    { label: "Earned Today", value: `৳${fmt(todayCommission)}`, icon: TrendingUp, color: "bg-primary/10 text-primary" },
    { label: "Customers", value: (agentInfo?.customers_onboarded ?? 0).toString(), icon: Users, color: "bg-accent/10 text-accent" },
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* ── Hero Header ── */}
      <header className="relative overflow-hidden">
        <div className="gradient-hero px-4 pt-5 pb-28">
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute top-32 -left-16 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative max-w-xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setMenuOpen(true)} className="tap-target text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                <Menu size={20} />
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
                      <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
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

            {/* Agent identity */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl glass-hero flex items-center justify-center">
                <Building2 size={22} className="text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-primary-foreground truncate">{agentInfo?.business_name || "Agent Portal"}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className="bg-white/15 text-primary-foreground border-0 text-[9px] px-1.5 py-0 font-semibold backdrop-blur-sm">{agentInfo?.territory_code || "BD"}</Badge>
                  <span className="text-[10px] text-primary-foreground/70 capitalize">{agentInfo?.status || "active"}</span>
                  <span className="text-[10px] text-primary-foreground/70">• {txnCount} txns today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Balance Card (tap to reveal, 5s auto-hide) ── */}
      <div className="max-w-xl mx-auto px-4 -mt-20 relative z-10">
        <Card className="p-5 border-0 shadow-elevated bg-card rounded-2xl">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Float Balance</p>
              <motion.button
                onClick={toggleBalance}
                whileTap={{ scale: 0.97 }}
                className="flex items-center mt-1"
                aria-label={showBalance ? "Hide balance" : "Show balance"}
              >
                <AnimatePresence mode="wait">
                  {showBalance ? (
                    <motion.div key="shown" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} className="flex items-baseline gap-1">
                      <span className="text-lg font-semibold text-muted-foreground">৳</span>
                      <span className="text-3xl font-extrabold text-foreground tracking-tight">{fmt(balance)}</span>
                      <EyeOff size={14} className="ml-2 text-muted-foreground/50" />
                    </motion.div>
                  ) : (
                    <motion.div key="hidden" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} className="glass-hero rounded-2xl px-4 py-2 flex items-center gap-2 bg-muted/60 border border-border/40">
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
              <p className="text-[10px] text-muted-foreground">Max ৳{fmt(agentInfo?.max_float ?? 500000)}</p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${floatPct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full gradient-primary rounded-full" />
          </div>
        </Card>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-5 space-y-5">
        {/* ── Quick Actions Card Grid 4×2 ── */}
        <div className="bg-card rounded-3xl shadow-card border border-border/60 p-4">
          <div className="grid grid-cols-4 gap-y-5 gap-x-2">
            {quickActions.map((item, i) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.04 + i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                whileTap={{ scale: 0.90 }}
                onClick={() => {
                  if ("action" in item && item.action === "float") setFloatSheetOpen(true);
                  else if ("action" in item && item.action === "support") setSupportSheetOpen(true);
                  else if ("path" in item && item.path) navigate(item.path);
                }}
                className="flex flex-col items-center gap-2.5 group outline-none"
              >
                <motion.div
                  whileHover={{ scale: 1.06, y: -2 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="relative flex items-center justify-center rounded-full shadow-sm group-hover:shadow-md transition-shadow duration-200 overflow-hidden"
                  style={{ width: 52, height: 52, background: item.bg, outline: item.ring }}
                >
                  <item.icon size={20} className="text-foreground/80" />
                </motion.div>
                <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-colors duration-150 px-0.5">
                  {item.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <motion.div key={s.label} custom={i + 4} variants={stagger} initial="hidden" animate="visible">
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

        {/* ── Commission Banner ── */}
        <Card className="p-4 border-0 shadow-card rounded-2xl bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Banknote size={18} className="text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">Agent Commission</p>
              <p className="text-[10px] text-muted-foreground">0.49% Cash In/Out · 0.019% Bill Pay</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-extrabold text-primary">৳{fmt(agentInfo?.commission_earned ?? 0)}</p>
              <p className="text-[9px] text-muted-foreground">Total earned</p>
            </div>
          </div>
        </Card>

        {/* ── 7-Day Commission Trend ── */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">7-Day Commission Trend</h3>
          <Card className="border-0 shadow-card rounded-2xl p-4">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `৳${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,.1)", fontSize: 11, background: "hsl(var(--card))" }}
                    formatter={(v: number) => [`৳${fmt(v)}`, "Commission"]}
                    labelStyle={{ fontWeight: 700, color: "hsl(var(--foreground))" }}
                  />
                  <Area type="monotone" dataKey="commission" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#commGrad)" dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
              <span className="text-[10px] text-muted-foreground font-semibold">7-Day Total</span>
              <span className="text-sm font-extrabold text-primary">৳{fmt(chartData.reduce((s, d) => s + d.commission, 0))}</span>
            </div>
          </Card>
        </div>

        {/* ── Recent Activity ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
            <button
              onClick={() => navigate("/agent/history")}
              className="flex items-center gap-0.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors press-effect"
            >
              See All <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          </div>
          <Card className="border-0 shadow-card rounded-2xl overflow-hidden">
            {recentTxns.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-10 text-center">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                  <Clock className="w-7 h-7 text-muted-foreground" />
                </motion.div>
                <p className="text-sm font-semibold text-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your activity will appear here</p>
              </motion.div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentTxns.slice(0, 8).map(tx => {
                  const isCredit = tx.type === "cashout";
                  const txIcon = (() => {
                    switch (tx.type) {
                      case "cashin": return { Icon: ArrowUpFromLine, cls: "bg-destructive/10 text-destructive" };
                      case "cashout": return { Icon: ArrowDownToLine, cls: "bg-primary/10 text-primary" };
                      case "banktransfer": return { Icon: Landmark, cls: "bg-accent/10 text-accent" };
                      case "paybill": return { Icon: FileText, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
                      default: return { Icon: ArrowDownToLine, cls: "bg-muted text-muted-foreground" };
                    }
                  })();
                  const typeLabels: Record<string, string> = { cashin: "Cash In", cashout: "Cash Out", banktransfer: "Bank Transfer", paybill: "Bill Pay" };
                  return (
                    <button key={tx.id} onClick={() => setSelectedTxn(tx)} className="flex items-center gap-3 px-4 py-3 w-full text-left press-effect hover:bg-muted/20 transition-colors">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${txIcon.cls}`}>
                        <txIcon.Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{typeLabels[tx.type] || tx.type}</p>
                        <p className="text-[10px] text-muted-foreground">{tx.recipient_phone || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-extrabold ${isCredit ? "text-primary" : "text-foreground"}`}>
                          {isCredit ? "+" : "-"}৳{fmt(tx.amount)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{new Date(tx.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Transaction Detail Modal ── */}
      <AnimatePresence>
        {selectedTxn && <TxnDetailModal tx={selectedTxn} onClose={() => setSelectedTxn(null)} onShare={shareTxnReceipt} />}
      </AnimatePresence>

      {/* ── Notification Panel ── */}
      <AnimatePresence>
        {notifOpen && (
          <NotificationPanel
            notifications={notifications}
            systemAlerts={[
              ...(floatPct < 20 ? [{ id: "float-low", text: "⚠️ Float balance critically low", time: new Date().toISOString() }] : []),
              ...(floatPct < 50 && floatPct >= 20 ? [{ id: "float-warn", text: "📉 Float balance is getting low", time: new Date().toISOString() }] : []),
            ]}
            onClose={() => setNotifOpen(false)}
            onViewTxn={(tx) => { setNotifOpen(false); setSelectedTxn(tx); }}
          />
        )}
      </AnimatePresence>

      {receiptData && <ShareReceiptSheet open={receiptOpen} onClose={() => setReceiptOpen(false)} receipt={receiptData} />}

      {/* ── Agent Menu Drawer ── */}
      <AgentMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} agentInfo={agentInfo} recentTxns={recentTxns} />

      {/* ── Float Request Sheet ── */}
      <Sheet open={floatSheetOpen} onOpenChange={setFloatSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-extrabold">Request Float Top-Up</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Amount (৳)</Label>
              <Input type="number" placeholder="e.g. 50000" value={floatAmount} onChange={e => setFloatAmount(e.target.value)} className="h-12 rounded-xl text-lg font-bold" />
              <div className="flex gap-2 mt-2">
                {[10000, 25000, 50000, 100000].map(v => (
                  <button key={v} onClick={() => setFloatAmount(String(v))} className="flex-1 py-1.5 rounded-lg bg-muted text-xs font-semibold text-foreground hover:bg-primary/10 transition-colors">
                    ৳{fmt(v)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Note (optional)</Label>
              <Textarea placeholder="Reason for float request..." value={floatNote} onChange={e => setFloatNote(e.target.value)} className="rounded-xl resize-none" rows={2} />
            </div>
            <Button
              className="w-full h-12 rounded-xl text-sm font-bold gradient-primary text-primary-foreground"
              disabled={!floatAmount || Number(floatAmount) <= 0 || floatSubmitting}
              onClick={async () => {
                setFloatSubmitting(true);
                await new Promise(r => setTimeout(r, 800));
                toast.success(`Float request of ৳${fmt(Number(floatAmount))} sent to distributor`);
                setFloatAmount("");
                setFloatNote("");
                setFloatSheetOpen(false);
                setFloatSubmitting(false);
              }}
            >
              {floatSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Support Sheet with Live Chat ── */}
      <Sheet open={supportSheetOpen} onOpenChange={setSupportSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 max-h-[85vh] overflow-hidden flex flex-col">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-base font-extrabold">Agent Support</SheetTitle>
          </SheetHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-muted/60 rounded-xl mb-4">
            <button
              onClick={() => setSupportTab("faq")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${supportTab === "faq" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ChevronDown size={13} /> FAQ
            </button>
            <button
              onClick={() => setSupportTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${supportTab === "chat" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MessageCircle size={13} /> Live Chat
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {supportTab === "faq" ? (
              <div className="space-y-3 overflow-y-auto max-h-[55vh] pr-1">
                {[
                  { q: "How to request more float?", a: "Tap 'Float Req' from Quick Actions and enter the amount. Your distributor will be notified." },
                  { q: "Cash In transaction failed?", a: "Check your balance and retry. If the issue persists, contact your distributor with the transaction ID." },
                  { q: "How is commission calculated?", a: "You earn 0.49% on Cash In/Out and 0.019% on Bill Pay transactions, credited instantly." },
                  { q: "How to register a new customer?", a: "Tap 'Register' and fill in the customer's phone, name, and NID details." },
                  { q: "Bank transfer not reflecting?", a: "Bank transfers may take 1-2 business days. Check History for status updates." },
                ].map((faq, i) => (
                  <details key={i} className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                      <span className="text-xs font-semibold text-foreground pr-2">{faq.q}</span>
                      <ChevronDown size={14} className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="text-xs text-muted-foreground px-3 pt-2 pb-1 leading-relaxed">{faq.a}</p>
                  </details>
                ))}
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Need more help?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="rounded-xl h-11 text-xs font-bold gap-2" onClick={() => { window.location.href = "tel:+8801800000000"; }}>
                      <Phone size={14} /> Call Support
                    </Button>
                    <Button variant="outline" className="rounded-xl h-11 text-xs font-bold gap-2" onClick={() => setSupportTab("chat")}>
                      <MessageCircle size={14} /> Live Chat
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <SupportChat userId={user!.id} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ── Transaction Detail Modal ── */

const TxnDetailModal = React.forwardRef<HTMLDivElement, { tx: any; onClose: () => void; onShare: (tx: any) => void }>(({ tx, onClose, onShare }, ref) => {
  const typeLabels: Record<string, string> = { send: "Send Money", receive: "Received", cashout: "Cash Out", cashin: "Cash In", banktransfer: "Bank Transfer", payment: "Payment", recharge: "Recharge", paybill: "Bill Pay", addmoney: "Add Money" };
  const isCredit = tx.type === "receive" || tx.type === "addmoney";
  return (
    <div ref={ref}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 34 }} className="fixed bottom-0 left-0 right-0 z-[81] bg-card rounded-t-3xl shadow-float max-h-[80vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/25" /></div>
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-foreground">Transaction Details</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground"><X size={15} /></button>
          </div>
          <div className="text-center py-4">
            <p className={`text-3xl font-extrabold ${isCredit ? "text-primary" : "text-foreground"}`}>{isCredit ? "+" : "-"}৳{fmt(tx.amount)}</p>
            <Badge className={`mt-2 ${tx.status === "completed" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"} border-0 text-[10px] font-bold`}>{tx.status}</Badge>
          </div>
          <Card className="border-0 shadow-card rounded-2xl overflow-hidden">
            <div className="divide-y divide-border/50">
              {[
                { label: "Type", value: typeLabels[tx.type] || tx.type },
                ...(tx.recipient_name ? [{ label: "Name", value: tx.recipient_name }] : []),
                ...(tx.recipient_phone ? [{ label: "Phone", value: tx.recipient_phone }] : []),
                { label: "Amount", value: `৳${fmt(tx.amount)}` },
                ...(tx.fee > 0 ? [{ label: "Fee", value: `৳${fmt(tx.fee)}` }] : []),
                ...(tx.commission > 0 ? [{ label: "Commission", value: `+৳${fmt(tx.commission)}` }] : []),
                ...(tx.balance_after != null ? [{ label: "Balance After", value: `৳${fmt(tx.balance_after)}` }] : []),
                ...(tx.description ? [{ label: "Description", value: tx.description }] : []),
                { label: "Date", value: new Date(tx.created_at).toLocaleString("en-BD") },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-semibold text-foreground text-right max-w-[60%] break-all">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border/50 bg-muted/30">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Transaction ID</p>
              <p className="text-[10px] font-mono font-bold text-primary break-all mt-0.5">{tx.short_id || tx.id}</p>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onShare(tx)} className="rounded-xl h-11 text-xs font-bold gap-2"><Share2 size={14} /> Share Receipt</Button>
            <Button onClick={onClose} className="gradient-primary text-primary-foreground rounded-xl h-11 text-xs font-bold">Done</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
TxnDetailModal.displayName = "TxnDetailModal";

/* ── Notification Panel ── */
const NotificationPanel = React.forwardRef<HTMLDivElement, { notifications: any[]; systemAlerts: { id: string; text: string; time: string }[]; onClose: () => void; onViewTxn: (tx: any) => void }>(({ notifications, systemAlerts, onClose, onViewTxn }, ref) => {
  const typeLabels: Record<string, string> = { send: "Send Money", receive: "Received", cashout: "Cash Out", cashin: "Cash In", banktransfer: "Bank Transfer", payment: "Payment" };
  const getTxnIcon = (type: string) => {
    switch (type) {
      case "cashin": case "receive": return { Icon: ArrowDownToLine, cls: "bg-primary/10 text-primary" };
      case "cashout": return { Icon: ArrowUpFromLine, cls: "bg-destructive/10 text-destructive" };
      case "banktransfer": return { Icon: Landmark, cls: "bg-accent/10 text-accent" };
      case "paybill": return { Icon: FileText, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
      default: return { Icon: ArrowDownToLine, cls: "bg-muted text-muted-foreground" };
    }
  };
  return (
    <div ref={ref}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 34 }} className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-sm z-[71] bg-card shadow-float overflow-y-auto">
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-foreground">Notifications</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground"><X size={15} /></button>
          </div>
          {systemAlerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">System Alerts</p>
              {systemAlerts.map(a => (
                <Card key={a.id} className="p-3 border-0 shadow-card rounded-xl bg-destructive/5 border-l-2 border-l-destructive">
                  <p className="text-xs font-semibold text-foreground">{a.text}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">Just now</p>
                </Card>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Transactions</p>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Bell size={28} className="mb-2 opacity-40" />
                <p className="text-xs">No new notifications</p>
              </div>
            ) : (
              notifications.slice(0, 20).map(n => {
                const { Icon: NIcon, cls } = getTxnIcon(n.type);
                return (
                  <Card key={n.id} className="p-3 border-0 shadow-card rounded-xl cursor-pointer press-effect hover:bg-muted/30 transition-colors" onClick={() => onViewTxn(n)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
                        <NIcon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{typeLabels[n.type] || n.type}</p>
                        <p className="text-[10px] text-muted-foreground">{n.phone || n.name || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-extrabold ${n.type === "receive" || n.type === "cashin" ? "text-primary" : "text-foreground"}`}>৳{fmt(n.amount)}</p>
                        <p className="text-[9px] text-muted-foreground">{new Date(n.time).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
});
NotificationPanel.displayName = "NotificationPanel";

export default AgentDashboard;
