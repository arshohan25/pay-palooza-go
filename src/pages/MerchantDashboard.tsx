import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, QrCode, BarChart3, Wallet, Clock,
  Shield, Building2, Store, TrendingUp, DollarSign, Copy,
  CheckCircle2, Calendar, ArrowUpDown, Download, CreditCard,
  Percent, Receipt, ChevronRight, Eye, BanknoteIcon, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

/* ─── Types ─── */
type MerchTab = "overview" | "qr" | "transactions" | "settlements" | "mdr";

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
  { id: "transactions", icon: ArrowUpDown,  label: "Transactions" },
  { id: "settlements",  icon: BanknoteIcon, label: "Settlements" },
  { id: "mdr",          icon: Percent,       label: "MDR" },
];

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
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!isAuthenticated) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6"><Shield size={48} className="text-muted-foreground" /><p className="text-lg font-semibold text-foreground">Login required</p><Button onClick={() => navigate("/")} variant="outline">Go to Login</Button></div>;
  }
  if (isMerchant === false) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center"><Store size={48} className="text-muted-foreground" /><p className="text-lg font-semibold text-foreground">Merchant Access Required</p><p className="text-sm text-muted-foreground max-w-xs">Register as a merchant to access this dashboard.</p><Button onClick={() => navigate("/")} variant="outline"><ArrowLeft size={16} className="mr-2" />Back to Home</Button></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="relative overflow-hidden px-4 pt-6 pb-20" style={{
        background: "linear-gradient(150deg, hsl(24 85% 48%) 0%, hsl(16 80% 38%) 50%, hsl(8 72% 30%) 100%)"
      }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 75% 25%, hsl(0 0% 100% / 0.3) 0%, transparent 50%)" }} />
        <div className="relative max-w-xl mx-auto text-primary-foreground">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate("/")} className="tap-target"><ArrowLeft size={22} /></button>
            <div className="flex items-center gap-1.5"><Store size={16} /><h1 className="text-lg font-bold">Merchant Portal</h1></div>
            <button onClick={loadData} className="tap-target"><RefreshCw size={18} /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl gradient-glass flex items-center justify-center"><Store size={22} /></div>
            <div>
              <p className="font-bold text-base">{merchant?.business_name || "Merchant"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className="text-[9px] bg-white/20 border-0 text-white capitalize">{merchant?.category || "retail"}</Badge>
                <Badge className="text-[9px] bg-white/20 border-0 text-white">{merchant?.settlement_frequency || "T+1"}</Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Stats strip ── */}
      <div className="max-w-xl mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Balance", value: `৳${fmt(balance)}`, icon: Wallet },
            { label: "Today's Sales", value: `৳${fmt(paymentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString()).reduce((s, t) => s + t.amount, 0))}`, icon: TrendingUp },
            { label: "Total Txns", value: paymentTxns.length.toString(), icon: Receipt },
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
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all press-effect ${
                  active ? "text-primary-foreground shadow-glow" : "bg-card text-muted-foreground border border-border"
                }`}
                style={active ? { background: "linear-gradient(135deg, hsl(24 85% 48%), hsl(16 80% 38%))" } : undefined}
              >
                <t.icon size={14} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-xl mx-auto px-4 py-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
            {activeTab === "overview"     && <MerchOverview merchant={merchant} balance={balance} paymentTxns={paymentTxns} />}
            {activeTab === "qr"           && <QRTab merchant={merchant} toast={toast} />}
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
/* ── Overview ── */
const MerchOverview = ({ merchant, balance, paymentTxns }: { merchant: MerchantInfo | null; balance: number; paymentTxns: TxnRow[] }) => {
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const mdrDeducted = Math.round(totalRevenue * (merchant?.mdr_rate ?? 0.015));
  const avgTxn = paymentTxns.length > 0 ? Math.round(totalRevenue / paymentTxns.length) : 0;

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Revenue", value: `৳${fmt(totalRevenue)}`, icon: DollarSign, color: "bg-primary/10 text-primary" },
          { label: "MDR Deducted", value: `৳${fmt(mdrDeducted)}`, icon: Percent, color: "bg-destructive/10 text-destructive" },
          { label: "Net Earnings", value: `৳${fmt(totalRevenue - mdrDeducted)}`, icon: TrendingUp, color: "bg-accent/10 text-accent" },
          { label: "Avg Transaction", value: `৳${fmt(avgTxn)}`, icon: Receipt, color: "bg-primary/10 text-primary" },
        ].map(s => (
          <Card key={s.label} className="p-3 border-0 shadow-card">
            <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
              <s.icon size={16} />
            </div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* 7-day chart */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-primary" /> Last 7 Days
        </h3>
        <div className="flex items-end gap-2 h-28">
          {last7.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <p className="text-[8px] text-muted-foreground font-medium">৳{d.amount > 999 ? `${(d.amount / 1000).toFixed(0)}k` : d.amount}</p>
              <div className="w-full rounded-t-md transition-all" style={{
                height: `${Math.max(4, (d.amount / maxDay) * 80)}px`,
                background: i === 6 ? "linear-gradient(180deg, hsl(24 85% 48%), hsl(16 80% 38%))" : "hsl(var(--muted))"
              }} />
              <p className="text-[9px] text-muted-foreground">{d.day}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent payments */}
      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Recent Payments</h3>
        {paymentTxns.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No payments yet</p>
        ) : (
          <div className="space-y-2">
            {paymentTxns.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard size={13} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{tx.recipient_name || "Customer"}</p>
                    <p className="text-[9px] text-muted-foreground">{tx.reference}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">+৳{fmt(tx.amount)}</p>
                  <p className="text-[9px] text-muted-foreground">{new Date(tx.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
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
    <div className="space-y-4">
      <Card className="p-6 border-0 shadow-card text-center">
        <h3 className="text-sm font-bold text-foreground mb-1">Your Payment QR Code</h3>
        <p className="text-[10px] text-muted-foreground mb-4">Customers scan this to pay you instantly</p>

        {qrDataUrl ? (
          <div className="inline-block p-4 bg-white rounded-2xl shadow-elevated mb-4">
            <img src={qrDataUrl} alt="Merchant QR" className="w-56 h-56" />
          </div>
        ) : (
          <div className="w-56 h-56 mx-auto bg-muted rounded-2xl flex items-center justify-center mb-4">
            <QrCode size={48} className="text-muted-foreground" />
          </div>
        )}

        <p className="text-sm font-bold text-foreground mb-1">{merchant?.business_name}</p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <code className="text-xs bg-muted px-3 py-1.5 rounded-lg text-foreground font-mono">{qrPayload}</code>
          <button onClick={copyCode} className="tap-target text-muted-foreground hover:text-foreground"><Copy size={14} /></button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => {
            if (!qrDataUrl) return;
            const link = document.createElement("a");
            link.download = `${merchant?.business_name || "merchant"}-qr.png`;
            link.href = qrDataUrl;
            link.click();
          }}>
            <Download size={14} className="mr-1.5" /> Download QR
          </Button>
          <Button variant="outline" className="flex-1" onClick={copyCode}>
            <Copy size={14} className="mr-1.5" /> Copy Code
          </Button>
        </div>
      </Card>

      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">QR Code Info</h3>
        <div className="space-y-2 text-xs">
          {[
            { label: "Merchant ID", value: qrPayload },
            { label: "Business", value: merchant?.business_name || "—" },
            { label: "Category", value: merchant?.category || "—" },
            { label: "MDR Rate", value: `${((merchant?.mdr_rate ?? 0.015) * 100).toFixed(2)}%` },
            { label: "Trade License", value: merchant?.trade_license || "—" },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold text-foreground capitalize">{r.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
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
    <div className="space-y-4">
      <Card className="p-4 border-0 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Payment History</h3>
          <p className="text-xs font-bold text-primary">৳{fmt(total)}</p>
        </div>

        <div className="flex gap-2 mb-4">
          {(["all", "today", "week"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >{f === "week" ? "This Week" : f === "all" ? `All (${txns.length})` : "Today"}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No transactions found</p>
        ) : (
          <div className="space-y-1">
            {filtered.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{tx.recipient_name || "Customer"}</p>
                    <p className="text-[9px] text-muted-foreground">{tx.reference} · {tx.recipient_phone || "—"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">+৳{fmt(tx.amount)}</p>
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
    </div>
  );
};

/* ── Settlement Tab ── */
const SettlementTab = ({ merchant, paymentTxns }: { merchant: MerchantInfo | null; paymentTxns: TxnRow[] }) => {
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const mdrRate = merchant?.mdr_rate ?? 0.015;
  const totalMDR = Math.round(totalRevenue * mdrRate);
  const netSettlement = totalRevenue - totalMDR;

  // Simulate settlement batches (grouped by day)
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
    <div className="space-y-4">
      <Card className="p-5 border-0 shadow-card" style={{ background: "linear-gradient(150deg, hsl(24 85% 48%) 0%, hsl(16 80% 38%) 100%)" }}>
        <p className="text-xs text-primary-foreground/80 font-medium">Net Settlement Amount</p>
        <p className="text-3xl font-bold text-primary-foreground mt-1">৳{fmt(netSettlement)}</p>
        <p className="text-[10px] text-primary-foreground/70 mt-1">After {(mdrRate * 100).toFixed(2)}% MDR deduction</p>
      </Card>

      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Bank Details</h3>
        <div className="space-y-2 text-xs">
          {[
            { label: "Bank", value: merchant?.bank_name || "Not configured" },
            { label: "Account", value: merchant?.bank_account_number ? `****${merchant.bank_account_number.slice(-4)}` : "—" },
            { label: "Routing", value: merchant?.bank_routing || "—" },
            { label: "Frequency", value: merchant?.settlement_frequency || "T+1" },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Settlement Batches</h3>
        {dailyBatches.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No settlements yet</p>
        ) : (
          <div className="space-y-2">
            {dailyBatches.map((b, i) => (
              <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">{b.date}</p>
                  </div>
                  <Badge variant="secondary" className="text-[9px]">{b.count} txns</Badge>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Gross: ৳{fmt(b.amount)}</span>
                  <span className="text-destructive">MDR: -৳{fmt(b.mdr)}</span>
                  <span className="font-bold text-primary">Net: ৳{fmt(b.amount - b.mdr)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── MDR Analytics Tab ── */
const MDRTab = ({ merchant, paymentTxns }: { merchant: MerchantInfo | null; paymentTxns: TxnRow[] }) => {
  const mdrRate = merchant?.mdr_rate ?? 0.015;
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const totalMDR = Math.round(totalRevenue * mdrRate);
  const avgTxnSize = paymentTxns.length > 0 ? Math.round(totalRevenue / paymentTxns.length) : 0;
  const avgMDRPerTxn = paymentTxns.length > 0 ? Math.round(totalMDR / paymentTxns.length) : 0;

  // Transaction size distribution
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
    <div className="space-y-4">
      <Card className="p-5 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Percent size={14} className="text-primary" /> MDR Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Your MDR Rate", value: `${(mdrRate * 100).toFixed(2)}%` },
            { label: "Total MDR Paid", value: `৳${fmt(totalMDR)}` },
            { label: "Avg MDR/Txn", value: `৳${fmt(avgMDRPerTxn)}` },
            { label: "Avg Txn Size", value: `৳${fmt(avgTxnSize)}` },
          ].map(m => (
            <div key={m.label} className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-lg font-bold text-foreground">{m.value}</p>
              <p className="text-[9px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">Transaction Size Distribution</h3>
        <div className="space-y-2.5">
          {distribution.map(d => (
            <div key={d.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">{d.label}</span>
                <span className="text-[10px] text-muted-foreground">{d.count} txns · ৳{fmt(d.volume)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${(d.count / maxCount) * 100}%`,
                  background: "linear-gradient(135deg, hsl(24 85% 48%), hsl(16 80% 38%))"
                }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 border-0 shadow-card">
        <h3 className="text-sm font-bold text-foreground mb-3">MDR Rate Comparison</h3>
        <div className="space-y-2 text-xs">
          {[
            { category: "Retail", rate: "1.50%", yours: merchant?.category === "retail" },
            { category: "Restaurant", rate: "1.50%", yours: merchant?.category === "restaurant" },
            { category: "Grocery", rate: "1.20%", yours: merchant?.category === "grocery" },
            { category: "Pharmacy", rate: "1.00%", yours: merchant?.category === "pharmacy" },
            { category: "Education", rate: "0.80%", yours: merchant?.category === "education" },
            { category: "Utility", rate: "0.50%", yours: merchant?.category === "utility" },
          ].map(r => (
            <div key={r.category} className={`flex items-center justify-between py-2 px-3 rounded-lg ${r.yours ? "bg-primary/5 border border-primary/20" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium capitalize">{r.category}</span>
                {r.yours && <Badge className="text-[8px] bg-primary/10 text-primary border-0">Your Category</Badge>}
              </div>
              <span className="font-bold text-foreground">{r.rate}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default MerchantDashboard;
