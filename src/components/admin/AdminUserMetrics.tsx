import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, UserCheck, UserX, UserPlus, Activity, Clock, ShieldCheck, ShieldAlert,
  Smartphone, Wallet, ArrowLeftRight, Send, Banknote, Receipt, CreditCard,
  Phone, Zap, ShoppingBag, Gift, Ticket, Star, TrendingUp, AlertTriangle,
  Lock, Fingerprint, Bell, Heart, PiggyBank, Coins, type LucideIcon
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Metric = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: string; // tailwind class for top border + icon
  hint?: string;
};

type Section = {
  title: string;
  metrics: Metric[];
};

function MetricCard({ m }: { m: Metric }) {
  const Icon = m.icon;
  return (
    <Card className={`relative overflow-hidden border-0 shadow-[var(--shadow-card)] hover:shadow-lg transition-all p-3 sm:p-4 group`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${m.color}`} />
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${m.color} bg-opacity-10 grid place-items-center group-hover:scale-110 transition-transform`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide truncate">{m.label}</div>
          <div className="text-base sm:text-xl font-bold text-foreground tabular-nums">{m.value}</div>
          {m.hint && <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{m.hint}</div>}
        </div>
      </div>
    </Card>
  );
}

function SectionBlock({ section, loading }: { section: Section; loading: boolean }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
        {section.title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
        {section.metrics.map((m, i) =>
          loading ? (
            <Skeleton key={i} className="h-[72px] sm:h-[88px] rounded-lg" />
          ) : (
            <MetricCard key={i} m={m} />
          )
        )}
      </div>
    </div>
  );
}

export function AdminUserMetrics() {
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
      totalUsers, activeUsers, suspendedUsers, kycVerified, kycPending, kycRejected, kycExempt,
      newToday, new7d, new30d,
      dau, wau, mau, inactive30, dormant90,
      totalTxn, txnToday, txn7d,
      sendMoney, cashOut, cashIn, addMoney, payment, recharge, billPay, bankTransfer,
      shopOrders, giftCards, donations, savings,
      couponsUsed, referralsCount, rewardsClaimed,
      featureLocks, fraudAlerts, devices, pinChanges, complaints,
      avgBalance,
    ] = await Promise.all([
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "suspended").not("phone", "like", "staff-%")),
      c(supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "approved")),
      c(supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "pending")),
      c(supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "rejected")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_exempt", true)),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", day1).not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", day7).not("phone", "like", "staff-%")),
      c(supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", day30).not("phone", "like", "staff-%")),
      supabase.from("transactions").select("user_id").gte("created_at", day1).then((r: any) => new Set((r.data ?? []).map((x: any) => x.user_id)).size),
      supabase.from("transactions").select("user_id").gte("created_at", day7).then((r: any) => new Set((r.data ?? []).map((x: any) => x.user_id)).size),
      supabase.from("transactions").select("user_id").gte("created_at", day30).then((r: any) => new Set((r.data ?? []).map((x: any) => x.user_id)).size),
      supabase.from("profiles").select("user_id").lt("created_at", day30).not("phone", "like", "staff-%").then(async (r: any) => {
        const allOldUsers = new Set((r.data ?? []).map((x: any) => x.user_id));
        const active = await supabase.from("transactions").select("user_id").gte("created_at", day30);
        const activeSet = new Set((active.data ?? []).map((x: any) => x.user_id));
        return [...allOldUsers].filter(u => !activeSet.has(u)).length;
      }),
      supabase.from("profiles").select("user_id").lt("created_at", day90).not("phone", "like", "staff-%").then(async (r: any) => {
        const allOld = new Set((r.data ?? []).map((x: any) => x.user_id));
        const active = await supabase.from("transactions").select("user_id").gte("created_at", day90);
        const activeSet = new Set((active.data ?? []).map((x: any) => x.user_id));
        return [...allOld].filter(u => !activeSet.has(u)).length;
      }),
      c(supabase.from("transactions").select("id", { count: "exact", head: true })),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).gte("created_at", day1)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).gte("created_at", day7)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "send_money").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "cash_out").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "cash_in").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "add_money").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "payment").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "mobile_recharge").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "pay_bill").gte("created_at", day30)),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "bank_transfer").gte("created_at", day30)),
      c(supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", day30)),
      c(supabase.from("gift_cards").select("id", { count: "exact", head: true }).gte("created_at", day30)),
      c(supabase.from("donations").select("id", { count: "exact", head: true }).gte("created_at", day30)),
      c(supabase.from("gold_holdings").select("id", { count: "exact", head: true })),
      c(supabase.from("transactions").select("id", { count: "exact", head: true }).not("metadata->>coupon_code", "is", null).gte("created_at", day30)),
      c(supabase.from("referrals").select("id", { count: "exact", head: true })),
      c(supabase.from("ai_auto_rewards").select("id", { count: "exact", head: true }).eq("status", "claimed")),
      c(supabase.from("feature_locks").select("id", { count: "exact", head: true }).eq("is_active", true)),
      c(supabase.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("status", "open")),
      c(supabase.from("device_registrations").select("id", { count: "exact", head: true })),
      c(supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "pin_changed").gte("created_at", day30)),
      c(supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open")),
      supabase.from("profiles").select("balance").not("phone", "like", "staff-%").then((r: any) => {
        const arr = (r.data ?? []).map((x: any) => Number(x.balance || 0));
        return arr.length ? Math.round(arr.reduce((a: number, b: number) => a + b, 0) / arr.length) : 0;
      }),
    ]);

    setData({
      totalUsers, activeUsers, suspendedUsers, kycVerified, kycPending, kycRejected, kycExempt,
      newToday, new7d, new30d, dau, wau, mau, inactive30, dormant90,
      totalTxn, txnToday, txn7d,
      sendMoney, cashOut, cashIn, addMoney, payment, recharge, billPay, bankTransfer,
      shopOrders, giftCards, donations, savings,
      couponsUsed, referralsCount, rewardsClaimed,
      featureLocks, fraudAlerts, devices, pinChanges, complaints, avgBalance,
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
        { label: "Total Users", value: fmt(d.totalUsers), icon: Users, color: "bg-primary" },
        { label: "Active", value: fmt(d.activeUsers), icon: UserCheck, color: "bg-emerald-500" },
        { label: "Suspended", value: fmt(d.suspendedUsers), icon: UserX, color: "bg-rose-500" },
        { label: "New Today", value: fmt(d.newToday), icon: UserPlus, color: "bg-cyan-500" },
        { label: "New (7d)", value: fmt(d.new7d), icon: UserPlus, color: "bg-blue-500" },
        { label: "New (30d)", value: fmt(d.new30d), icon: UserPlus, color: "bg-indigo-500" },
      ],
    },
    {
      title: "📊 Activity & Engagement",
      metrics: [
        { label: "DAU", value: fmt(d.dau), icon: Activity, color: "bg-emerald-500", hint: "Daily Active" },
        { label: "WAU", value: fmt(d.wau), icon: Activity, color: "bg-teal-500", hint: "Weekly Active" },
        { label: "MAU", value: fmt(d.mau), icon: Activity, color: "bg-blue-500", hint: "Monthly Active" },
        { label: "Inactive 30d", value: fmt(d.inactive30), icon: Clock, color: "bg-amber-500" },
        { label: "Dormant 90d", value: fmt(d.dormant90), icon: Clock, color: "bg-orange-500" },
        { label: "Avg Balance", value: tk(d.avgBalance), icon: Wallet, color: "bg-violet-500" },
      ],
    },
    {
      title: "🔐 KYC & Verification",
      metrics: [
        { label: "Verified", value: fmt(d.kycVerified), icon: ShieldCheck, color: "bg-emerald-500" },
        { label: "Pending", value: fmt(d.kycPending), icon: Clock, color: "bg-amber-500" },
        { label: "Rejected", value: fmt(d.kycRejected), icon: ShieldAlert, color: "bg-rose-500" },
        { label: "Exempt", value: fmt(d.kycExempt), icon: Star, color: "bg-violet-500" },
        { label: "Devices", value: fmt(d.devices), icon: Smartphone, color: "bg-cyan-500" },
        { label: "PIN Changes", value: fmt(d.pinChanges), icon: Fingerprint, color: "bg-blue-500", hint: "Last 30d" },
      ],
    },
    {
      title: "💸 Feature Usage (30d)",
      metrics: [
        { label: "Send Money", value: fmt(d.sendMoney), icon: Send, color: "bg-emerald-500" },
        { label: "Cash Out", value: fmt(d.cashOut), icon: Banknote, color: "bg-rose-500" },
        { label: "Cash In", value: fmt(d.cashIn), icon: Wallet, color: "bg-blue-500" },
        { label: "Add Money", value: fmt(d.addMoney), icon: CreditCard, color: "bg-cyan-500" },
        { label: "Payment", value: fmt(d.payment), icon: Receipt, color: "bg-indigo-500" },
        { label: "Recharge", value: fmt(d.recharge), icon: Phone, color: "bg-orange-500" },
        { label: "Bill Pay", value: fmt(d.billPay), icon: Zap, color: "bg-amber-500" },
        { label: "Bank Transfer", value: fmt(d.bankTransfer), icon: ArrowLeftRight, color: "bg-violet-500" },
        { label: "Shop Orders", value: fmt(d.shopOrders), icon: ShoppingBag, color: "bg-pink-500" },
        { label: "Gift Cards", value: fmt(d.giftCards), icon: Gift, color: "bg-fuchsia-500" },
        { label: "Donations", value: fmt(d.donations), icon: Heart, color: "bg-red-500" },
        { label: "Savings/Gold", value: fmt(d.savings), icon: Coins, color: "bg-yellow-500" },
      ],
    },
    {
      title: "🎁 Rewards & Marketing",
      metrics: [
        { label: "Coupons Used", value: fmt(d.couponsUsed), icon: Ticket, color: "bg-pink-500", hint: "Last 30d" },
        { label: "Referrals", value: fmt(d.referralsCount), icon: UserPlus, color: "bg-emerald-500" },
        { label: "AI Rewards", value: fmt(d.rewardsClaimed), icon: Star, color: "bg-amber-500", hint: "Claimed" },
        { label: "Total Txns", value: fmt(d.totalTxn), icon: ArrowLeftRight, color: "bg-blue-500" },
        { label: "Txn Today", value: fmt(d.txnToday), icon: TrendingUp, color: "bg-cyan-500" },
        { label: "Txn (7d)", value: fmt(d.txn7d), icon: TrendingUp, color: "bg-indigo-500" },
      ],
    },
    {
      title: "🛡️ Risk & Safety",
      metrics: [
        { label: "Locked Features", value: fmt(d.featureLocks), icon: Lock, color: "bg-rose-500" },
        { label: "Open Alerts", value: fmt(d.fraudAlerts), icon: AlertTriangle, color: "bg-orange-500" },
        { label: "Open Disputes", value: fmt(d.complaints), icon: Bell, color: "bg-amber-500" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {sections.map((s, i) => (
        <SectionBlock key={i} section={s} loading={loading} />
      ))}
    </div>
  );
}
