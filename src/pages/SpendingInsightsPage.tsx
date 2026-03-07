import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Gift, BadgeDollarSign, BarChart3, CalendarIcon, Target, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const OUTGOING_TYPES = ["send", "cashout", "payment", "recharge", "paybill", "banktransfer"];
const INCOMING_TYPES = ["receive", "addmoney"];

const TYPE_TO_CATEGORY: Record<string, string> = {
  send: "Send", banktransfer: "Send",
  cashout: "CashOut",
  payment: "Payment", paybill: "Payment",
  recharge: "Recharge",
};

const CATEGORY_COLORS: Record<string, string> = {
  Send: "hsl(262 70% 55%)",
  CashOut: "hsl(340 75% 55%)",
  Payment: "hsl(200 80% 50%)",
  Recharge: "hsl(36 95% 55%)",
};

const MERCHANT_ICONS: Record<string, string> = {
  payment: "💳", paybill: "🧾", recharge: "📡", default: "🛒",
};

const PRESETS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
] as const;

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

  const now = new Date();
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const [activeMonth, setActiveMonth] = useState(currentMonthName);

  // Date range state
  const [dateRange, setDateRange] = useState({ from: subMonths(now, 6), to: now });
  const [activePreset, setActivePreset] = useState("6M");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [customOpen, setCustomOpen] = useState(false);

  // Real data state
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [totalSent, setTotalSent] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [sentDelta, setSentDelta] = useState(0);
  const [receivedDelta, setReceivedDelta] = useState(0);
  const [barData, setBarData] = useState<Record<string, any>[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [topMerchants, setTopMerchants] = useState<{ name: string; category: string; amount: number; icon: string }[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]);

  // Budget state
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState<Record<string, string>>({});
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Cashback + fees
  const [cashbackTotal, setCashbackTotal] = useState(0);
  const [cashbackCount, setCashbackCount] = useState(0);
  const [cashbackLoading, setCashbackLoading] = useState(true);
  const [feeData, setFeeData] = useState<{ month: string; fees: number }[]>([]);
  const [feesLoading, setFeesLoading] = useState(true);

  const BUDGET_CATEGORIES = ["total", "Send", "CashOut", "Payment", "Recharge"] as const;

  const handlePreset = (label: string, m: number) => {
    setActivePreset(label);
    setDateRange({ from: subMonths(new Date(), m), to: new Date() });
    setCustomOpen(false);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setActivePreset("Custom");
      setDateRange({ from: customFrom, to: customTo });
      setCustomOpen(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setInsightsLoading(true);
      setCashbackLoading(true);
      setFeesLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setInsightsLoading(false);
        setCashbackLoading(false);
        setFeesLoading(false);
        return;
      }

      const userId = session.user.id;

      const { data: txns } = await supabase
        .from("transactions")
        .select("type, amount, fee, created_at, recipient_name, description")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const rows = txns ?? [];
      setAllTxns(rows);

      // Build month labels dynamically from date range
      const monthLabels: string[] = [];
      const cursor = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 1);
      const endMonth = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), 1);
      while (cursor <= endMonth) {
        monthLabels.push(MONTH_NAMES[cursor.getMonth()]);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      setMonths(monthLabels);

      // Current & previous month boundaries
      const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const curOut = rows.filter(r => new Date(r.created_at) >= curMonthStart && OUTGOING_TYPES.includes(r.type));
      const curIn = rows.filter(r => new Date(r.created_at) >= curMonthStart && INCOMING_TYPES.includes(r.type));
      const prevOut = rows.filter(r => {
        const d = new Date(r.created_at);
        return d >= prevMonthStart && d < curMonthStart && OUTGOING_TYPES.includes(r.type);
      });
      const prevIn = rows.filter(r => {
        const d = new Date(r.created_at);
        return d >= prevMonthStart && d < curMonthStart && INCOMING_TYPES.includes(r.type);
      });

      const curSentTotal = curOut.reduce((s, r) => s + Number(r.amount), 0);
      const curRecvTotal = curIn.reduce((s, r) => s + Number(r.amount), 0);
      const prevSentTotal = prevOut.reduce((s, r) => s + Number(r.amount), 0);
      const prevRecvTotal = prevIn.reduce((s, r) => s + Number(r.amount), 0);

      setTotalSent(Math.round(curSentTotal));
      setTotalReceived(Math.round(curRecvTotal));
      setSentDelta(prevSentTotal > 0 ? Math.round(((curSentTotal - prevSentTotal) / prevSentTotal) * 100) : 0);
      setReceivedDelta(prevRecvTotal > 0 ? Math.round(((curRecvTotal - prevRecvTotal) / prevRecvTotal) * 100) : 0);

      // Bar chart data grouped by month
      const barMap: Record<string, Record<string, number>> = {};
      monthLabels.forEach(m => { barMap[m] = { Send: 0, CashOut: 0, Payment: 0, Recharge: 0 }; });
      rows.forEach(r => {
        const cat = TYPE_TO_CATEGORY[r.type];
        if (!cat) return;
        const mName = MONTH_NAMES[new Date(r.created_at).getMonth()];
        if (barMap[mName]) barMap[mName][cat] += Number(r.amount);
      });
      setBarData(monthLabels.map(m => ({ month: m, ...barMap[m] })));

      // Top merchants (current month)
      const merchantMap: Record<string, { amount: number; type: string }> = {};
      curOut.filter(r => ["payment", "paybill", "recharge"].includes(r.type) && r.recipient_name).forEach(r => {
        const name = r.recipient_name!;
        if (!merchantMap[name]) merchantMap[name] = { amount: 0, type: r.type };
        merchantMap[name].amount += Number(r.amount);
      });
      const sortedMerchants = Object.entries(merchantMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 5)
        .map(([name, data]) => ({
          name,
          category: TYPE_TO_CATEGORY[data.type] || "Other",
          amount: Math.round(data.amount),
          icon: MERCHANT_ICONS[data.type] || MERCHANT_ICONS.default,
        }));
      setTopMerchants(sortedMerchants);

      setInsightsLoading(false);

      // Cashback
      const cbTxns = rows.filter(r =>
        r.type === "addmoney" &&
        new Date(r.created_at) >= curMonthStart &&
        r.description?.startsWith("Drive Cashback:")
      );
      setCashbackTotal(cbTxns.reduce((s, r) => s + Number(r.amount), 0));
      setCashbackCount(cbTxns.length);
      setCashbackLoading(false);

      // Monthly fees
      const feeMap: Record<string, number> = {};
      monthLabels.forEach(m => { feeMap[m] = 0; });
      rows.filter(r => Number(r.fee) > 0).forEach(r => {
        const mName = MONTH_NAMES[new Date(r.created_at).getMonth()];
        if (mName in feeMap) feeMap[mName] += Number(r.fee);
      });
      setFeeData(Object.entries(feeMap).map(([month, fees]) => ({ month, fees: Math.round(fees * 100) / 100 })));
      setFeesLoading(false);

      // Budgets
      const { data: budgetRows } = await supabase
        .from("spending_budgets" as any)
        .select("category, monthly_limit")
        .eq("user_id", userId);
      if (budgetRows) {
        const bMap: Record<string, number> = {};
        (budgetRows as any[]).forEach((r: any) => { bMap[r.category] = Number(r.monthly_limit); });
        setBudgets(bMap);
      }
    };
    fetchData();
  }, [dateRange]);

  // Donut data reacts to activeMonth
  const donutData = useMemo(() => {
    const catTotals: Record<string, number> = { Send: 0, CashOut: 0, Payment: 0, Recharge: 0 };
    allTxns.forEach(r => {
      const cat = TYPE_TO_CATEGORY[r.type];
      if (!cat) return;
      const mName = MONTH_NAMES[new Date(r.created_at).getMonth()];
      if (mName === activeMonth) catTotals[cat] += Number(r.amount);
    });
    return [
      { key: "sendMoney" as const, name: t("sendMoney"), value: Math.round(catTotals.Send), color: CATEGORY_COLORS.Send },
      { key: "cashOut" as const, name: t("cashOut"), value: Math.round(catTotals.CashOut), color: CATEGORY_COLORS.CashOut },
      { key: "payment" as const, name: t("payment"), value: Math.round(catTotals.Payment), color: CATEGORY_COLORS.Payment },
      { key: "recharge" as const, name: t("recharge"), value: Math.round(catTotals.Recharge), color: CATEGORY_COLORS.Recharge },
    ].filter(d => d.value > 0);
  }, [allTxns, activeMonth, t]);

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // Current month spending by category for budget tracking
  const currentMonthSpending = useMemo(() => {
    const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const spending: Record<string, number> = { total: 0, Send: 0, CashOut: 0, Payment: 0, Recharge: 0 };
    allTxns.forEach(r => {
      if (new Date(r.created_at) < curMonthStart) return;
      const cat = TYPE_TO_CATEGORY[r.type];
      if (!cat) return;
      const amt = Number(r.amount);
      spending[cat] += amt;
      spending.total += amt;
    });
    return spending;
  }, [allTxns]);

  const getBudgetColor = (spent: number, limit: number) => {
    if (limit <= 0) return "bg-primary";
    const pct = (spent / limit) * 100;
    if (pct > 90) return "bg-destructive";
    if (pct > 75) return "bg-amber-500";
    return "bg-primary";
  };

  const handleSaveBudgets = async () => {
    setBudgetSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setBudgetSaving(false); return; }

    const upserts = BUDGET_CATEGORIES
      .filter(cat => budgetForm[cat] && Number(budgetForm[cat]) > 0)
      .map(cat => ({
        user_id: session.user.id,
        category: cat,
        monthly_limit: Number(budgetForm[cat]),
        updated_at: new Date().toISOString(),
      }));

    if (upserts.length > 0) {
      const { error } = await (supabase.from("spending_budgets" as any) as any)
        .upsert(upserts, { onConflict: "user_id,category" });
      if (error) {
        toast.error("Failed to save budgets");
      } else {
        const newBudgets: Record<string, number> = { ...budgets };
        upserts.forEach(u => { newBudgets[u.category] = u.monthly_limit; });
        setBudgets(newBudgets);
        toast.success("Budgets saved!");
        setBudgetDialogOpen(false);
      }
    } else {
      setBudgetDialogOpen(false);
    }
    setBudgetSaving(false);
  };

  const openBudgetDialog = () => {
    const form: Record<string, string> = {};
    BUDGET_CATEGORIES.forEach(cat => {
      form[cat] = budgets[cat] ? String(budgets[cat]) : "";
    });
    setBudgetForm(form);
    setBudgetDialogOpen(true);
  };

  const hasBudgets = Object.values(budgets).some(v => v > 0);

  const SkeletonBlock = ({ className }: { className?: string }) => (
    <div className={`rounded-lg bg-muted animate-pulse ${className ?? "h-8 w-24"}`} />
  );

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

      {/* Date Range Picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.label, p.months)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors",
              activePreset === p.label
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border/60 hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={activePreset === "Custom" ? "default" : "outline"}
              size="sm"
              className={cn(
                "text-xs font-semibold rounded-xl h-auto py-1.5 px-3 gap-1.5",
                activePreset === "Custom" && "bg-primary text-primary-foreground"
              )}
            >
              <CalendarIcon size={12} />
              {activePreset === "Custom"
                ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                : "Custom"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="start">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">From</p>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  disabled={(date) => date > new Date()}
                  className={cn("p-2 pointer-events-auto")}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">To</p>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
                  className={cn("p-2 pointer-events-auto")}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full rounded-xl"
              disabled={!customFrom || !customTo || customFrom > customTo}
              onClick={handleCustomApply}
            >
              Apply Range
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Empty state */}
      {!insightsLoading && allTxns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-card rounded-3xl border border-border/60 shadow-card p-10 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-5">
            <BarChart3 size={36} className="text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">No transactions yet</h2>
          <p className="text-sm text-muted-foreground max-w-[260px]">
            Start transacting to see your spending insights here. Your charts and analytics will appear once you have activity.
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
              {insightsLoading ? <SkeletonBlock /> : (
                <>
                  <p className="text-[20px] font-bold text-foreground">৳{totalSent.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {sentDelta >= 0 ? (
                      <TrendingUp size={11} className="text-destructive" />
                    ) : (
                      <TrendingDown size={11} className="text-primary" />
                    )}
                    <span className={`text-[11px] font-semibold ${sentDelta >= 0 ? "text-destructive" : "text-primary"}`}>
                      {sentDelta >= 0 ? "+" : ""}{sentDelta}% {t("vsLastMonth")}
                    </span>
                  </div>
                </>
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
              {insightsLoading ? <SkeletonBlock /> : (
                <>
                  <p className="text-[20px] font-bold text-foreground">৳{totalReceived.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {receivedDelta >= 0 ? (
                      <TrendingUp size={11} className="text-primary" />
                    ) : (
                      <TrendingDown size={11} className="text-destructive" />
                    )}
                    <span className={`text-[11px] font-semibold ${receivedDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                      {receivedDelta >= 0 ? "+" : ""}{receivedDelta}% {t("vsLastMonth")}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </div>

          {/* Budget Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Target size={16} className="text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">Monthly Budget</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={openBudgetDialog}>
                <Pencil size={12} />
                {hasBudgets ? "Edit" : "Set"}
              </Button>
            </div>
            {hasBudgets ? (
              <div className="space-y-3">
                {BUDGET_CATEGORIES.filter(cat => budgets[cat] && budgets[cat] > 0).map(cat => {
                  const spent = Math.round(currentMonthSpending[cat] || 0);
                  const limit = budgets[cat];
                  const pct = Math.min(Math.round((spent / limit) * 100), 100);
                  const colorClass = getBudgetColor(spent, limit);
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{cat === "total" ? "Total Spending" : cat}</span>
                        <span className="text-muted-foreground">
                          ৳{spent.toLocaleString()} / ৳{limit.toLocaleString()}
                          <span className={cn("ml-1.5 font-semibold", pct > 90 ? "text-destructive" : pct > 75 ? "text-amber-500" : "text-primary")}>
                            {pct}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", colorClass)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-2">Set monthly spending limits to track your budget</p>
                <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={openBudgetDialog}>
                  Set Budget Goals
                </Button>
              </div>
            )}
          </motion.div>

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
              <SkeletonBlock />
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

          {/* Monthly Fees Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden"
          >
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <BadgeDollarSign size={16} className="text-amber-500" />
              <p className="text-sm font-bold text-foreground">Monthly Fees</p>
              {!feesLoading && (
                <span className="ml-auto text-xs text-amber-500 font-semibold">
                  Total: ৳{feeData.reduce((s, d) => s + d.fees, 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
            {feesLoading ? (
              <div className="h-[180px] flex items-center justify-center">
                <SkeletonBlock />
              </div>
            ) : (
              <div className="px-1 pb-4" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v}`} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-elevated text-xs">
                            <p className="font-semibold text-foreground mb-1">{label}</p>
                            <span className="text-amber-500 font-medium">৳{Number(payload[0].value).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
                          </div>
                        );
                      }}
                      cursor={{ fill: "hsl(var(--muted) / 0.5)", radius: 4 }}
                    />
                    <Bar dataKey="fees" fill="hsl(40 80% 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          {/* Monthly bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden"
          >
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">{t("monthlyBreakdown")}</p>
              {!insightsLoading && (
                <div className="flex gap-1">
                  {months.map((m) => (
                    <button
                      key={m}
                      onClick={() => setActiveMonth(m)}
                      className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                        activeMonth === m
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {insightsLoading ? (
              <div className="h-[210px] flex items-center justify-center">
                <SkeletonBlock className="h-32 w-3/4" />
              </div>
            ) : (
              <>
                <div className="px-1 pb-4" style={{ height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<BarTooltip totalLabel={t("total")} />} cursor={{ fill: "hsl(var(--muted) / 0.5)", radius: 4 }} />
                      <Bar dataKey="Send" stackId="a" fill={CATEGORY_COLORS.Send} radius={[0,0,0,0]} />
                      <Bar dataKey="CashOut" stackId="a" fill={CATEGORY_COLORS.CashOut} />
                      <Bar dataKey="Payment" stackId="a" fill={CATEGORY_COLORS.Payment} />
                      <Bar dataKey="Recharge" stackId="a" fill={CATEGORY_COLORS.Recharge} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 px-4 pb-4">
                  {[
                    { label: t("sendMoney"), color: CATEGORY_COLORS.Send },
                    { label: t("cashOut"),   color: CATEGORY_COLORS.CashOut },
                    { label: t("payment"),   color: CATEGORY_COLORS.Payment },
                    { label: t("recharge"),  color: CATEGORY_COLORS.Recharge },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          {/* Donut chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card p-4"
          >
            <p className="text-sm font-bold text-foreground mb-1">{t("categoryBreakdown")}</p>
            <p className="text-[11px] text-muted-foreground mb-3">{activeMonth}</p>
            {insightsLoading ? (
              <SkeletonBlock className="h-[200px] w-full" />
            ) : donutData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions in {activeMonth}</p>
            ) : (
              <>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                      >
                        {donutData.map((entry, index) => (
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
                {/* Category bars */}
                <div className="space-y-2.5 mt-2">
                  {donutData.map((d) => {
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

          {/* Top merchants */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden"
          >
            <p className="text-sm font-bold text-foreground px-4 pt-4 pb-2">{t("topMerchants")}</p>
            {insightsLoading ? (
              <div className="px-4 pb-4 space-y-3">
                {[1,2,3].map(i => <SkeletonBlock key={i} className="h-12 w-full" />)}
              </div>
            ) : topMerchants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 px-4">No merchant transactions this month</p>
            ) : (
              topMerchants.map((m, i) => {
                const max = topMerchants[0].amount;
                const pct = max > 0 ? Math.round((m.amount / max) * 100) : 0;
                return (
                  <div key={m.name} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                    <span className="text-xl w-8 text-center shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">{m.name}</span>
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
        </>
      )}
    </motion.div>
  );
};

export default SpendingInsightsPage;
