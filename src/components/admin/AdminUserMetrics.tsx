import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, UserCheck, UserX, UserPlus, Activity, Clock, ShieldCheck, ShieldAlert,
  Smartphone, Wallet, ArrowLeftRight, Send, Banknote, Receipt, CreditCard,
  Phone, Zap, ShoppingBag, Gift, Ticket, Star, TrendingUp, AlertTriangle,
  Lock, Fingerprint, Bell, Heart, Coins, type LucideIcon
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Metric = {
  key: string;
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: string;
  hint?: string;
};

type Section = {
  title: string;
  metrics: Metric[];
};

// Map bg-* color to a matching gradient + ring + glow tone using arbitrary opacity classes
const COLOR_TONES: Record<string, { grad: string; ring: string; text: string; glow: string }> = {
  "bg-primary":      { grad: "from-primary/30 to-primary/5",          ring: "ring-primary/40",        text: "text-primary",        glow: "shadow-primary/20" },
  "bg-emerald-500":  { grad: "from-emerald-500/30 to-emerald-500/5",  ring: "ring-emerald-500/40",    text: "text-emerald-500",    glow: "shadow-emerald-500/20" },
  "bg-rose-500":     { grad: "from-rose-500/30 to-rose-500/5",        ring: "ring-rose-500/40",       text: "text-rose-500",       glow: "shadow-rose-500/20" },
  "bg-cyan-500":     { grad: "from-cyan-500/30 to-cyan-500/5",        ring: "ring-cyan-500/40",       text: "text-cyan-500",       glow: "shadow-cyan-500/20" },
  "bg-blue-500":     { grad: "from-blue-500/30 to-blue-500/5",        ring: "ring-blue-500/40",       text: "text-blue-500",       glow: "shadow-blue-500/20" },
  "bg-indigo-500":   { grad: "from-indigo-500/30 to-indigo-500/5",    ring: "ring-indigo-500/40",     text: "text-indigo-500",     glow: "shadow-indigo-500/20" },
  "bg-teal-500":     { grad: "from-teal-500/30 to-teal-500/5",        ring: "ring-teal-500/40",       text: "text-teal-500",       glow: "shadow-teal-500/20" },
  "bg-amber-500":    { grad: "from-amber-500/30 to-amber-500/5",      ring: "ring-amber-500/40",      text: "text-amber-500",      glow: "shadow-amber-500/20" },
  "bg-orange-500":   { grad: "from-orange-500/30 to-orange-500/5",    ring: "ring-orange-500/40",     text: "text-orange-500",     glow: "shadow-orange-500/20" },
  "bg-violet-500":   { grad: "from-violet-500/30 to-violet-500/5",    ring: "ring-violet-500/40",     text: "text-violet-500",     glow: "shadow-violet-500/20" },
  "bg-pink-500":     { grad: "from-pink-500/30 to-pink-500/5",        ring: "ring-pink-500/40",       text: "text-pink-500",       glow: "shadow-pink-500/20" },
  "bg-fuchsia-500":  { grad: "from-fuchsia-500/30 to-fuchsia-500/5",  ring: "ring-fuchsia-500/40",    text: "text-fuchsia-500",    glow: "shadow-fuchsia-500/20" },
  "bg-red-500":      { grad: "from-red-500/30 to-red-500/5",          ring: "ring-red-500/40",        text: "text-red-500",        glow: "shadow-red-500/20" },
  "bg-yellow-500":   { grad: "from-yellow-500/30 to-yellow-500/5",    ring: "ring-yellow-500/40",     text: "text-yellow-500",     glow: "shadow-yellow-500/20" },
};

function MetricCard({ m, onClick }: { m: Metric; onClick?: (key: string) => void }) {
  const Icon = m.icon;
  const clickable = !!onClick;
  const tone = COLOR_TONES[m.color] ?? COLOR_TONES["bg-primary"];
  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onClick!(m.key) : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(m.key); }
      } : undefined}
      className={`group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-sm transition-all duration-300 p-3 sm:p-4 ${clickable ? `cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:${tone.glow} hover:ring-2 hover:${tone.ring} focus:outline-none focus:ring-2 focus:${tone.ring}` : ""}`}
    >
      {/* Gradient accent strip */}
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${tone.grad} opacity-80`} />
      {/* Radial glow behind icon */}
      <div className={`absolute -top-8 -left-8 w-24 h-24 rounded-full bg-gradient-to-br ${tone.grad} blur-2xl opacity-50 group-hover:opacity-80 transition-opacity`} />

      <div className="relative flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${tone.grad} ring-1 ring-inset ring-border/40 grid place-items-center group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${tone.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs text-muted-foreground/80 uppercase tracking-wider font-medium truncate">{m.label}</div>
          <div className="text-lg sm:text-2xl font-bold text-foreground tabular-nums leading-tight mt-0.5">{m.value}</div>
          {m.hint && <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{m.hint}</div>}
        </div>
      </div>

      {clickable && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70">
          Click ↗
        </div>
      )}
    </Card>
  );
}

function SectionBlock({ section, loading, onCardClick }: { section: Section; loading: boolean; onCardClick?: (key: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <h3 className="text-xs sm:text-sm font-semibold text-foreground/80 uppercase tracking-[0.15em]">
          {section.title}
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
        {section.metrics.map((m, i) =>
          loading ? (
            <Skeleton key={i} className="h-[84px] sm:h-[100px] rounded-2xl" />
          ) : (
            <MetricCard key={i} m={m} onClick={onCardClick} />
          )
        )}
      </div>
    </div>
  );
}

export function AdminUserMetrics({ onCardClick }: { onCardClick?: (key: string) => void } = {}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const c = (q: any) => q.then((r: any) => r.count ?? 0);

    const [
      totalUsers, activeUsers, suspendedUsers, kycExempt,
      newToday, new7d, new30d,
      totalTxn, txnToday, txn7d,
      sendMoney, cashOut, cashIn, addMoney, payment, recharge, billPay, bankTransfer,
      shopOrders, giftCards, donations, savings,
      referralsCount, rewardsClaimed,
      featureLocks, fraudAlerts, devices, pinChanges, complaints,
      rpcRes,
    ] = await Promise.all([
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "suspended").not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_exempt", true)),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", day1).not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", day7).not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", day30).not("phone", "like", "staff-%")),
      c(supabase.from("transactions").select("id", { count: "exact", head: true })),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).gte("created_at", day1)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).gte("created_at", day7)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "send").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "cashout").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "cashin").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "addmoney").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "payment").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "recharge").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "paybill").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "banktransfer").gte("created_at", day30)),
      c(supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", day30)),
      c(supabase.from("gift_cards").select("id", { count: "exact", head: true }).gte("created_at", day30)),
      c(supabase.from("donations").select("id", { count: "exact", head: true }).gte("created_at", day30)),
      c(supabase.from("gold_holdings").select("id", { count: "exact", head: true })),
      c(supabase.from("referrals").select("id", { count: "exact", head: true })),
      c(supabase.from("ai_auto_rewards").select("id", { count: "exact", head: true }).eq("status", "claimed")),
      c(supabase.from("feature_locks").select("id", { count: "exact", head: true }).eq("is_active", true)),
      c(supabase.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("status", "open")),
      c(supabase.from("device_registrations").select("id", { count: "exact", head: true })),
      c(supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "pin_changed").gte("created_at", day30)),
      c(supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open")),
      (supabase.rpc as any)("admin_user_metrics").then((r: any) => r.data ?? {}),
    ]);

    const m = rpcRes || {};
    setData({
      totalUsers, activeUsers, suspendedUsers,
      kycVerified: Number(m.kyc_verified ?? 0),
      kycPending: Number(m.kyc_pending ?? 0),
      kycRejected: Number(m.kyc_rejected ?? 0),
      kycExempt,
      newToday, new7d, new30d,
      dau: Number(m.dau ?? 0),
      wau: Number(m.wau ?? 0),
      mau: Number(m.mau ?? 0),
      inactive30: Number(m.inactive_30d ?? 0),
      dormant90: Number(m.dormant_90d ?? 0),
      totalTxn, txnToday, txn7d,
      sendMoney, cashOut, cashIn, addMoney, payment, recharge, billPay, bankTransfer,
      shopOrders, giftCards, donations, savings,
      couponsUsed: Number(m.coupons_used ?? 0),
      referralsCount, rewardsClaimed,
      featureLocks, fraudAlerts, devices, pinChanges, complaints,
      avgBalance: Number(m.avg_balance ?? 0),
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const d = data ?? {};
  const fmt = (n: number) => n?.toLocaleString?.() ?? "0";
  const tk = (n: number) => `৳${(n ?? 0).toLocaleString()}`;

  const sections: Section[] = [
    {
      title: "👥 User Base",
      metrics: [
        { key: "all", label: "Total Users", value: fmt(d.totalUsers), icon: Users, color: "bg-primary" },
        { key: "active", label: "Active", value: fmt(d.activeUsers), icon: UserCheck, color: "bg-emerald-500" },
        { key: "suspended", label: "Suspended", value: fmt(d.suspendedUsers), icon: UserX, color: "bg-rose-500" },
        { key: "new_today", label: "New Today", value: fmt(d.newToday), icon: UserPlus, color: "bg-cyan-500" },
        { key: "new_7d", label: "New (7d)", value: fmt(d.new7d), icon: UserPlus, color: "bg-blue-500" },
        { key: "new_30d", label: "New (30d)", value: fmt(d.new30d), icon: UserPlus, color: "bg-indigo-500" },
      ],
    },
    {
      title: "📊 Activity & Engagement",
      metrics: [
        { key: "dau", label: "DAU", value: fmt(d.dau), icon: Activity, color: "bg-emerald-500", hint: "Daily Active" },
        { key: "wau", label: "WAU", value: fmt(d.wau), icon: Activity, color: "bg-teal-500", hint: "Weekly Active" },
        { key: "mau", label: "MAU", value: fmt(d.mau), icon: Activity, color: "bg-blue-500", hint: "Monthly Active" },
        { key: "inactive_30d", label: "Inactive 30d", value: fmt(d.inactive30), icon: Clock, color: "bg-amber-500", hint: "No txn in 30d" },
        { key: "dormant_90d", label: "Dormant 90d", value: fmt(d.dormant90), icon: Clock, color: "bg-orange-500", hint: "No txn in 90d" },
        { key: "high_balance", label: "Avg Balance", value: tk(d.avgBalance), icon: Wallet, color: "bg-violet-500", hint: "Click: top balances" },
      ],
    },
    {
      title: "🔐 KYC & Verification",
      metrics: [
        { key: "kyc_verified", label: "Verified", value: fmt(d.kycVerified), icon: ShieldCheck, color: "bg-emerald-500" },
        { key: "kyc_pending", label: "Pending", value: fmt(d.kycPending), icon: Clock, color: "bg-amber-500" },
        { key: "kyc_rejected", label: "Rejected", value: fmt(d.kycRejected), icon: ShieldAlert, color: "bg-rose-500" },
        { key: "kyc_exempt", label: "Exempt", value: fmt(d.kycExempt), icon: Star, color: "bg-violet-500" },
        { key: "tab:devices", label: "Devices", value: fmt(d.devices), icon: Smartphone, color: "bg-cyan-500" },
        { key: "tab:pin-history", label: "PIN Changes", value: fmt(d.pinChanges), icon: Fingerprint, color: "bg-blue-500", hint: "Last 30d" },
      ],
    },
    {
      title: "💸 Feature Usage (30d)",
      metrics: [
        { key: "txn:send", label: "Send Money", value: fmt(d.sendMoney), icon: Send, color: "bg-emerald-500" },
        { key: "txn:cashout", label: "Cash Out", value: fmt(d.cashOut), icon: Banknote, color: "bg-rose-500" },
        { key: "txn:cashin", label: "Cash In", value: fmt(d.cashIn), icon: Wallet, color: "bg-blue-500" },
        { key: "txn:addmoney", label: "Add Money", value: fmt(d.addMoney), icon: CreditCard, color: "bg-cyan-500" },
        { key: "txn:payment", label: "Payment", value: fmt(d.payment), icon: Receipt, color: "bg-indigo-500" },
        { key: "txn:recharge", label: "Recharge", value: fmt(d.recharge), icon: Phone, color: "bg-orange-500" },
        { key: "txn:paybill", label: "Bill Pay", value: fmt(d.billPay), icon: Zap, color: "bg-amber-500" },
        { key: "txn:banktransfer", label: "Bank Transfer", value: fmt(d.bankTransfer), icon: ArrowLeftRight, color: "bg-violet-500" },
        { key: "tab:ecommerce", label: "Shop Orders", value: fmt(d.shopOrders), icon: ShoppingBag, color: "bg-pink-500" },
        { key: "tab:gift-cards", label: "Gift Cards", value: fmt(d.giftCards), icon: Gift, color: "bg-fuchsia-500" },
        { key: "tab:donations", label: "Donations", value: fmt(d.donations), icon: Heart, color: "bg-red-500" },
        { key: "tab:savings", label: "Savings/Gold", value: fmt(d.savings), icon: Coins, color: "bg-yellow-500" },
      ],
    },
    {
      title: "🎁 Rewards & Marketing",
      metrics: [
        { key: "tab:marketing", label: "Coupons Used", value: fmt(d.couponsUsed), icon: Ticket, color: "bg-pink-500", hint: "Last 30d" },
        { key: "tab:referrals", label: "Referrals", value: fmt(d.referralsCount), icon: UserPlus, color: "bg-emerald-500" },
        { key: "tab:user-tracker", label: "AI Rewards", value: fmt(d.rewardsClaimed), icon: Star, color: "bg-amber-500", hint: "Claimed" },
        { key: "tab:transactions", label: "Total Txns", value: fmt(d.totalTxn), icon: ArrowLeftRight, color: "bg-blue-500" },
        { key: "tab:transactions", label: "Txn Today", value: fmt(d.txnToday), icon: TrendingUp, color: "bg-cyan-500" },
        { key: "tab:transactions", label: "Txn (7d)", value: fmt(d.txn7d), icon: TrendingUp, color: "bg-indigo-500" },
      ],
    },
    {
      title: "🛡️ Risk & Safety",
      metrics: [
        { key: "tab:feature-locks", label: "Locked Features", value: fmt(d.featureLocks), icon: Lock, color: "bg-rose-500" },
        { key: "tab:alerts", label: "Open Alerts", value: fmt(d.fraudAlerts), icon: AlertTriangle, color: "bg-orange-500" },
        { key: "tab:complaints", label: "Open Disputes", value: fmt(d.complaints), icon: Bell, color: "bg-amber-500" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {sections.map((s, i) => (
        <SectionBlock key={i} section={s} loading={loading} onCardClick={onCardClick} />
      ))}
    </div>
  );
}
