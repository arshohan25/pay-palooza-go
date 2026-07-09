import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Gift, BarChart3, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BudgetManager from "@/components/BudgetManager";
import { useSpendingBudgets } from "@/hooks/use-spending-budgets";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format, subMonths, startOfMonth, endOfMonth, differenceInCalendarMonths } from "date-fns";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface RawTxn {
  type: string;
  amount: number;
  created_at: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  description: string | null;
}

const OUTGOING_TYPES = ["send", "cashout", "payment", "recharge", "paybill"];
const INCOMING_TYPES = ["receive", "addmoney", "cashin"];

const CHART_COLORS = {
  Send: "hsl(262 70% 55%)",
  CashOut: "hsl(340 75% 55%)",
  Payment: "hsl(200 80% 50%)",
  Recharge: "hsl(36 95% 55%)",
};

const TYPE_TO_CATEGORY: Record<string, keyof typeof CHART_COLORS> = {
  send: "Send",
  cashout: "CashOut",
  payment: "Payment",
  paybill: "Payment",
  recharge: "Recharge",
};

const TYPE_EMOJI: Record<string, string> = {
  send: "💸",
  cashout: "🏧",
  payment: "🛒",
  paybill: "📄",
  recharge: "📱",
};

function getMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(d: Date) {
  return d.toLocaleString("en", { month: "short" });
}

/* ── Presets ── */
type PresetKey = "1M" | "3M" | "6M" | "1Y" | "custom";
const PRESETS: { key: PresetKey; label: string; months: number }[] = [
  { key: "1M", label: "1M", months: 1 },
  { key: "3M", label: "3M", months: 3 },
  { key: "6M", label: "6M", months: 6 },
  { key: "1Y", label: "1Y", months: 12 },
];

function getPresetRange(months: number): { from: Date; to: Date } {
  const now = new Date();
  return { from: startOfMonth(subMonths(now, months - 1)), to: now };
}

/* ── Custom bar tooltip ── */
const BarTooltip = ({ active, payload, label, totalLabel }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + p.value, 0);
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-elevated text-xs space-y-1 min-w-[130px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-foreground">৳{p.value.toLocaleString()}</span>
        </div>
      ))}
      <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold text-foreground">
        <span>{totalLabel}</span>
        <span>৳{total.toLocaleString()}</span>
      </div>
    </div>
  );
};

interface InsightsPageProps {
  onBack: () => void;
}

const SpendingInsightsPage = ({ onBack }: InsightsPageProps) => {
  const { t } = useI18n();
  const { budgets, spending, categoryLabel } = useSpendingBudgets();

  const [txns, setTxns] = useState<RawTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashbackTotal, setCashbackTotal] = useState(0);
  const [cashbackCount, setCashbackCount] = useState(0);
  const [cashbackLoading, setCashbackLoading] = useState(true);

  /* ── Date range state ── */
  const [activePreset, setActivePreset] = useState<PresetKey>("6M");
  const [dateRange, setDateRange] = useState(getPresetRange(6));
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [customOpen, setCustomOpen] = useState(false);

  const handlePreset = (p: typeof PRESETS[number]) => {
    setActivePreset(p.key);
    setDateRange(getPresetRange(p.months));
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      setDateRange({ from: startOfMonth(customFrom), to: endOfMonth(customTo) });
      setActivePreset("custom");
      setCustomOpen(false);
    }
  };

  // Fetch transactions for selected date range
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setCashbackLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); setCashbackLoading(false); return; }

      const fromISO = dateRange.from.toISOString();
      const toISO = dateRange.to.toISOString();

      const [txnRes, cbRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("type, amount, created_at, recipient_name, recipient_phone, description")
          .eq("user_id", session.user.id)
          .eq("status", "completed")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", session.user.id)
          .eq("type", "addmoney")
          .eq("status", "completed")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .like("description", "Drive Cashback:%"),
      ]);

      setTxns((txnRes.data as RawTxn[]) ?? []);
      setLoading(false);

      const cbTxns = cbRes.data ?? [];
      setCashbackTotal(cbTxns.reduce((s, t) => s + Number(t.amount), 0));
      setCashbackCount(cbTxns.length);
      setCashbackLoading(false);
    };
    fetchData();
  }, [dateRange]);

  // Generate month labels from dateRange
  const monthsMeta = useMemo(() => {
    const months: { key: string; label: string }[] = [];
    const totalMonths = differenceInCalendarMonths(dateRange.to, dateRange.from);
    for (let i = totalMonths; i >= 0; i--) {
      const d = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth() - i, 1);
      months.push({ key: getMonthKey(d), label: getMonthLabel(d) });
    }
    return months;
  }, [dateRange]);

  const currentMonthKey = monthsMeta[monthsMeta.length - 1]?.key ?? "";
  const prevMonthKey = monthsMeta.length >= 2 ? monthsMeta[monthsMeta.length - 2].key : null;
  const [activeMonth, setActiveMonth] = useState("");

  // Reset activeMonth when monthsMeta changes
  useEffect(() => {
    if (monthsMeta.length > 0) {
      setActiveMonth(monthsMeta[monthsMeta.length - 1].label);
    }
  }, [monthsMeta]);

  // Aggregate all data
  const { totalSent, totalReceived, sentPctChange, receivedPctChange, barData, donutData, topRecipients } = useMemo(() => {
    if (!txns.length) {
      return {
        totalSent: 0, totalReceived: 0, sentPctChange: 0, receivedPctChange: 0,
        barData: monthsMeta.map(m => ({ month: m.label, Send: 0, CashOut: 0, Payment: 0, Recharge: 0 })),
        donutData: [],
        topRecipients: [],
      };
    }

    // Per-month buckets
    const monthBuckets: Record<string, Record<string, number>> = {};
    monthsMeta.forEach(m => { monthBuckets[m.key] = { Send: 0, CashOut: 0, Payment: 0, Recharge: 0 }; });

    let curSent = 0, curReceived = 0, prevSent = 0, prevReceived = 0;
    const donutAccum: Record<string, number> = { Send: 0, CashOut: 0, Payment: 0, Recharge: 0 };
    const recipientAccum: Record<string, { amount: number; type: string }> = {};

    for (const tx of txns) {
      const d = new Date(tx.created_at);
      const mk = getMonthKey(d);
      const cat = TYPE_TO_CATEGORY[tx.type];
      const amt = Number(tx.amount);

      // Bar chart
      if (cat && monthBuckets[mk]) {
        monthBuckets[mk][cat] += amt;
      }

      // Sent/received totals for current & prev month
      if (OUTGOING_TYPES.includes(tx.type)) {
        if (mk === currentMonthKey) curSent += amt;
        if (mk === prevMonthKey) prevSent += amt;
      }
      if (INCOMING_TYPES.includes(tx.type)) {
        if (mk === currentMonthKey) curReceived += amt;
        if (mk === prevMonthKey) prevReceived += amt;
      }

      // Donut (current month outgoing)
      if (mk === currentMonthKey && cat) {
        donutAccum[cat] += amt;
      }

      // Top recipients (current month outgoing)
      if (mk === currentMonthKey && OUTGOING_TYPES.includes(tx.type)) {
        const key = tx.recipient_name || tx.recipient_phone || t("siUnknown");
        if (!recipientAccum[key]) recipientAccum[key] = { amount: 0, type: tx.type };
        recipientAccum[key].amount += amt;
      }
    }

    const barData = monthsMeta.map(m => ({
      month: m.label,
      Send: monthBuckets[m.key].Send,
      CashOut: monthBuckets[m.key].CashOut,
      Payment: monthBuckets[m.key].Payment,
      Recharge: monthBuckets[m.key].Recharge,
    }));

    const donutEntries = [
      { key: "sendMoney" as const, cat: "Send", color: CHART_COLORS.Send },
      { key: "cashOut" as const, cat: "CashOut", color: CHART_COLORS.CashOut },
      { key: "payment" as const, cat: "Payment", color: CHART_COLORS.Payment },
      { key: "recharge" as const, cat: "Recharge", color: CHART_COLORS.Recharge },
    ].map(e => ({ ...e, value: donutAccum[e.cat] })).filter(e => e.value > 0);

    const sentPctChange = prevSent > 0 ? Math.round(((curSent - prevSent) / prevSent) * 100) : 0;
    const receivedPctChange = prevReceived > 0 ? Math.round(((curReceived - prevReceived) / prevReceived) * 100) : 0;

    const topRecipients = Object.entries(recipientAccum)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        icon: TYPE_EMOJI[data.type] || "💰",
        category: TYPE_TO_CATEGORY[data.type] || "Other",
      }));

    return { totalSent: curSent, totalReceived: curReceived, sentPctChange, receivedPctChange, barData, donutData: donutEntries, topRecipients };
  }, [txns, monthsMeta, currentMonthKey, prevMonthKey]);

  const budgetChartData = useMemo(() =>
    budgets.map(b => ({
      category: categoryLabel(b.category),
      Budget: b.monthly_limit,
      Actual: spending[b.category] || 0,
    })),
    [budgets, spending, categoryLabel]
  );

  const DONUT_DATA = donutData.map(d => ({ ...d, name: t(d.key) }));
  const donutTotal = DONUT_DATA.reduce((s, d) => s + d.value, 0);

  const hasNoData = !loading && txns.length === 0;
  const barAllZero = barData.every(b => b.Send === 0 && b.CashOut === 0 && b.Payment === 0 && b.Recharge === 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-5 pb-6"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.90 }}
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center hover:bg-muted transition-colors tap-target"
        >
          <ArrowLeft size={17} className="text-foreground" strokeWidth={2.2} />
        </motion.button>
        <div>
          <h1 className="text-[17px] font-bold text-foreground">{t("insightsTitle")}</h1>
          <p className="text-[11.5px] text-muted-foreground">{t("insightsSub2")}</p>
        </div>
      </div>

      {/* Date range picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePreset(p)}
            className={cn(
              "text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-colors",
              activePreset === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border/60 hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "text-[12px] font-semibold px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5",
                activePreset === "custom"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/60 hover:bg-muted"
              )}
            >
              <CalendarIcon size={13} />
              {activePreset === "custom"
                ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                : t("siCustom")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="start">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">{t("siFrom")}</p>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  disabled={(d) => d > new Date()}
                  className={cn("p-2 pointer-events-auto")}
                />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">{t("siTo")}</p>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)}
                  className={cn("p-2 pointer-events-auto")}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!customFrom || !customTo}
              onClick={applyCustomRange}
            >
              {t("siApplyRange")}
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Empty state */}
      {hasNoData ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 px-6 text-center"
        >
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
            <BarChart3 size={36} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">No transactions yet</h2>
          <p className="text-sm text-muted-foreground max-w-[260px]">
            Your spending insights will appear here once you make transactions in the selected period.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Sent / Received summary */}
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-card rounded-3xl border border-border/60 p-4 shadow-card"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-xl gradient-cashout flex items-center justify-center">
                  <ArrowUpRight size={13} className="text-primary-foreground" />
                </div>
                <span className="text-[11.5px] font-semibold text-muted-foreground">{t("totalSent")}</span>
              </div>
              {loading ? <Skeleton className="h-7 w-28 rounded-lg" /> : (
                <p className="text-[20px] font-bold text-foreground">৳{totalSent.toLocaleString()}</p>
              )}
              {!loading && sentPctChange !== 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {sentPctChange > 0 ? <TrendingDown size={11} className="text-destructive" /> : <TrendingUp size={11} className="text-primary" />}
                  <span className={`text-[11px] font-semibold ${sentPctChange > 0 ? "text-destructive" : "text-primary"}`}>
                    {sentPctChange > 0 ? "+" : ""}{sentPctChange}% {t("vsLastMonth")}
                  </span>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card rounded-3xl border border-border/60 p-4 shadow-card"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-xl gradient-primary flex items-center justify-center">
                  <ArrowDownLeft size={13} className="text-primary-foreground" />
                </div>
                <span className="text-[11.5px] font-semibold text-muted-foreground">{t("totalReceived")}</span>
              </div>
              {loading ? <Skeleton className="h-7 w-28 rounded-lg" /> : (
                <p className="text-[20px] font-bold text-foreground">৳{totalReceived.toLocaleString()}</p>
              )}
              {!loading && receivedPctChange !== 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {receivedPctChange > 0 ? <TrendingUp size={11} className="text-primary" /> : <TrendingDown size={11} className="text-destructive" />}
                  <span className={`text-[11px] font-semibold ${receivedPctChange > 0 ? "text-primary" : "text-destructive"}`}>
                    {receivedPctChange > 0 ? "+" : ""}{receivedPctChange}% {t("vsLastMonth")}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Cashback Summary Widget */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card p-4 relative overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center shadow-md">
                <Gift size={18} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{t("cashbackEarned")}</p>
                <p className="text-[11px] text-muted-foreground">{t("thisMonth")}</p>
              </div>
            </div>
            {cashbackLoading ? (
              <Skeleton className="h-8 w-24 rounded-lg" />
            ) : (
              <div className="flex items-end gap-3">
                <p className="text-[26px] font-extrabold text-primary">
                  ৳{cashbackTotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </p>
                <span className="text-xs text-muted-foreground mb-1.5">
                  {cashbackCount} {cashbackCount === 1 ? t("rechargeCount") : t("rechargesCount")}
                </span>
              </div>
            )}
          </motion.div>

          {/* Budget Manager */}
          <BudgetManager />

          {/* Budget vs Actual Chart */}
          {budgets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
              className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden"
            >
              <div className="px-4 pt-4 pb-2">
                <p className="text-sm font-bold text-foreground">Budget vs Actual</p>
                <p className="text-[11px] text-muted-foreground">This month's spending against your limits</p>
              </div>
              <div className="px-1 pb-4" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const budget = payload.find(p => p.dataKey === "Budget")?.value as number || 0;
                        const actual = payload.find(p => p.dataKey === "Actual")?.value as number || 0;
                        const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
                        return (
                          <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-elevated text-xs space-y-1 min-w-[140px]">
                            <p className="font-semibold text-foreground mb-1">{label}</p>
                            <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium text-foreground">৳{budget.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Actual</span><span className="font-medium text-foreground">৳{actual.toLocaleString()}</span></div>
                            <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold">
                              <span className="text-muted-foreground">Used</span>
                              <span className={pct >= 90 ? "text-destructive" : pct >= 70 ? "text-amber-500" : "text-primary"}>{pct}%</span>
                            </div>
                          </div>
                        );
                      }}
                      cursor={{ fill: "hsl(var(--muted) / 0.5)", radius: 4 }}
                    />
                    <Bar dataKey="Budget" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual" radius={[4, 4, 0, 0]}>
                      {budgetChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            entry.Budget > 0 && (entry.Actual / entry.Budget) >= 0.9
                              ? "hsl(var(--destructive))"
                              : entry.Budget > 0 && (entry.Actual / entry.Budget) >= 0.7
                                ? "hsl(36 95% 55%)"
                                : "hsl(var(--primary))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 px-4 pb-4">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "hsl(var(--muted-foreground) / 0.3)" }} />
                  Budget
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "hsl(var(--primary))" }} />
                  Actual
                </div>
              </div>
            </motion.div>
          )}

          {/* Monthly bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden"
          >
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">{t("monthlyBreakdown")}</p>
              <div className="flex gap-1 flex-wrap justify-end">
                {monthsMeta.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setActiveMonth(m.label)}
                    className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                      activeMonth === m.label
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="px-4 pb-4 space-y-2">
                <Skeleton className="h-[210px] w-full rounded-xl" />
              </div>
            ) : barAllZero ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <BarChart3 size={28} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No data for this period</p>
              </div>
            ) : (
              <div className="px-1 pb-4" style={{ height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<BarTooltip totalLabel={t("total")} />} cursor={{ fill: "hsl(var(--muted) / 0.5)", radius: 4 }} />
                    <Bar dataKey="Send" stackId="a" fill={CHART_COLORS.Send} radius={[0,0,0,0]} />
                    <Bar dataKey="CashOut" stackId="a" fill={CHART_COLORS.CashOut} />
                    <Bar dataKey="Payment" stackId="a" fill={CHART_COLORS.Payment} />
                    <Bar dataKey="Recharge" stackId="a" fill={CHART_COLORS.Recharge} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-wrap gap-3 px-4 pb-4">
              {[
                { label: t("sendMoney"), color: CHART_COLORS.Send },
                { label: t("cashOut"),   color: CHART_COLORS.CashOut },
                { label: t("payment"),   color: CHART_COLORS.Payment },
                { label: t("recharge"),  color: CHART_COLORS.Recharge },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Donut chart */}
          {(loading || DONUT_DATA.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-card rounded-3xl border border-border/60 shadow-card p-4"
            >
              <p className="text-sm font-bold text-foreground mb-3">{t("categoryBreakdown")}</p>
              {loading ? (
                <Skeleton className="h-[200px] w-full rounded-xl" />
              ) : (
                <>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={DONUT_DATA}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={82}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                        >
                          {DONUT_DATA.map((entry, index) => (
                            <Cell key={index} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(value, entry: any) => (
                            <span style={{ color: "hsl(var(--foreground))", fontSize: 11 }}>
                              {value} <span style={{ color: "hsl(var(--muted-foreground))" }}>
                                (৳{entry.payload.value.toLocaleString()})
                              </span>
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5 mt-2">
                    {DONUT_DATA.map((d) => {
                      const pct = donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0;
                      return (
                        <div key={d.name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-foreground font-medium">{d.name}</span>
                            <span className="text-muted-foreground">৳{d.value.toLocaleString()} · {pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: d.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Top recipients */}
          {(loading || topRecipients.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden"
            >
              <p className="text-sm font-bold text-foreground px-4 pt-4 pb-2">{t("topMerchants")}</p>
              {loading ? (
                <div className="px-4 pb-4 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : (
                topRecipients.map((m, i) => {
                  const max = topRecipients[0]?.amount || 1;
                  const pct = Math.round((m.amount / max) * 100);
                  return (
                    <div key={m.name} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                      <span className="text-xl w-8 text-center shrink-0">{m.icon}</span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-foreground truncate">{m.name}</span>
                          <span className="font-semibold text-foreground">৳{m.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full gradient-primary transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">
                            #{i + 1} · {m.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default SpendingInsightsPage;
