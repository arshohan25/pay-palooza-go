import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, QrCode, BarChart3, Wallet, Clock,
  Shield, Building2, Store, TrendingUp, DollarSign, Copy,
  CheckCircle2, Calendar, ArrowUpDown, Download, CreditCard,
  Percent, Receipt, ChevronRight, Eye, BanknoteIcon, Users,
  Zap, Gift, Star, ShieldCheck, Smartphone, Globe, TrendingDown,
  Target, Award, Sparkles, ArrowUpRight, ArrowDownRight, PieChart,
  Bell, Settings, HelpCircle, Landmark, BadgeCheck, Link, Share2,
  ExternalLink, Plus, Trash2, Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

/* ─── Types ─── */
type MerchTab = "overview" | "qr" | "transactions" | "settlements" | "mdr" | "paylinks";

interface MerchantInfo {
  id: string;
  business_name: string;
  category: string;
  status: string;
  mdr_rate: number;
  settlement_frequency: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_routing: string | null;
  trade_license: string | null;
  qr_code_data: string | null;
}

interface TxnRow {
  id: string;
  type: string;
  amount: number;
  fee: number;
  commission: number;
  status: string;
  recipient_phone: string | null;
  recipient_name: string | null;
  description: string | null;
  reference: string | null;
  balance_after: number | null;
  created_at: string;
}

/* ─── Helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const tabItems: { id: MerchTab; icon: typeof QrCode; label: string }[] = [
  { id: "overview",     icon: BarChart3,    label: "Overview" },
  { id: "qr",           icon: QrCode,       label: "QR Code" },
  { id: "paylinks",     icon: Link,         label: "Pay Links" },
  { id: "transactions", icon: ArrowUpDown,  label: "Transactions" },
  { id: "settlements",  icon: BanknoteIcon, label: "Settlements" },
  { id: "mdr",          icon: Percent,       label: "MDR" },
];

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } } },
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const MerchantDashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<MerchTab>("overview");
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [isMerchant, setIsMerchant] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [roleRes, profileRes, merchRes, txnRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "merchant"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("merchants").select("*").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setIsMerchant((roleRes.data?.length ?? 0) > 0);
    setBalance(profileRes.data?.balance ?? 0);
    setMerchant(merchRes.data as MerchantInfo | null);
    setTxns((txnRes.data ?? []) as TxnRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const paymentTxns = useMemo(() => txns.filter(t => t.type === "payment"), [txns]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
            <Store size={24} className="text-primary-foreground" />
          </div>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
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
  if (isMerchant === false) {
    return <MerchantBenefitsPage navigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Premium Header ── */}
      <header className="relative overflow-hidden px-4 pt-6 pb-24">
        {/* Gradient background with orbs */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(150deg, hsl(24 90% 50%) 0%, hsl(16 82% 40%) 40%, hsl(350 65% 35%) 100%)"
        }} />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20" style={{
          background: "radial-gradient(circle, hsl(36 95% 60%) 0%, transparent 70%)"
        }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{
          background: "radial-gradient(circle, hsl(0 0% 100%) 0%, transparent 70%)"
        }} />

        <div className="relative max-w-xl mx-auto text-primary-foreground">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => navigate("/")} className="tap-target w-10 h-10 rounded-xl glass-hero flex items-center justify-center">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <button onClick={loadData} className="tap-target w-10 h-10 rounded-xl glass-hero flex items-center justify-center">
                <RefreshCw size={16} />
              </button>
              <button className="tap-target w-10 h-10 rounded-xl glass-hero flex items-center justify-center">
                <Bell size={16} />
              </button>
            </div>
          </div>

          {/* Business identity */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl glass-hero flex items-center justify-center ring-2 ring-white/20">
              <Store size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight truncate">{merchant?.business_name || "Merchant"}</h1>
                <BadgeCheck size={18} className="text-white/80 shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-[9px] bg-white/15 border-white/20 text-white capitalize backdrop-blur-sm">{merchant?.category || "retail"}</Badge>
                <Badge className="text-[9px] bg-white/15 border-white/20 text-white backdrop-blur-sm">
                  <Zap size={8} className="mr-0.5" />{merchant?.settlement_frequency || "T+1"}
                </Badge>
                <Badge className={`text-[9px] border-0 backdrop-blur-sm ${merchant?.status === "active" ? "bg-green-500/30 text-green-100" : "bg-yellow-500/30 text-yellow-100"}`}>
                  {merchant?.status || "active"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Balance hero */}
          <div className="glass-hero rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider">Available Balance</p>
                <p className="text-3xl font-black tracking-tight mt-0.5">৳{fmt(balance)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Wallet size={22} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Quick Stats Grid ── */}
      <div className="max-w-xl mx-auto px-4 -mt-10 relative z-10">
        <motion.div
          variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-3 gap-2.5"
        >
          {(() => {
            const todayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
            const todaySales = todayTxns.reduce((s, t) => s + t.amount, 0);
            const yesterdayTxns = paymentTxns.filter(t => {
              const y = new Date(); y.setDate(y.getDate() - 1);
              return new Date(t.created_at).toDateString() === y.toDateString();
            });
            const yesterdaySales = yesterdayTxns.reduce((s, t) => s + t.amount, 0);
            const salesGrowth = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100) : 0;

            return [
              { label: "Today's Sales", value: `৳${fmt(todaySales)}`, icon: TrendingUp, trend: salesGrowth, gradient: "from-emerald-500/10 to-emerald-600/5" },
              { label: "Transactions", value: todayTxns.length.toString(), icon: Receipt, trend: null, gradient: "from-blue-500/10 to-blue-600/5" },
              { label: "Customers", value: new Set(paymentTxns.map(t => t.recipient_phone)).size.toString(), icon: Users, trend: null, gradient: "from-purple-500/10 to-purple-600/5" },
            ].map((s, i) => (
              <motion.div key={s.label} variants={stagger.item}>
                <Card className={`p-3 border-0 shadow-elevated bg-gradient-to-br ${s.gradient} backdrop-blur-sm`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <s.icon size={15} className="text-primary" />
                    {s.trend !== null && (
                      <span className={`text-[9px] font-bold flex items-center ${s.trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {s.trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(s.trend).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-foreground">{s.value}</p>
                  <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
                </Card>
              </motion.div>
            ));
          })()}
        </motion.div>
      </div>

      {/* ── Tab strip ── */}
      <div className="max-w-xl mx-auto px-4 mt-5">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2 bg-muted/50 rounded-2xl p-1.5">
          {tabItems.map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all press-effect flex-1 justify-center ${
                  active ? "text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <t.icon size={13} />{t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-xl mx-auto px-4 py-5 pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
            {activeTab === "overview"     && <MerchOverview merchant={merchant} balance={balance} paymentTxns={paymentTxns} />}
            {activeTab === "qr"           && <QRTab merchant={merchant} toast={toast} />}
            {activeTab === "paylinks"     && <PayLinksTab merchant={merchant} toast={toast} />}
            {activeTab === "transactions" && <TxnTab txns={paymentTxns} />}
            {activeTab === "settlements"  && <SettlementTab merchant={merchant} paymentTxns={paymentTxns} />}
            {activeTab === "mdr"          && <MDRTab merchant={merchant} paymentTxns={paymentTxns} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Benefits Page (for non-merchants) ── */
const MerchantBenefitsPage = ({ navigate }: { navigate: (path: string) => void }) => {
  const benefits = [
    { icon: QrCode, title: "QR Payments", desc: "Accept instant payments via QR scan — no card machine needed", color: "from-primary/20 to-primary/5" },
    { icon: Zap, title: "Instant Settlement", desc: "Get your money next business day with T+1 settlement", color: "from-amber-500/20 to-amber-500/5" },
    { icon: TrendingUp, title: "Growth Analytics", desc: "Track sales, customers & revenue trends in real-time", color: "from-blue-500/20 to-blue-500/5" },
    { icon: ShieldCheck, title: "Fraud Protection", desc: "AI-powered fraud detection keeps your business safe", color: "from-emerald-500/20 to-emerald-500/5" },
    { icon: Percent, title: "Low MDR Rates", desc: "Industry-lowest merchant discount rates starting 0.5%", color: "from-purple-500/20 to-purple-500/5" },
    { icon: Globe, title: "Online Presence", desc: "Digital storefront & payment link for remote customers", color: "from-rose-500/20 to-rose-500/5" },
  ];

  const stats = [
    { value: "50K+", label: "Active Merchants" },
    { value: "৳2B+", label: "Monthly Volume" },
    { value: "0.5%", label: "Lowest MDR" },
    { value: "T+1", label: "Settlement" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden px-4 pt-8 pb-16">
        <div className="absolute inset-0" style={{
          background: "linear-gradient(150deg, hsl(24 90% 50%) 0%, hsl(16 82% 40%) 40%, hsl(350 65% 35%) 100%)"
        }} />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-15" style={{
          background: "radial-gradient(circle, hsl(36 95% 65%) 0%, transparent 70%)"
        }} />

        <div className="relative max-w-xl mx-auto text-primary-foreground">
          <button onClick={() => navigate("/")} className="tap-target w-10 h-10 rounded-xl glass-hero flex items-center justify-center mb-8">
            <ArrowLeft size={18} />
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-amber-200" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">Grow Your Business</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight mb-3">
              Accept Digital Payments.<br />
              <span className="text-amber-200">Grow Your Shop.</span>
            </h1>
            <p className="text-sm text-white/75 leading-relaxed max-w-sm">
              Join thousands of shop owners accepting QR payments, tracking sales, and growing their business — all from one dashboard.
            </p>
          </motion.div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 -mt-8 relative z-10 pb-24 space-y-6">
        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-4 gap-2"
        >
          {stats.map(s => (
            <Card key={s.label} className="p-3 border-0 shadow-elevated text-center">
              <p className="text-base font-black text-foreground">{s.value}</p>
              <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
            </Card>
          ))}
        </motion.div>

        {/* Benefits grid */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-3 px-1">Why Become a Merchant?</h2>
          <motion.div
            variants={stagger.container} initial="hidden" animate="show"
            className="grid grid-cols-2 gap-3"
          >
            {benefits.map(b => (
              <motion.div key={b.title} variants={stagger.item}>
                <Card className={`p-4 border-0 shadow-card bg-gradient-to-br ${b.color} h-full`}>
                  <div className="w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center mb-3 shadow-sm">
                    <b.icon size={18} className="text-foreground" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{b.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{b.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Testimonial */}
        <Card className="p-5 border-0 shadow-elevated relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{
            background: "radial-gradient(circle, hsl(24 90% 50%) 0%, transparent 70%)"
          }} />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Star size={18} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                {[1,2,3,4,5].map(s => <Star key={s} size={10} className="text-amber-400 fill-amber-400" />)}
              </div>
              <p className="text-xs text-foreground leading-relaxed italic">
                "Since joining as a merchant, my daily sales tracking is effortless. The QR payment setup took 2 minutes and customers love it!"
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 font-semibold">— Rahim, Grocery Shop Owner</p>
            </div>
          </div>
        </Card>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button
            onClick={() => navigate("/")}
            className="w-full h-14 rounded-2xl text-base font-bold shadow-glow-lg"
            style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
          >
            <Store size={18} className="mr-2" /> Register as Merchant
          </Button>
          <Button onClick={() => navigate("/")} variant="outline" className="w-full h-12 rounded-2xl">
            <ArrowLeft size={16} className="mr-2" /> Back to Home
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Overview Tab ── */
const MerchOverview = ({ merchant, balance, paymentTxns }: { merchant: MerchantInfo | null; balance: number; paymentTxns: TxnRow[] }) => {
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const mdrDeducted = Math.round(totalRevenue * (merchant?.mdr_rate ?? 0.015));
  const avgTxn = paymentTxns.length > 0 ? Math.round(totalRevenue / paymentTxns.length) : 0;
  const uniqueCustomers = new Set(paymentTxns.map(t => t.recipient_phone)).size;

  const todayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayTxns.reduce((s, t) => s + t.amount, 0);

  // Last 7 days daily breakdown
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toDateString();
    const dayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === dayStr);
    return { day: d.toLocaleDateString("en-BD", { weekday: "short" }), amount: dayTxns.reduce((s, t) => s + t.amount, 0), count: dayTxns.length };
  });
  const maxDay = Math.max(...last7.map(d => d.amount), 1);

  // Peak hour analysis
  const hourCounts: number[] = Array(24).fill(0);
  paymentTxns.forEach(t => { hourCounts[new Date(t.created_at).getHours()]++; });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakLabel = `${peakHour % 12 || 12}${peakHour < 12 ? "AM" : "PM"}`;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Revenue cards grid */}
      <motion.div variants={stagger.item} className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Revenue", value: `৳${fmt(totalRevenue)}`, icon: DollarSign, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
          { label: "MDR Deducted", value: `৳${fmt(mdrDeducted)}`, icon: Percent, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
          { label: "Net Earnings", value: `৳${fmt(totalRevenue - mdrDeducted)}`, icon: TrendingUp, iconBg: "bg-amber-500/10", iconColor: "text-amber-600" },
          { label: "Avg Transaction", value: `৳${fmt(avgTxn)}`, icon: Receipt, iconBg: "bg-blue-500/10", iconColor: "text-blue-600" },
        ].map(s => (
          <Card key={s.label} className="p-3.5 border-0 shadow-card hover:shadow-elevated transition-shadow">
            <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center mb-2.5`}>
              <s.icon size={17} className={s.iconColor} />
            </div>
            <p className="text-lg font-extrabold text-foreground leading-tight">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </Card>
        ))}
      </motion.div>

      {/* Insights row */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Target size={14} className="text-primary" /> Quick Insights
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2.5 rounded-xl bg-muted/40">
              <Users size={14} className="text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{uniqueCustomers}</p>
              <p className="text-[9px] text-muted-foreground">Unique Customers</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-muted/40">
              <Clock size={14} className="text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{peakLabel}</p>
              <p className="text-[9px] text-muted-foreground">Peak Hour</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-muted/40">
              <Award size={14} className="text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{((merchant?.mdr_rate ?? 0.015) * 100).toFixed(1)}%</p>
              <p className="text-[9px] text-muted-foreground">MDR Rate</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* 7-day chart */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-primary" /> Last 7 Days Revenue
          </h3>
          <div className="flex items-end gap-2 h-32">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <p className="text-[8px] text-muted-foreground font-semibold">
                  {d.amount > 999 ? `${(d.amount / 1000).toFixed(0)}k` : d.amount > 0 ? `৳${d.amount}` : "—"}
                </p>
                <div className="w-full rounded-lg transition-all relative overflow-hidden" style={{
                  height: `${Math.max(6, (d.amount / maxDay) * 90)}px`,
                }}>
                  <div className="absolute inset-0 rounded-lg" style={{
                    background: i === 6
                      ? "linear-gradient(180deg, hsl(24 90% 55%), hsl(350 65% 38%))"
                      : "hsl(var(--muted))"
                  }} />
                  {i === 6 && <div className="absolute inset-0 rounded-lg animate-pulse" style={{
                    background: "linear-gradient(180deg, hsl(24 90% 55% / 0.3), transparent)"
                  }} />}
                </div>
                <p className={`text-[9px] font-medium ${i === 6 ? "text-foreground font-bold" : "text-muted-foreground"}`}>{d.day}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Recent payments */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Recent Payments</h3>
            <span className="text-[10px] font-semibold text-primary">{paymentTxns.length} total</span>
          </div>
          {paymentTxns.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard size={32} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No payments yet</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Share your QR code to start receiving payments</p>
            </div>
          ) : (
            <div className="space-y-1">
              {paymentTxns.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <CreditCard size={15} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{tx.recipient_name || "Customer"}</p>
                      <p className="text-[9px] text-muted-foreground">{tx.reference || "Payment"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600">+৳{fmt(tx.amount)}</p>
                    <p className="text-[9px] text-muted-foreground">{new Date(tx.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ── QR Code Tab ── */
const QRTab = ({ merchant, toast }: { merchant: MerchantInfo | null; toast: any }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const qrPayload = merchant?.qr_code_data || `MRC-${merchant?.id?.slice(0, 8) || "UNKNOWN"}`;

  useEffect(() => {
    QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQrDataUrl).catch(() => {});
  }, [qrPayload]);

  const copyCode = () => {
    navigator.clipboard.writeText(qrPayload);
    toast({ title: "Copied!", description: "Merchant QR code copied to clipboard" });
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.item}>
        <Card className="p-6 border-0 shadow-elevated text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-5" style={{
            background: "radial-gradient(circle, hsl(24 90% 50%) 0%, transparent 70%)"
          }} />
          <h3 className="text-base font-bold text-foreground mb-0.5">Your Payment QR Code</h3>
          <p className="text-[11px] text-muted-foreground mb-5">Customers scan this to pay you instantly</p>

          {qrDataUrl ? (
            <div className="inline-block p-5 bg-white rounded-3xl shadow-elevated mb-5 ring-1 ring-border/20">
              <img src={qrDataUrl} alt="Merchant QR" className="w-56 h-56" />
            </div>
          ) : (
            <div className="w-56 h-56 mx-auto bg-muted rounded-3xl flex items-center justify-center mb-5">
              <QrCode size={48} className="text-muted-foreground" />
            </div>
          )}

          <p className="text-sm font-bold text-foreground mb-1">{merchant?.business_name}</p>
          <div className="flex items-center justify-center gap-2 mb-5">
            <code className="text-xs bg-muted px-4 py-2 rounded-xl text-foreground font-mono">{qrPayload}</code>
            <button onClick={copyCode} className="tap-target text-muted-foreground hover:text-foreground transition-colors">
              <Copy size={14} />
            </button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => {
              if (!qrDataUrl) return;
              const link = document.createElement("a");
              link.download = `${merchant?.business_name || "merchant"}-qr.png`;
              link.href = qrDataUrl;
              link.click();
            }}>
              <Download size={14} className="mr-1.5" /> Download
            </Button>
            <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={copyCode}>
              <Copy size={14} className="mr-1.5" /> Copy Code
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">Merchant Details</h3>
          <div className="space-y-2 text-xs">
            {[
              { label: "Merchant ID", value: qrPayload },
              { label: "Business", value: merchant?.business_name || "—" },
              { label: "Category", value: merchant?.category || "—" },
              { label: "MDR Rate", value: `${((merchant?.mdr_rate ?? 0.015) * 100).toFixed(2)}%` },
              { label: "Trade License", value: merchant?.trade_license || "—" },
            ].map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-foreground capitalize">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ── Transactions Tab ── */
const TxnTab = ({ txns }: { txns: TxnRow[] }) => {
  const [filter, setFilter] = useState<"all" | "today" | "week">("all");

  const filtered = useMemo(() => {
    const now = new Date();
    if (filter === "today") return txns.filter(t => new Date(t.created_at).toDateString() === now.toDateString());
    if (filter === "week") {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      return txns.filter(t => new Date(t.created_at) >= weekAgo);
    }
    return txns;
  }, [txns, filter]);

  const total = filtered.reduce((s, t) => s + t.amount, 0);

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Payment History</h3>
            <p className="text-xs font-bold text-primary">৳{fmt(total)}</p>
          </div>

          <div className="flex gap-1.5 mb-4 bg-muted/50 p-1 rounded-xl">
            {(["all", "today", "week"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                  filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >{f === "week" ? "This Week" : f === "all" ? `All (${txns.length})` : "Today"}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <Receipt size={32} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 px-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <CreditCard size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{tx.recipient_name || "Customer"}</p>
                      <p className="text-[9px] text-muted-foreground">{tx.reference} · {tx.recipient_phone || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600">+৳{fmt(tx.amount)}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}
                      {" "}
                      {new Date(tx.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ── Settlement Tab ── */
const SettlementTab = ({ merchant, paymentTxns }: { merchant: MerchantInfo | null; paymentTxns: TxnRow[] }) => {
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const mdrRate = merchant?.mdr_rate ?? 0.015;
  const totalMDR = Math.round(totalRevenue * mdrRate);
  const netSettlement = totalRevenue - totalMDR;

  const dailyBatches = useMemo(() => {
    const groups: Record<string, { date: string; amount: number; count: number; mdr: number }> = {};
    paymentTxns.forEach(t => {
      const day = new Date(t.created_at).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" });
      if (!groups[day]) groups[day] = { date: day, amount: 0, count: 0, mdr: 0 };
      groups[day].amount += t.amount;
      groups[day].count++;
      groups[day].mdr += Math.round(t.amount * mdrRate);
    });
    return Object.values(groups).reverse();
  }, [paymentTxns, mdrRate]);

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.item}>
        <Card className="p-5 border-0 shadow-elevated relative overflow-hidden" style={{
          background: "linear-gradient(150deg, hsl(24 90% 50%) 0%, hsl(350 65% 38%) 100%)"
        }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-15" style={{
            background: "radial-gradient(circle, hsl(36 95% 65%) 0%, transparent 70%)"
          }} />
          <div className="relative">
            <p className="text-[11px] text-primary-foreground/70 font-medium uppercase tracking-wider">Net Settlement</p>
            <p className="text-3xl font-black text-primary-foreground mt-1">৳{fmt(netSettlement)}</p>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-primary-foreground/60">
              <span>Gross: ৳{fmt(totalRevenue)}</span>
              <span>MDR: -৳{fmt(totalMDR)}</span>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Landmark size={14} className="text-primary" /> Bank Details
          </h3>
          <div className="space-y-2 text-xs">
            {[
              { label: "Bank", value: merchant?.bank_name || "Not configured" },
              { label: "Account", value: merchant?.bank_account_number ? `****${merchant.bank_account_number.slice(-4)}` : "—" },
              { label: "Routing", value: merchant?.bank_routing || "—" },
              { label: "Frequency", value: merchant?.settlement_frequency || "T+1" },
            ].map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-foreground">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">Settlement Batches</h3>
          {dailyBatches.length === 0 ? (
            <div className="text-center py-6">
              <BanknoteIcon size={32} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No settlements yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dailyBatches.map((b, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-muted/30 border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-muted-foreground" />
                      <p className="text-xs font-semibold text-foreground">{b.date}</p>
                    </div>
                    <Badge variant="secondary" className="text-[9px]">{b.count} txns</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Gross: ৳{fmt(b.amount)}</span>
                    <span className="text-red-500">MDR: -৳{fmt(b.mdr)}</span>
                    <span className="font-bold text-emerald-600">Net: ৳{fmt(b.amount - b.mdr)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ── MDR Analytics Tab ── */
const MDRTab = ({ merchant, paymentTxns }: { merchant: MerchantInfo | null; paymentTxns: TxnRow[] }) => {
  const mdrRate = merchant?.mdr_rate ?? 0.015;
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const totalMDR = Math.round(totalRevenue * mdrRate);
  const avgTxnSize = paymentTxns.length > 0 ? Math.round(totalRevenue / paymentTxns.length) : 0;
  const avgMDRPerTxn = paymentTxns.length > 0 ? Math.round(totalMDR / paymentTxns.length) : 0;

  const ranges = [
    { label: "< ৳500", min: 0, max: 500 },
    { label: "৳500-2K", min: 500, max: 2000 },
    { label: "৳2K-5K", min: 2000, max: 5000 },
    { label: "৳5K-10K", min: 5000, max: 10000 },
    { label: "> ৳10K", min: 10000, max: Infinity },
  ];
  const distribution = ranges.map(r => ({
    ...r,
    count: paymentTxns.filter(t => t.amount >= r.min && t.amount < r.max).length,
    volume: paymentTxns.filter(t => t.amount >= r.min && t.amount < r.max).reduce((s, t) => s + t.amount, 0),
  }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.item}>
        <Card className="p-5 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Percent size={14} className="text-primary" /> MDR Summary
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Your MDR Rate", value: `${(mdrRate * 100).toFixed(2)}%`, icon: Percent, color: "bg-primary/10 text-primary" },
              { label: "Total MDR Paid", value: `৳${fmt(totalMDR)}`, icon: DollarSign, color: "bg-red-500/10 text-red-500" },
              { label: "Avg MDR/Txn", value: `৳${fmt(avgMDRPerTxn)}`, icon: Receipt, color: "bg-amber-500/10 text-amber-600" },
              { label: "Avg Txn Size", value: `৳${fmt(avgTxnSize)}`, icon: CreditCard, color: "bg-blue-500/10 text-blue-600" },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-xl bg-muted/30 border border-border/30">
                <div className={`w-7 h-7 rounded-lg ${m.color} flex items-center justify-center mb-2`}>
                  <m.icon size={13} />
                </div>
                <p className="text-base font-extrabold text-foreground">{m.value}</p>
                <p className="text-[9px] text-muted-foreground font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">Transaction Size Distribution</h3>
          <div className="space-y-3">
            {distribution.map(d => (
              <div key={d.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground">{d.label}</span>
                  <span className="text-[10px] text-muted-foreground">{d.count} txns · ৳{fmt(d.volume)}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.count / maxCount) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">MDR Rate Comparison</h3>
          <div className="space-y-1.5 text-xs">
            {[
              { category: "Retail", rate: "1.50%", yours: merchant?.category === "retail" },
              { category: "Restaurant", rate: "1.50%", yours: merchant?.category === "restaurant" },
              { category: "Grocery", rate: "1.20%", yours: merchant?.category === "grocery" },
              { category: "Pharmacy", rate: "1.00%", yours: merchant?.category === "pharmacy" },
              { category: "Education", rate: "0.80%", yours: merchant?.category === "education" },
              { category: "Utility", rate: "0.50%", yours: merchant?.category === "utility" },
            ].map(r => (
              <div key={r.category} className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${r.yours ? "bg-primary/5 border border-primary/20 shadow-sm" : "hover:bg-muted/30"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium capitalize">{r.category}</span>
                  {r.yours && <Badge className="text-[8px] bg-primary/10 text-primary border-0">Your Rate</Badge>}
                </div>
                <span className="font-bold text-foreground">{r.rate}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ── Payment Links Tab ── */
const PayLinksTab = ({ merchant, toast }: { merchant: MerchantInfo | null; toast: any }) => {
  const [links, setLinks] = useState<{ id: string; amount: number | null; note: string; createdAt: Date; url: string }[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const merchantCode = merchant?.qr_code_data || `MRC-${merchant?.id?.slice(0, 8) || "UNKNOWN"}`;

  const generateLink = () => {
    const id = Math.random().toString(36).slice(2, 10).toUpperCase();
    const parsedAmount = amount ? parseFloat(amount) : null;

    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      toast({ title: "Invalid amount", description: "Please enter a valid positive amount", variant: "destructive" });
      return;
    }
    if (parsedAmount !== null && parsedAmount > 1000000) {
      toast({ title: "Amount too high", description: "Maximum amount is ৳10,00,000", variant: "destructive" });
      return;
    }

    const params = new URLSearchParams({ merchant: merchantCode, ref: id });
    if (parsedAmount) params.set("amount", parsedAmount.toString());
    if (note.trim()) params.set("note", note.trim());

    const url = `${baseUrl}/pay?${params.toString()}`;

    setLinks(prev => [{
      id,
      amount: parsedAmount,
      note: note.trim(),
      createdAt: new Date(),
      url,
    }, ...prev]);

    setAmount("");
    setNote("");
    toast({ title: "Payment link created!", description: "Share it with your customer" });
  };

  const copyLink = (link: typeof links[0]) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    toast({ title: "Link copied!", description: "Payment link copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareLink = async (link: typeof links[0]) => {
    const text = `Pay ${merchant?.business_name || "merchant"}${link.amount ? ` ৳${fmt(link.amount)}` : ""}${link.note ? ` — ${link.note}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Payment Link", text, url: link.url });
      } catch {}
    } else {
      copyLink(link);
    }
  };

  const removeLink = (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Create link card */}
      <motion.div variants={stagger.item}>
        <Card className="p-5 border-0 shadow-elevated relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5" style={{
            background: "radial-gradient(circle, hsl(24 90% 50%) 0%, transparent 70%)"
          }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Link size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Create Payment Link</h3>
                <p className="text-[10px] text-muted-foreground">Share with customers for remote payments</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                  Amount (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">৳</span>
                  <Input
                    type="number"
                    placeholder="Leave empty for any amount"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pl-8 h-11 rounded-xl border-border/50 bg-muted/30 focus:bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                  Note / Description
                </label>
                <Input
                  placeholder="e.g. Invoice #123, Order for blue shirt"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  maxLength={100}
                  className="h-11 rounded-xl border-border/50 bg-muted/30 focus:bg-background"
                />
              </div>

              <Button
                onClick={generateLink}
                className="w-full h-12 rounded-xl text-sm font-bold shadow-glow"
                style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
              >
                <Plus size={16} className="mr-1.5" /> Generate Payment Link
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* How it works */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-primary" /> How It Works
          </h3>
          <div className="space-y-3">
            {[
              { step: "1", title: "Create a link", desc: "Set amount & note, generate a unique payment link" },
              { step: "2", title: "Share with customer", desc: "Send via SMS, WhatsApp, email, or any messenger" },
              { step: "3", title: "Get paid instantly", desc: "Customer pays through the link, money hits your account" },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{s.step}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Generated links */}
      {links.length > 0 && (
        <motion.div variants={stagger.item}>
          <Card className="p-4 border-0 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">Your Payment Links</h3>
              <Badge variant="secondary" className="text-[9px]">{links.length} links</Badge>
            </div>
            <div className="space-y-2.5">
              {links.map(link => (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-muted/30 border border-border/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-foreground">
                          {link.amount ? `৳${fmt(link.amount)}` : "Open Amount"}
                        </span>
                        <Badge variant="secondary" className="text-[8px]">#{link.id}</Badge>
                      </div>
                      {link.note && (
                        <p className="text-[10px] text-muted-foreground truncate">{link.note}</p>
                      )}
                    </div>
                    <button onClick={() => removeLink(link.id)} className="tap-target text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* URL preview */}
                  <div className="bg-background/60 rounded-lg p-2 mb-2.5">
                    <p className="text-[9px] text-muted-foreground font-mono truncate">{link.url}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-lg text-[11px]"
                      onClick={() => copyLink(link)}
                    >
                      {copiedId === link.id ? (
                        <><Check size={12} className="mr-1 text-primary" /> Copied!</>
                      ) : (
                        <><Copy size={12} className="mr-1" /> Copy Link</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-lg text-[11px]"
                      onClick={() => shareLink(link)}
                    >
                      <Share2 size={12} className="mr-1" /> Share
                    </Button>
                  </div>

                  <p className="text-[8px] text-muted-foreground mt-2 text-right">
                    Created {link.createdAt.toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Benefits */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">Why Use Payment Links?</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Globe, title: "Remote Payments", desc: "Accept payments from anywhere" },
              { icon: Zap, title: "Instant Setup", desc: "No extra hardware needed" },
              { icon: ShieldCheck, title: "Secure", desc: "End-to-end encrypted" },
              { icon: Receipt, title: "Auto Tracked", desc: "All transactions logged" },
            ].map(b => (
              <div key={b.title} className="p-3 rounded-xl bg-muted/30 text-center">
                <b.icon size={16} className="text-primary mx-auto mb-1.5" />
                <p className="text-[11px] font-semibold text-foreground">{b.title}</p>
                <p className="text-[9px] text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default MerchantDashboard;
