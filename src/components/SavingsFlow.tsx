import { useState, useEffect, useCallback, useMemo } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown, CheckCircle2, ChevronRight,
  Trash2, Clock, CalendarClock, Power, Gem, BarChart3, Wallet,
  ArrowUpRight, ArrowDownRight, ShieldCheck, Coins, LineChart,
  RefreshCw, Sparkles, Target, CircleDollarSign, FileText, Lock,
  AlertTriangle, X, ChevronDown, ChevronLeft, Gift, AlertCircle, Zap
} from "lucide-react";
import { toast } from "sonner";
import { getBalance, onBalanceChange, fetchBalance, recordTransaction } from "@/lib/balanceStore";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useStockPrices } from "@/hooks/use-stock-prices";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { verifyPin } from "@/lib/verifyPin";
import SlideToConfirm from "@/components/SlideToConfirm";
import { haptics } from "@/lib/haptics";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ─── Date formatting (user's local timezone) ─────────────────────────
const USER_TIMEZONE = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka"; }
  catch { return "Asia/Dhaka"; }
})();
const USER_TZ_ABBR = (() => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: USER_TIMEZONE, timeZoneName: "short" }).formatToParts(new Date());
    return parts.find(p => p.type === "timeZoneName")?.value ?? "";
  } catch { return ""; }
})();
function formatInstallmentDate(d: string | Date, opts: { withTime?: boolean; long?: boolean } = {}) {
  const { withTime = true, long = false } = opts;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const fmt: Intl.DateTimeFormatOptions = {
    timeZone: USER_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(long ? { weekday: "short" } : {}),
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  return date.toLocaleString("en-GB", fmt);
}

// ─── Types ───────────────────────────────────────────────────────────
interface SavingsGoal {
  id: string; name: string; emoji: string;
  target_amount: number; saved_amount: number; status: string;
}
interface AutoSaveSchedule {
  id: string; goal_id: string | null; frequency: string; amount: number;
  is_active: boolean; next_run_at: string; duration: string | null;
  ends_at: string | null; settled: boolean;
  created_at?: string; user_id?: string;
  missed_count?: number; total_paid?: number; total_installments?: number;
  strategy?: string; last_missed_at?: string;
}
interface MissedPayment {
  id: string; schedule_id: string; user_id: string; amount: number;
  due_date: string; repaid: boolean; repaid_at: string | null; created_at: string;
}

// ─── Mock investment data ────────────────────────────────────────────
interface GoldHolding { grams: number; avgBuyPrice: number; }
interface StockHolding { symbol: string; name: string; qty: number; avgPrice: number; currentPrice: number; change: number; }

// Gold prices fetched live via useGoldPrice hook

// Live stock list fetched via useStockPrices hook (DSE source w/ fallback)
type StockQuote = { symbol: string; name: string; price: number; change: number; sector: string };

// ─── Profit & Duration Config ────────────────────────────────────────
// Returns vary by duration (months → annual %). Realistic 2%–6% range.
const STRATEGY_RETURNS: Record<string, Record<number, number>> = {
  gold:   { 6: 2.0, 12: 2.5, 24: 3.0, 36: 3.5, 60: 4.0, 120: 4.5 },
  mixed:  { 6: 2.5, 12: 3.0, 24: 3.5, 36: 4.0, 60: 4.5, 120: 5.0 },
  stocks: { 6: 3.0, 12: 3.5, 24: 4.0, 36: 4.5, 60: 5.0, 120: 6.0 },
};

const FREQ_BONUS: Record<string, number> = { daily: 0.5, weekly: 0.25, monthly: 0 };

function getEstReturn(strategyKey: string, durationMonths: number, frequency?: string): number {
  const rates = STRATEGY_RETURNS[strategyKey];
  if (!rates) return 0;
  const base = rates[durationMonths] ?? rates[12] ?? 0;
  const bonus = frequency ? (FREQ_BONUS[frequency] ?? 0) : 0;
  return Math.min(base + bonus, 6.0);
}

function getReturnRange(strategyKey: string): string {
  const rates = STRATEGY_RETURNS[strategyKey];
  if (!rates) return "0–0";
  const values = Object.values(rates);
  const min = Math.min(...values);
  const max = Math.min(Math.max(...values) + 0.5, 6.0); // max includes daily freq bonus
  return `${min}–${max}`;
}

const INVESTMENT_STRATEGIES = [
  { key: "gold", label: "Gold Investment", icon: "🪙", desc: "Auto-invest in 22K gold" },
  { key: "mixed", label: "Mixed (Gold + Stocks)", icon: "📊", desc: "60% gold, 40% halal stocks" },
  { key: "stocks", label: "Halal Stocks", icon: "📈", desc: "Auto-invest in Sharia-screened stocks" },
] as const;

type Strategy = typeof INVESTMENT_STRATEGIES[number]["key"];

// ─── Goal lock + history retention ────────
const GOAL_LOCK_DAYS = 60;
const HISTORY_MONTHS = 12;
const DAY_MS = 86_400_000;
const isGoalLocked = (g: any) => {
  if (!g?.created_at) return false;
  return Date.now() < new Date(g.created_at).getTime() + GOAL_LOCK_DAYS * DAY_MS;
};
const goalLockDaysLeft = (g: any) => {
  if (!g?.created_at) return 0;
  return Math.max(0, Math.ceil((new Date(g.created_at).getTime() + GOAL_LOCK_DAYS * DAY_MS - Date.now()) / DAY_MS));
};
const goalUnlockDate = (g: any) => {
  if (!g?.created_at) return null;
  return new Date(new Date(g.created_at).getTime() + GOAL_LOCK_DAYS * DAY_MS);
};
const withinHistoryWindow = (closedAtRaw: any) => {
  if (!closedAtRaw) return true;
  return Date.now() - new Date(closedAtRaw).getTime() < HISTORY_MONTHS * 30 * DAY_MS;
};
const sortActiveFirst = <T extends { status?: string; created_at?: string; updated_at?: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const aActive = (a.status === "active" || !a.status) ? 0 : 1;
    const bActive = (b.status === "active" || !b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aT = new Date(a.created_at ?? a.updated_at ?? 0).getTime();
    const bT = new Date(b.created_at ?? b.updated_at ?? 0).getTime();
    return bT - aT;
  });
};

const DURATION_OPTIONS = [
  { value: "6m", label: "6 Months", months: 6, minLock: 3, penaltyPct: 2 },
  { value: "1y", label: "1 Year", months: 12, minLock: 3, penaltyPct: 1.5 },
  { value: "2y", label: "2 Years", months: 24, minLock: 3, penaltyPct: 1.5 },
  { value: "3y", label: "3 Years", months: 36, minLock: 3, penaltyPct: 1 },
  { value: "5y", label: "5 Years", months: 60, minLock: 3, penaltyPct: 1 },
  { value: "10y", label: "10 Years", months: 120, minLock: 3, penaltyPct: 1 },
];

function calcEndsAt(duration: string): string {
  const now = new Date();
  const match = duration.match(/^(\d+)(m|y)$/);
  if (!match) return now.toISOString();
  const num = parseInt(match[1]);
  if (match[2] === "m") now.setMonth(now.getMonth() + num);
  else now.setFullYear(now.getFullYear() + num);
  return now.toISOString();
}

function remainingTime(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 365) return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m left`;
  if (days > 30) return `${Math.floor(days / 30)}m ${days % 30}d left`;
  return `${days}d left`;
}

function calcEstimatedProfit(amount: number, durationMonths: number, estReturnPct: number) {
  const years = durationMonths / 12;
  const totalValue = amount * Math.pow(1 + estReturnPct / 100, years);
  const profit = totalValue - amount;
  return { totalValue: Math.round(totalValue), profit: Math.round(profit) };
}

const PRESET_AMOUNTS = [100, 200, 500, 1000, 5000];

const LIFE_GOAL_PRESETS = [
  { emoji: "🏍️", name: "Dream Bike", gradient: "from-orange-500/15 to-red-500/10", border: "border-orange-500/25" },
  { emoji: "🏠", name: "Dream House", gradient: "from-blue-500/15 to-indigo-500/10", border: "border-blue-500/25" },
  { emoji: "🚗", name: "Dream Car", gradient: "from-emerald-500/15 to-teal-500/10", border: "border-emerald-500/25" },
  { emoji: "🎓", name: "Education", gradient: "from-violet-500/15 to-purple-500/10", border: "border-violet-500/25" },
  { emoji: "💍", name: "Wedding", gradient: "from-pink-500/15 to-rose-500/10", border: "border-pink-500/25" },
  { emoji: "✈️", name: "Vacation", gradient: "from-sky-500/15 to-cyan-500/10", border: "border-sky-500/25" },
  { emoji: "📱", name: "Gadget", gradient: "from-slate-500/15 to-gray-500/10", border: "border-slate-500/25" },
  { emoji: "🛡️", name: "Emergency Fund", gradient: "from-amber-500/15 to-yellow-500/10", border: "border-amber-500/25" },
  { emoji: "💼", name: "Business", gradient: "from-indigo-500/15 to-blue-500/10", border: "border-indigo-500/25" },
  { emoji: "🕋", name: "Hajj", gradient: "from-emerald-600/15 to-green-500/10", border: "border-emerald-600/25" },
  { emoji: "💊", name: "Health", gradient: "from-red-500/15 to-pink-500/10", border: "border-red-500/25" },
  { emoji: "✏️", name: "Custom", gradient: "from-muted/60 to-muted/30", border: "border-border/60" },
];
const GOLD_PRESETS = [0.5, 1, 2, 5, 10];

type MainTab = "savings" | "goals" | "gold" | "stocks";
type SavingsStep = "home" | "add" | "create" | "autosave" | "dps-create" | "review" | "goal-review" | "terms" | "detail" | "pick-goal" | "repay-missed" | "goal-detail" | "dps-detail";
type GoldStep = "portfolio" | "buy" | "sell";
type StockStep = "market" | "portfolio" | "trade";

interface SavingsFlowProps { onClose: () => void; }

// ─── Reusable PIN input ─────────────────────────────────────────────
const SavingsPinInput = ({ pin, onChange, error }: { pin: string; onChange: (p: string) => void; error: string }) => (
  <div className="space-y-3">
    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground text-center">Enter PIN to Confirm</p>
    <div className="flex justify-center gap-3">
      {[0, 1, 2, 3].map((i) => (
        <motion.div key={i} animate={{ scale: pin.length > i ? 1.15 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-4 h-4 rounded-full border-2 transition-colors ${pin.length > i ? "bg-primary border-transparent" : "border-muted-foreground/40 bg-transparent"}`}
        />
      ))}
    </div>
    {error && (
      <p className="text-xs text-destructive flex items-center justify-center gap-1">
        <AlertCircle size={12} /> {error}
      </p>
    )}
    <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin}
      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > pin.length) haptics.light(); onChange(v); }}
      className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors"
      placeholder="••••" />
  </div>
);

const SavingsFlow = ({ onClose }: SavingsFlowProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { price22k: LIVE_GOLD_PRICE, price24k: LIVE_GOLD_24K_PRICE, updatedAt: goldUpdatedAt, loading: goldPriceLoading, refresh: refreshGoldPrice } = useGoldPrice();
  const { stocks: liveStocks, updatedAt: stockUpdatedAt, source: stockSource, loading: stockPriceLoading, refresh: refreshStockPrices } = useStockPrices();

  const [mainTab, setMainTab] = useState<MainTab>("savings");

  // ─── Savings state ────────
  const [step, setStep] = useState<SavingsStep>("home");
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(getBalance);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newInitialDeposit, setNewInitialDeposit] = useState("");
  const [newEmoji, setNewEmoji] = useState("🎯");
  const [newTarget, setNewTarget] = useState("");
  const [autoSaves, setAutoSaves] = useState<AutoSaveSchedule[]>([]);
  const [autoFreq, setAutoFreq] = useState("monthly");
  const [autoAmount, setAutoAmount] = useState("");
  const [autoGoalId, setAutoGoalId] = useState<string>("general");
  const [autoCustom, setAutoCustom] = useState(false);
  const [autoDuration, setAutoDuration] = useState("1y");
  const [autoStrategy, setAutoStrategy] = useState<Strategy>("gold");
  const [termsAccepted, setTermsAccepted] = useState(false);
   const [showTermsSheet, setShowTermsSheet] = useState(false);
   const [enableAutoSaveInCreate, setEnableAutoSaveInCreate] = useState(false);
   const [tradeTermsAccepted, setTradeTermsAccepted] = useState(false);

  // ─── DPS missed payments state ────────
  const [missedPayments, setMissedPayments] = useState<MissedPayment[]>([]);
  const [repayScheduleId, setRepayScheduleId] = useState<string | null>(null);
  const [selectedMissedIds, setSelectedMissedIds] = useState<string[]>([]);

  // ─── Detail view state ────────
  const [selectedSchedule, setSelectedSchedule] = useState<AutoSaveSchedule | null>(null);
  const [goalDeposits, setGoalDeposits] = useState<Array<{ id: string; amount: number; source: string; created_at: string }>>([]);
  const [dpsTimeline, setDpsTimeline] = useState<Array<{
    id: string;
    date: string;
    amount: number;
    status: "processed" | "missed" | "repaid" | "refunded" | "skipped" | "pending";
    goalName?: string | null;
    goalId?: string | null;
    note?: string;
    txReference?: string | null;
    txId?: string | null;
    txStatus?: string | null;
    balanceAfter?: number | null;
    walletDelta?: number | null;
    refundReason?: string | null;
    outcome?: string | null;
  }>>([]);
  const [selectedInstallment, setSelectedInstallment] = useState<null | (typeof dpsTimeline)[number]>(null);


  // ─── PIN state (shared across all confirm actions) ────────
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");


  // ─── Delete confirmation state ────────
  const [deleteTarget, setDeleteTarget] = useState<{ type: "goal" | "auto"; id: string; label: string } | null>(null);
  const [deletePin, setDeletePin] = useState("");
  const [deletePinError, setDeletePinError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ─── Gold state ────────
  const [goldStep, setGoldStep] = useState<GoldStep>("portfolio");
  const [goldHoldings22k, setGoldHoldings22k] = useState<GoldHolding>({ grams: 0, avgBuyPrice: 0 });
  const [goldHoldings24k, setGoldHoldings24k] = useState<GoldHolding>({ grams: 0, avgBuyPrice: 0 });
  const [goldGrams, setGoldGrams] = useState("");
  const [goldKarat, setGoldKarat] = useState<"22k" | "24k">("22k");

  // Derive active holding from karat selection
  const goldHolding = goldKarat === "24k" ? goldHoldings24k : goldHoldings22k;

  // ─── Stock state ────────
  const [stockStep, setStockStep] = useState<StockStep>("market");
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockAction, setStockAction] = useState<"buy" | "sell">("buy");

  useEffect(() => { const unsub = onBalanceChange(setBalance); return () => { unsub(); }; }, []);

  // Reset PIN & acceptance whenever user navigates between steps
  useEffect(() => {
    setPin("");
    setPinError("");
    setTermsAccepted(false);
    setTradeTermsAccepted(false);
    if (step === "home") setNewInitialDeposit("");
  }, [step, goldStep, stockStep]);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("savings_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const all = (data as any[]) ?? [];
    // Hide closed/withdrawn/cancelled older than 12 months
    const filtered = all.filter((g) =>
      g.status === "active" || withinHistoryWindow(g.withdrawn_at ?? g.updated_at ?? g.created_at)
    );
    setGoals(sortActiveFirst(filtered));
    setLoading(false);
  }, [user]);

  const loadAutoSaves = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("savings_auto_save").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const all = (data as any[]) ?? [];
    const filtered = all.filter((s) =>
      s.is_active || withinHistoryWindow(s.ends_at ?? s.updated_at ?? s.created_at)
    );
    setAutoSaves(sortActiveFirst(filtered.map((s) => ({ ...s, status: s.is_active ? "active" : "closed" }))));
  }, [user]);

  const loadMissedPayments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("dps_missed_payments" as any).select("*").eq("user_id", user.id).eq("repaid", false).order("due_date", { ascending: false });
    setMissedPayments((data as any[]) ?? []);
  }, [user]);

  const loadGoldHoldings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("gold_holdings" as any).select("*").eq("user_id", user.id);
    const holdings = (data as any[]) ?? [];
    const h22k = holdings.find((h: any) => h.karat === "22k");
    const h24k = holdings.find((h: any) => h.karat === "24k");
    setGoldHoldings22k({ grams: h22k?.grams ?? 0, avgBuyPrice: h22k?.avg_buy_price ?? 0 });
    setGoldHoldings24k({ grams: h24k?.grams ?? 0, avgBuyPrice: h24k?.avg_buy_price ?? 0 });
  }, [user]);

  const loadStockHoldings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("stock_holdings" as any).select("*").eq("user_id", user.id);
    const holdings = (data as any[]) ?? [];
    setStockHoldings(holdings.map((h: any) => {
      const live = liveStocks.find(s => s.symbol === h.symbol);
      const stored = Number(h.current_price);
      const currentPrice = live?.price ?? (stored > 0 ? stored : Number(h.avg_buy_price));
      return {
        symbol: h.symbol, name: h.name, qty: h.quantity,
        avgPrice: Number(h.avg_buy_price), currentPrice,
        change: live?.change ?? 0,
      };
    }));
  }, [user, liveStocks]);

  // Persist live prices into stock_holdings so cross-session P/L stays accurate.
  useEffect(() => {
    if (!user || liveStocks.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("stock_holdings" as any).select("id, symbol").eq("user_id", user.id);
      if (cancelled || !data) return;
      const now = new Date().toISOString();
      await Promise.all((data as any[]).map((row) => {
        const live = liveStocks.find(s => s.symbol === row.symbol);
        if (!live) return Promise.resolve();
        return supabase.from("stock_holdings" as any)
          .update({ current_price: live.price, last_price_update: now })
          .eq("id", row.id);
      }));
    })();
    return () => { cancelled = true; };
  }, [user, liveStocks]);

  useEffect(() => { loadGoals(); loadAutoSaves(); loadGoldHoldings(); loadStockHoldings(); loadMissedPayments(); }, [loadGoals, loadAutoSaves, loadGoldHoldings, loadStockHoldings, loadMissedPayments]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("savings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_goals", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_deposits", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .on("postgres_changes", { event: "*", schema: "public", table: "gold_holdings", filter: `user_id=eq.${user.id}` }, () => loadGoldHoldings())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_holdings", filter: `user_id=eq.${user.id}` }, () => loadStockHoldings())
      .on("postgres_changes", { event: "*", schema: "public", table: "dps_missed_payments", filter: `user_id=eq.${user.id}` }, () => loadMissedPayments())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_auto_save", filter: `user_id=eq.${user.id}` }, () => loadAutoSaves())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadGoals, loadGoldHoldings, loadStockHoldings, loadMissedPayments, loadAutoSaves]);

  // ─── Live price merge: instantly reflect polled prices in UI without DB round-trip ────────
  useEffect(() => {
    if (!liveStocks.length) return;
    setStockHoldings(prev => prev.map(h => {
      const live = liveStocks.find(s => s.symbol === h.symbol);
      return live ? { ...h, currentPrice: live.price, change: live.change } : h;
    }));
  }, [liveStocks]);

  // Gold holdings store grams + avg buy price; live price is read directly from
  // LIVE_GOLD_PRICE / LIVE_GOLD_24K_PRICE in render, so updates flow automatically.
  // No state merge needed — re-render is triggered by hook state change.

  // ─── Computed profit estimation for auto-save ────────
  const autoAmtNum = parseFloat(autoAmount) || 0;
  const selectedDuration = DURATION_OPTIONS.find(d => d.value === autoDuration) ?? DURATION_OPTIONS[1];
  const selectedStrategyObj = INVESTMENT_STRATEGIES.find(s => s.key === autoStrategy) ?? INVESTMENT_STRATEGIES[0];

  const estimatedProfit = useMemo(() => {
    if (autoAmtNum <= 0) return null;
    let totalDeposits = 0;
    if (autoFreq === "daily") totalDeposits = autoAmtNum * selectedDuration.months * 30;
    else if (autoFreq === "weekly") totalDeposits = autoAmtNum * selectedDuration.months * 4;
    else totalDeposits = autoAmtNum * selectedDuration.months;

    const estReturnPct = getEstReturn(selectedStrategyObj.key, selectedDuration.months, autoFreq);
    const { totalValue, profit } = calcEstimatedProfit(totalDeposits, selectedDuration.months, estReturnPct);
    return { totalDeposits, totalValue, profit, returnPct: estReturnPct };
  }, [autoAmtNum, autoFreq, selectedDuration, selectedStrategyObj]);

  // ─── Savings handlers ────────
  // ⚠️ PIN-reset rule: every early-return after PIN entry MUST clear pin
  // (call setPin("") + setPinError("")). Use the `fail()` helper inside each handler.
  const handleSave = async () => {
    const amt = parseFloat(amount);
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (!amt || amt <= 0) return fail("Enter a valid amount");
    if (amt > balance) return fail("Insufficient balance");
    if (!selectedGoal) return fail("Select a savings goal");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    setProcessing(true); setError(""); setPinError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      const { data, error: rpcError } = await supabase.rpc("savings_deposit", { p_goal_id: selectedGoal.id, p_amount: amt, p_source: "manual" });
      if (rpcError) throw rpcError;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      await fetchBalance();
      if (result.goal_completed) { fireSuccessConfetti(); toast.success(`🎉 "${selectedGoal.name}" goal completed!`); }
      else { toast.success(`৳${amt.toLocaleString()} saved to "${selectedGoal.name}"`); }
      setStep("home"); setAmount(""); setSelectedGoal(null); setPin("");
    } catch (err: any) { setPin(""); setError(err.message || "Failed to save"); }
    finally { setProcessing(false); }
  };

  const handleCreateGoal = async () => {
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (!newName.trim()) return fail("Enter a goal name");
    const target = parseFloat(newTarget);
    if (!target || target <= 0) return fail("Enter a valid target amount");
    const initialAmt = parseFloat(newInitialDeposit) || 0;
    if (initialAmt > balance) return fail("Initial deposit exceeds wallet balance");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    if (!user) return;
    setProcessing(true); setError(""); setPinError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      const { data: newGoal, error: insertErr } = await supabase.from("savings_goals").insert({ user_id: user.id, name: newName.trim(), emoji: newEmoji, target_amount: target } as any).select("id").single();
      if (insertErr) throw insertErr;

      // Perform initial deposit if specified
      if (newGoal && initialAmt > 0) {
        const { error: depositErr } = await supabase.rpc("savings_deposit", { p_goal_id: newGoal.id, p_amount: initialAmt, p_source: "manual" });
        if (depositErr) throw depositErr;
      }

      await fetchBalance();
      await loadGoals();
      fireSuccessConfetti();
      toast.success(initialAmt > 0 ? `Goal "${newName}" created with ৳${initialAmt.toLocaleString()} deposit!` : `Goal "${newName}" created!`);
      setStep("home"); setNewName(""); setNewEmoji("🎯"); setNewTarget(""); setNewInitialDeposit(""); setPin("");
    } catch (err: any) { setPin(""); setError(err.message || "Failed to create goal"); }
    finally { setProcessing(false); }
  };

  const handleDeleteGoal = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (goal && isGoalLocked(goal)) {
      const daysLeft = goalLockDaysLeft(goal);
      toast.error(`Cannot cancel: locked for ${daysLeft} more day${daysLeft === 1 ? "" : "s"} (60-day minimum).`);
      setDeleteTarget(null); setDeletePin(""); setDeleting(false);
      return;
    }
    if (deletePin.length < 4) { setDeletePinError("Enter your 4-digit PIN"); return; }
    setDeleting(true); setDeletePinError("");
    const pinValid = await verifyPin(deletePin);
    if (!pinValid) { setDeletePinError("Incorrect PIN"); setDeletePin(""); setDeleting(false); return; }

    // For active goals, call cancel_goal RPC (refunds saved amount + archives).
    // For already-archived rows (withdrawn/cancelled), allow hard-delete from history list.
    if (goal && goal.status === "active") {
      const { data, error } = await supabase.rpc("cancel_goal" as any, { p_goal_id: goalId });
      if (error) {
        toast.error(error.message || "Failed to cancel goal");
        setDeleting(false);
        return;
      }
      const refund = Number((data as any)?.refund ?? 0);
      await fetchBalance();
      toast.success(refund > 0 ? `Goal cancelled. ৳${refund.toLocaleString()} refunded to wallet.` : "Goal cancelled");
    } else {
      const { error } = await supabase.from("savings_goals").delete().eq("id", goalId);
      if (error) { toast.error("Failed to remove goal"); setDeleting(false); return; }
      toast.success("Goal removed from history");
    }
    loadGoals();
    setDeleteTarget(null); setDeletePin(""); setDeleting(false);
  };

  const handleCreateAutoSave = async () => {
    const amt = parseFloat(autoAmount);
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (!amt || amt <= 0) return fail("Select or enter an amount");
    const currentBal = getBalance();
    if (amt > currentBal) return fail(`Insufficient balance. You need at least ৳${amt.toLocaleString()} for the 1st installment.`);
    if (!termsAccepted) return fail("Please accept Terms & Conditions");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    if (!user) return;
    setProcessing(true); setError(""); setPinError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }

      // STRICT VALIDATION: every DPS schedule MUST link to a real holding goal.
      // Resolve / create the goal BEFORE inserting the schedule so we never
      // persist a row with goal_id = null.
      let linkedGoalId: string | null =
        autoGoalId && autoGoalId !== "general" ? autoGoalId : null;

      // Calculate total installments for DPS tracking
      const totalInstallments = autoFreq === "daily" ? selectedDuration.months * 30
        : autoFreq === "weekly" ? selectedDuration.months * 4 : selectedDuration.months;

      // Path 1: combined "create goal + auto-save" flow
      if (enableAutoSaveInCreate && newName.trim()) {
        const target = parseFloat(newTarget);
        const { data: goalData, error: goalErr } = await supabase
          .from("savings_goals")
          .insert({ user_id: user.id, name: newName.trim(), emoji: newEmoji, target_amount: target || 0 } as any)
          .select("id").single();
        if (goalErr) throw goalErr;
        linkedGoalId = goalData?.id ?? null;
        loadGoals();
      }

      // Path 2: user picked "general" → auto-create a holding "DPS Plan" goal up-front
      if (!linkedGoalId) {
        const holdingTarget = totalInstallments > 0 ? amt * totalInstallments : amt * 12;
        const { data: holdingGoal, error: holdingErr } = await supabase
          .from("savings_goals")
          .insert({ user_id: user.id, name: "DPS Plan", emoji: "💰", target_amount: holdingTarget } as any)
          .select("id").single();
        if (holdingErr) throw holdingErr;
        linkedGoalId = holdingGoal?.id ?? null;
        loadGoals();
      }

      // Hard guard — refuse to insert a schedule without a linked goal.
      if (!linkedGoalId) {
        throw new Error("Could not link a savings goal to this DPS plan. Please try again.");
      }

      const nextRun = new Date();
      if (autoFreq === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (autoFreq === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setMonth(nextRun.getMonth() + 1);
      const endsAt = calcEndsAt(autoDuration);

      const { error: insertErr } = await supabase.from("savings_auto_save").insert({
        user_id: user.id, goal_id: linkedGoalId,
        frequency: autoFreq, amount: amt, next_run_at: nextRun.toISOString(), duration: autoDuration, ends_at: endsAt,
        strategy: autoStrategy, total_installments: totalInstallments, total_paid: 1, missed_count: 0,
        last_run_at: new Date().toISOString(),
      } as any).select("id").single();
      if (insertErr) throw insertErr;

      const goalLabel = goals.find(g => g.id === linkedGoalId)?.name ?? newName ?? "DPS Plan";
      const { error: depErr } = await supabase.rpc("savings_deposit", {
        p_goal_id: linkedGoalId, p_amount: amt, p_source: "auto",
      });
      if (depErr) throw depErr;
      await fetchBalance();

      fireSuccessConfetti();
      toast.success(enableAutoSaveInCreate ? `Goal "${newName}" created with auto-save plan!` : "Auto-save + investment plan activated! 1st installment deposited.");
      setAutoAmount(""); setAutoCustom(false); setTermsAccepted(false); setPin(""); setEnableAutoSaveInCreate(false);
      setNewName(""); setNewEmoji("🎯"); setNewTarget("");
      setStep("home"); loadAutoSaves();
    } catch (err: any) { setPin(""); setError(err.message || "Failed to create schedule"); }
    finally { setProcessing(false); }
  };

  const toggleAutoSave = async (id: string, current: boolean) => {
    await supabase.from("savings_auto_save").update({ is_active: !current } as any).eq("id", id);
    loadAutoSaves();
  };

  // ─── Repay missed DPS payments handler ────────
  const handleRepayMissed = async () => {
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (selectedMissedIds.length === 0) return fail("Select at least one missed payment");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    if (!user) return;
    const toRepay = missedPayments.filter(m => selectedMissedIds.includes(m.id));
    const totalAmount = toRepay.reduce((s, m) => s + Number(m.amount), 0);
    if (totalAmount > balance) return fail("Insufficient balance for repayment");
    setProcessing(true); setError(""); setPinError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      for (const mp of toRepay) {
        const schedule = autoSaves.find(a => a.id === mp.schedule_id);
        if (schedule?.goal_id) {
          await supabase.rpc("savings_deposit", { p_goal_id: schedule.goal_id, p_amount: mp.amount, p_source: "dps_repay" });
        } else {
          const { data: prof } = await supabase.from("profiles").select("balance").eq("user_id", user.id).single();
          if (prof) await supabase.from("profiles").update({ balance: Number(prof.balance) - Number(mp.amount) } as any).eq("user_id", user.id);
        }
        await supabase.from("dps_missed_payments" as any).update({ repaid: true, repaid_at: new Date().toISOString() }).eq("id", mp.id);
      }
      // Aggregate repayments per schedule and update counters for each
      const bySchedule = new Map<string, number>();
      for (const mp of toRepay) {
        bySchedule.set(mp.schedule_id, (bySchedule.get(mp.schedule_id) ?? 0) + 1);
      }
      for (const [scheduleId, count] of bySchedule) {
        const schedule = autoSaves.find(a => a.id === scheduleId);
        if (!schedule) continue;
        await supabase.from("savings_auto_save").update({
          total_paid: (schedule.total_paid ?? 0) + count,
          missed_count: Math.max(0, (schedule.missed_count ?? 0) - count),
        } as any).eq("id", scheduleId);
      }
      await fetchBalance();
      loadMissedPayments(); loadAutoSaves();
      fireSuccessConfetti();
      toast.success(`৳${totalAmount.toLocaleString()} repaid for ${toRepay.length} missed installment(s)`);
      setStep("autosave"); setPin(""); setSelectedMissedIds([]);
    } catch (err: any) { setPin(""); setError(err.message || "Repayment failed"); }
    finally { setProcessing(false); }
  };

  const deleteAutoSave = async (id: string) => {
    if (deletePin.length < 4) { setDeletePinError("Enter your 4-digit PIN"); return; }
    setDeleting(true); setDeletePinError("");
    const pinValid = await verifyPin(deletePin);
    if (!pinValid) { setDeletePinError("Incorrect PIN"); setDeletePin(""); setDeleting(false); return; }
    await supabase.from("savings_auto_save").delete().eq("id", id);
    loadAutoSaves(); toast.success("Schedule removed");
    setDeleteTarget(null); setDeletePin(""); setDeleting(false);
  };

  // ─── Withdraw completed goal → wallet ────────
  const handleWithdrawGoal = async (goalId: string, goalName: string, amt: number) => {
    setProcessing(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("withdraw_completed_goal" as any, { p_goal_id: goalId });
      if (rpcErr) throw rpcErr;
      await fetchBalance();
      loadGoals();
      fireSuccessConfetti();
      toast.success(`🎉 ৳${Number((data as any)?.amount ?? amt).toLocaleString()} from "${goalName}" added to wallet!`);
    } catch (err: any) {
      toast.error(err.message || "Withdrawal failed");
    } finally { setProcessing(false); }
  };

  // ─── Claim matured DPS payout → wallet ────────
  const handleClaimMaturedDps = async (planId: string) => {
    setProcessing(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("settle_matured_dps" as any, { p_plan_id: planId });
      if (rpcErr) throw rpcErr;
      const result = data as any;
      await fetchBalance();
      loadAutoSaves();
      fireSuccessConfetti();
      toast.success(`🎉 ৳${Number(result?.total ?? 0).toLocaleString()} credited (incl. ৳${Number(result?.profit ?? 0).toLocaleString()} profit)`);
    } catch (err: any) {
      toast.error(err.message || "Claim failed");
    } finally { setProcessing(false); }
  };

  // ─── Gold handlers ────────
  const currentGoldPrice = goldKarat === "24k" ? LIVE_GOLD_24K_PRICE : LIVE_GOLD_PRICE;

  const handleBuyGold = async () => {
    const grams = parseFloat(goldGrams);
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (!grams || grams <= 0) return fail("Enter valid grams");
    const cost = Math.round(grams * currentGoldPrice);
    const fee = Math.round(cost * 0.015);
    const totalCost = cost + fee;
    if (totalCost > balance) return fail("Insufficient balance");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    setProcessing(true); setPinError(""); setError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      const { data, error: rpcErr } = await supabase.rpc("buy_gold" as any, { p_grams: grams, p_price_per_gram: currentGoldPrice, p_karat: goldKarat });
      if (rpcErr) throw rpcErr;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      await fetchBalance();
      loadGoldHoldings();
      fireSuccessConfetti();
      toast.success(`🪙 Purchased ${grams}g gold for ৳${totalCost.toLocaleString()} (fee ৳${fee})`);
       setGoldGrams(""); setGoldStep("portfolio"); setPin(""); setTradeTermsAccepted(false);
    } catch (err: any) { setPin(""); setTradeTermsAccepted(false); setError(err.message || "Failed to buy gold"); }
    finally { setProcessing(false); }
  };

  const handleSellGold = async () => {
    const grams = parseFloat(goldGrams);
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (!grams || grams <= 0) return fail("Enter valid grams");
    if (grams > goldHolding.grams) return fail("Insufficient gold balance");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    setProcessing(true); setPinError(""); setError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      const { data, error: rpcErr } = await supabase.rpc("sell_gold" as any, { p_grams: grams, p_price_per_gram: currentGoldPrice, p_karat: goldKarat });
      if (rpcErr) throw rpcErr;
      await fetchBalance();
      loadGoldHoldings();
      const revenue = Math.round(grams * currentGoldPrice);
      const fee = Math.round(revenue * 0.015);
      const netRevenue = revenue - fee;
      toast.success(`💰 Sold ${grams}g gold — received ৳${netRevenue.toLocaleString()} (fee ৳${fee})`);
       setGoldGrams(""); setGoldStep("portfolio"); setPin(""); setTradeTermsAccepted(false);
    } catch (err: any) { setPin(""); setTradeTermsAccepted(false); setError(err.message || "Failed to sell gold"); }
    finally { setProcessing(false); }
  };

  const totalGoldGrams = goldHoldings22k.grams + goldHoldings24k.grams;
  const totalGoldValue = Math.round((goldHoldings22k.grams * LIVE_GOLD_PRICE) + (goldHoldings24k.grams * LIVE_GOLD_24K_PRICE));
  const totalGoldCost = Math.round((goldHoldings22k.grams * goldHoldings22k.avgBuyPrice) + (goldHoldings24k.grams * goldHoldings24k.avgBuyPrice));
  const goldValue = Math.round(goldHolding.grams * currentGoldPrice);
  const goldProfit = goldValue - Math.round(goldHolding.grams * goldHolding.avgBuyPrice);
  const goldProfitPct = goldHolding.avgBuyPrice > 0 ? ((currentGoldPrice - goldHolding.avgBuyPrice) / goldHolding.avgBuyPrice * 100) : 0;

  // ─── Stock handlers ────────
  const handleBuyStock = async () => {
    if (!selectedStock) return;
    const qty = parseInt(stockQty);
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (!qty || qty <= 0) return fail("Enter valid quantity");
    const cost = Math.round(qty * selectedStock.price);
    const brokerage = 15;
    const totalCost = cost + brokerage;
    if (totalCost > balance) return fail("Insufficient balance");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    setProcessing(true); setPinError(""); setError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      const { data, error: rpcErr } = await supabase.rpc("buy_stock" as any, { p_symbol: selectedStock.symbol, p_name: selectedStock.name, p_quantity: qty, p_price: selectedStock.price });
      if (rpcErr) throw rpcErr;
      await fetchBalance();
      loadStockHoldings();
      fireSuccessConfetti();
      toast.success(`📈 Bought ${qty} ${selectedStock.symbol} for ৳${totalCost.toLocaleString()} (brokerage ৳${brokerage})`);
       setStockQty(""); setSelectedStock(null); setStockStep("portfolio"); setPin(""); setTradeTermsAccepted(false);
    } catch (err: any) { setPin(""); setTradeTermsAccepted(false); setError(err.message || "Failed to buy stock"); }
    finally { setProcessing(false); }
  };

  const handleSellStock = async () => {
    if (!selectedStock) return;
    const qty = parseInt(stockQty);
    const holding = stockHoldings.find(h => h.symbol === selectedStock.symbol);
    const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };
    if (!qty || qty <= 0) return fail("Enter valid quantity");
    if (!holding || qty > holding.qty) return fail("Insufficient shares");
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    setProcessing(true); setPinError(""); setError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      const { data, error: rpcErr } = await supabase.rpc("sell_stock" as any, { p_symbol: selectedStock.symbol, p_quantity: qty, p_price: selectedStock.price });
      if (rpcErr) throw rpcErr;
      await fetchBalance();
      loadStockHoldings();
      const revenue = Math.round(qty * selectedStock.price);
      const brokerage = 15;
      const netRevenue = revenue - brokerage;
      toast.success(`💰 Sold ${qty} ${selectedStock.symbol} — received ৳${netRevenue.toLocaleString()} (brokerage ৳${brokerage})`);
       setStockQty(""); setSelectedStock(null); setStockStep("portfolio"); setPin(""); setTradeTermsAccepted(false);
    } catch (err: any) { setPin(""); setTradeTermsAccepted(false); setError(err.message || "Failed to sell stock"); }
    finally { setProcessing(false); }
  };


  const totalStockValue = stockHoldings.reduce((s, h) => s + h.qty * h.currentPrice, 0);
  const totalStockCost = stockHoldings.reduce((s, h) => s + h.qty * h.avgPrice, 0);
  const totalStockProfit = totalStockValue - totalStockCost;
  const activeGoals = goals.filter(g => g.status === "active");
  const totalSaved = activeGoals.reduce((s, g) => s + Number(g.saved_amount), 0);
  const totalGoalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount), 0);

  // ─── Header config ────────
  const headerGradient = mainTab === "savings"
    ? "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))"
    : mainTab === "goals"
    ? "linear-gradient(135deg, hsl(160 60% 28%), hsl(172 55% 24%))"
    : mainTab === "gold"
    ? "linear-gradient(135deg, hsl(43 90% 48%), hsl(35 85% 38%))"
    : "linear-gradient(135deg, hsl(217 80% 45%), hsl(230 70% 35%))";

  const headerTitle = mainTab === "savings" ? "Savings & DPS"
    : mainTab === "goals" ? "My Goals"
    : mainTab === "gold" ? "Gold Investment" : "Stock Market";
  const headerSub = mainTab === "savings"
    ? `Total Saved: ৳${totalSaved.toLocaleString()}`
    : mainTab === "goals"
    ? `${activeGoals.length} goal${activeGoals.length !== 1 ? "s" : ""} • ৳${totalSaved.toLocaleString()} saved`
    : mainTab === "gold" ? `Gold Price: ৳${LIVE_GOLD_PRICE.toLocaleString()}/g`
    : `Portfolio: ৳${Math.round(totalStockValue).toLocaleString()}`;

  const handleBack = () => {
    setError("");
    if (mainTab === "savings") {
      if (step === "review") { setPin(""); setPinError(""); setTermsAccepted(false); setStep(enableAutoSaveInCreate ? "create" : "dps-create"); }
      else if (step === "goal-review") { setPin(""); setPinError(""); setStep("create"); }
      else if (step === "dps-create") { setStep("autosave"); }
      else if (step === "repay-missed") { setPin(""); setPinError(""); setSelectedMissedIds([]); setStep("autosave"); }
      else if (step === "dps-detail") { setStep("autosave"); setSelectedSchedule(null); }
      else if (step === "home") onClose();
      else setStep("home");
    } else if (mainTab === "goals") {
      if (step === "goal-detail") { setStep("home"); setSelectedGoal(null); }
      else if (step === "home") setMainTab("savings");
      else setStep("home");
    } else if (mainTab === "gold") {
      if (goldStep === "portfolio") setMainTab("savings");
      else setGoldStep("portfolio");
    } else {
      if (stockStep === "market") setMainTab("savings");
      else setStockStep("market");
    }
  };


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* ═══════ HEADER ═══════ */}
      <motion.div className="px-4 pt-3 pb-3 text-white relative overflow-hidden"
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{ background: headerGradient }}>
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/8 blur-xl" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/6 blur-lg" />
        <div className="flex items-center gap-3 relative z-10">
          <motion.button whileTap={{ scale: 0.88 }} onClick={handleBack}
            className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors shrink-0">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold leading-tight">{headerTitle}</p>
            <p className="text-[11px] opacity-70">{headerSub}</p>
          </div>
{/* Clean header — no action buttons */}
        </div>
        <div className="flex gap-1 mt-3 relative z-10">
          {([
            { key: "savings" as MainTab, icon: Wallet, label: "Savings" },
            { key: "goals" as MainTab, icon: Target, label: "Goals" },
            { key: "gold" as MainTab, icon: Coins, label: "Gold" },
            { key: "stocks" as MainTab, icon: LineChart, label: "Stocks" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => { setMainTab(tab.key); setStep("home"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all ${mainTab === tab.key ? "bg-white/25 text-white shadow-sm" : "bg-white/8 text-white/60 hover:bg-white/12"}`}>
              <tab.icon size={13} />{tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ═══════ BODY ═══════ */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4">
        <AnimatePresence mode="wait">

          {/* ══════════ SAVINGS HOME ══════════ */}
          {mainTab === "savings" && step === "home" && (
            <motion.div key="s-home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="rounded-[20px] p-4 border border-primary/20 bg-gradient-to-br from-primary/8 to-primary/3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary/15"><TrendingUp size={20} className="text-primary" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Saved</p>
                    <p className="text-[24px] font-black text-foreground leading-tight">৳{totalSaved.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Premium 2×2 portfolio grid: DPS · Goals · Gold · Stocks */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* DPS PLANS tile */}
                <button onClick={() => setStep("autosave")} className="text-left p-3.5 rounded-[18px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 space-y-1.5 hover:shadow-md hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(160 72% 38%), hsl(178 62% 28%))" }}>
                    <CalendarClock size={16} className="text-white" />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DPS Plans</p>
                  <p className="text-[16px] font-black text-foreground tabular-nums">
                    {autoSaves.filter(a => a.is_active).length > 0 ? `${autoSaves.filter(a => a.is_active).length} active` : "—"}
                  </p>
                  {autoSaves.filter(a => a.is_active).length > 0 && (
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ৳{autoSaves.filter(a => a.is_active).reduce((s, a) => s + Number(a.amount) * Number(a.total_paid ?? 0), 0).toLocaleString()} saved
                    </p>
                  )}
                </button>

                {/* SAVING GOALS tile */}
                <button onClick={() => { setMainTab("goals"); setStep("home"); }} className="text-left p-3.5 rounded-[18px] border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-violet-600/5 space-y-1.5 hover:shadow-md hover:border-violet-500/40 hover:-translate-y-0.5 transition-all">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(262 72% 55%), hsl(280 62% 45%))" }}>
                    <Target size={16} className="text-white" />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saving Goals</p>
                  <p className="text-[16px] font-black text-foreground tabular-nums">
                    {activeGoals.length > 0 ? `${activeGoals.length} active` : "—"}
                  </p>
                  {activeGoals.length > 0 && (
                    <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                      ৳{totalSaved.toLocaleString()} / ৳{totalGoalTarget.toLocaleString()}
                    </p>
                  )}
                </button>

                <button onClick={() => setMainTab("gold")} className="text-left p-3.5 rounded-[18px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 space-y-1.5 hover:shadow-md hover:border-amber-500/40 hover:-translate-y-0.5 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center"><Coins size={16} className="text-amber-600 dark:text-amber-400" /></div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gold</p>
                  <p className="text-[16px] font-black text-foreground">{totalGoldGrams > 0 ? `${totalGoldGrams}g` : "—"}</p>
                  {totalGoldGrams > 0 && (
                    <p className={`text-[10px] font-bold flex items-center gap-0.5 ${totalGoldValue - totalGoldCost >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {totalGoldValue - totalGoldCost >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{totalGoldValue - totalGoldCost >= 0 ? "+" : ""}৳{Math.abs(totalGoldValue - totalGoldCost).toLocaleString()}
                    </p>
                  )}
                </button>
                <button onClick={() => setMainTab("stocks")} className="text-left p-3.5 rounded-[18px] border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center"><LineChart size={16} className="text-blue-600 dark:text-blue-400" /></div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stocks</p>
                  <p className="text-[16px] font-black text-foreground">{stockHoldings.length > 0 ? `${stockHoldings.length} held` : "—"}</p>
                  {totalStockProfit !== 0 && (
                    <p className={`text-[10px] font-bold flex items-center gap-0.5 ${totalStockProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {totalStockProfit >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{totalStockProfit >= 0 ? "+" : ""}৳{Math.round(totalStockProfit).toLocaleString()}
                    </p>
                  )}
                </button>
              </div>

              {/* Start a DPS Plan — premium action button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep("autosave")}
                className="w-full flex items-center gap-3.5 p-4 rounded-[20px] border border-primary/30 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent hover:shadow-lg hover:border-primary/50 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                  <CalendarClock size={22} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-bold text-foreground">Start a DPS Plan</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Auto-collect from wallet • Earn 2-5% profit</p>
                </div>
                <ChevronRight size={18} className="text-muted-foreground shrink-0" />
              </motion.button>

            </motion.div>
          )}

          {/* ══════════ GOALS TAB HOME ══════════ */}
          {mainTab === "goals" && step === "home" && (
            <motion.div key="g-home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Start a Goal Button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep("pick-goal")}
                className="w-full flex items-center gap-3.5 p-4 rounded-[20px] border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:shadow-lg hover:border-primary/50 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Target size={24} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-bold text-foreground">Start a Goal to Save Money</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Choose from 12 categories or create your own</p>
                </div>
                <ChevronRight size={18} className="text-muted-foreground shrink-0" />
              </motion.button>

              {/* Existing Goals List */}
              {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : goals.length === 0 ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8 space-y-3 rounded-[20px] border border-dashed border-border/60 bg-muted/20">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Target size={28} className="text-primary" />
                  </div>
                  <p className="text-[14px] font-bold text-foreground">No goals yet</p>
                  <p className="text-[12px] text-muted-foreground max-w-[220px] mx-auto">Tap any category above to create your first savings goal</p>
                </motion.div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Your Goals ({activeGoals.length})</p>
                  {goals.map((goal, i) => {
                    const saved = Number(goal.saved_amount);
                    const target = Number(goal.target_amount);
                    const isCompleted = goal.status === "completed" || (target > 0 && saved >= target);
                    const isWithdrawn = goal.status === "withdrawn";
                    const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
                    const displaySaved = Math.min(saved, target);
                    const bonus = Math.max(0, saved - target);
                    const remaining = Math.max(0, target - saved);
                    const wAmount = Number((goal as any).withdrawn_amount ?? 0);
                    const wAt = (goal as any).withdrawn_at ? new Date((goal as any).withdrawn_at) : null;
                    const openDetail = async () => {
                      setSelectedGoal(goal);
                      const { data: deps } = await supabase.from("savings_deposits").select("id, amount, source, created_at").eq("goal_id", goal.id).order("created_at", { ascending: true });
                      setGoalDeposits((deps as any[]) ?? []);
                      setStep("goal-detail");
                    };

                    // ───────── WITHDRAWN: archived layout (no progress bar) ─────────
                    if (isWithdrawn) {
                      return (
                        <motion.div key={goal.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 350, damping: 28 }}
                          className="bg-muted/30 rounded-[20px] border border-border/40 p-4 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-2">
                            <button onClick={openDetail} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                              <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border/40 flex items-center justify-center grayscale opacity-70">
                                <span className="text-[24px]">{goal.emoji}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[14px] font-bold text-muted-foreground truncate">{goal.name}</p>
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-wide">✓ Withdrawn</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  ৳{(wAmount > 0 ? wAmount : saved).toLocaleString()} paid out
                                  {wAt && ` • ${wAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                                </p>
                              </div>
                            </button>
                            <button
                              onClick={() => { setDeleteTarget({ type: "goal", id: goal.id, label: goal.name }); setDeletePin(""); setDeletePinError(""); }}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              aria-label="Archive goal"
                            ><Trash2 size={14} /></button>
                          </div>
                        </motion.div>
                      );
                    }

                    // ───────── ACTIVE / COMPLETED ─────────
                    return (
                      <motion.div key={goal.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 350, damping: 28 }}
                        className={`bg-card rounded-[20px] border shadow-[var(--shadow-card)] p-4 space-y-3 backdrop-blur-sm ${isCompleted ? "border-primary/60 ring-1 ring-primary/30" : "border-border/50"}`}>
                        <div className="flex items-center justify-between">
                          <button onClick={openDetail} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center">
                              <span className="text-[24px]">{goal.emoji}</span>
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-[14px] font-bold text-foreground truncate">{goal.name}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[11px] text-muted-foreground">৳{displaySaved.toLocaleString()} / ৳{target.toLocaleString()}</p>
                                {bonus > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                                    +৳{bonus.toLocaleString()} bonus
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase tracking-wide">Ready to withdraw</span>
                                )}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-1.5">
                            {isCompleted ? <CheckCircle2 size={20} className="text-primary shrink-0" />
                              : <button onClick={openDetail}><ChevronRight size={16} className="text-muted-foreground/50 shrink-0" /></button>}
                            <button onClick={() => { setDeleteTarget({ type: "goal", id: goal.id, label: goal.name }); setDeletePin(""); setDeletePinError(""); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-2.5 rounded-full bg-muted/80 overflow-hidden">
                            <motion.div
                              key={`${goal.id}-${saved}`}
                              className={`h-full rounded-full ${isCompleted ? "bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500" : "bg-gradient-to-r from-primary via-emerald-500 to-emerald-400"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.9, ease: "easeOut" }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-primary">{pct.toFixed(0)}%{isCompleted ? " 🎉" : ""}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">
                              {isCompleted ? "Goal achieved" : `৳${remaining.toLocaleString()} remaining`}
                            </p>
                          </div>
                        </div>
                        {isCompleted && saved > 0 && (
                          <motion.button
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            whileTap={{ scale: 0.97 }}
                            disabled={processing}
                            onClick={(e) => { e.stopPropagation(); handleWithdrawGoal(goal.id, goal.name, saved); }}
                            className="w-full h-10 rounded-xl text-white font-bold text-[12px] shadow-md flex items-center justify-center gap-1.5 disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                            <CheckCircle2 size={14} /> Withdraw ৳{saved.toLocaleString()} to Wallet
                          </motion.button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════ PICK GOAL CATEGORY ══════════ */}
          {mainTab === "goals" && step === "pick-goal" && (
            <motion.div key="pick-goal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setStep("home")} className="p-1.5 rounded-xl hover:bg-muted/60 transition-colors">
                  <ChevronLeft size={18} className="text-muted-foreground" />
                </button>
                <p className="text-[13px] font-bold text-foreground">Choose a Goal Category</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LIFE_GOAL_PRESETS.map((preset, i) => (
                  <motion.button key={preset.name}
                    initial={{ opacity: 0, y: 16, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.04, type: "spring", stiffness: 350, damping: 28 }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => {
                      if (preset.name === "Custom") { setNewEmoji("✏️"); setNewName(""); }
                      else { setNewEmoji(preset.emoji); setNewName(preset.name); }
                      setNewTarget(""); setNewInitialDeposit(""); setError(""); setStep("create");
                    }}
                    className={`relative flex flex-col items-center gap-1.5 p-3.5 rounded-[18px] border backdrop-blur-sm transition-all bg-gradient-to-br ${preset.gradient} ${preset.border} hover:shadow-lg hover:scale-[1.02]`}>
                    <span className="text-[28px] drop-shadow-sm">{preset.emoji}</span>
                    <p className="text-[10px] font-bold text-foreground leading-tight text-center">{preset.name}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {(mainTab === "savings" || mainTab === "goals") && step === "add" && (
            <motion.div key="s-add" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {selectedGoal && (
                <div className="flex items-center gap-3 p-3.5 rounded-[18px] border border-primary/60 bg-primary/10">
                  <span className="text-2xl">{selectedGoal.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-semibold text-foreground">{selectedGoal.name}</p>
                    <p className="text-[11px] text-muted-foreground">৳{(Number(selectedGoal.target_amount) - Number(selectedGoal.saved_amount)).toLocaleString()} remaining</p>
                  </div>
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                </div>
              )}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">৳</span>
                  <input type="number" inputMode="decimal" placeholder="0.00" value={amount}
                    onChange={e => { setAmount(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 text-[22px] font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_AMOUNTS.map(q => (
                    <button key={q} onClick={() => setAmount(String(q))}
                      className={`flex-1 min-w-[60px] py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${amount === String(q) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                      ৳{q >= 1000 ? `${q / 1000}k` : q}
                    </button>
                  ))}
                </div>
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
              </div>
              <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
              <SlideToConfirm onConfirm={handleSave} label={processing ? "Processing…" : "Slide to Save"} disabled={pin.length < 4 || processing} pinComplete={pin.length === 4} />
            </motion.div>
          )}

          {/* ══════════ SAVINGS: CREATE GOAL ══════════ */}
          {(mainTab === "savings" || mainTab === "goals") && step === "create" && (
            <motion.div key="s-create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Selected Goal Category (dropdown) */}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Savings Goal</p>
                <Select
                  value={newEmoji === "✏️" ? "Custom" : newName}
                  onValueChange={(val) => {
                    if (val === "Custom") { setNewEmoji("✏️"); setNewName(""); }
                    else {
                      const preset = LIFE_GOAL_PRESETS.find(p => p.name === val);
                      if (preset) { setNewEmoji(preset.emoji); setNewName(preset.name); }
                    }
                    setError("");
                  }}
                >
                  <SelectTrigger className="rounded-xl h-12 text-[14px] font-semibold">
                    <SelectValue placeholder="Select a category">
                      <span className="flex items-center gap-2">
                        <span className="text-lg">{newEmoji}</span>
                        <span>{newEmoji === "✏️" ? "Custom Goal" : newName || "Select a category"}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LIFE_GOAL_PRESETS.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{preset.emoji}</span>
                          <span className="font-medium">{preset.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom name input — shown when Custom is selected */}
              {newEmoji === "✏️" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Custom Goal Name</p>
                  <input placeholder="e.g. New Laptop, Family Trip" value={newName} onChange={e => { setNewName(e.target.value); setError(""); }}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-[14px] font-medium outline-none placeholder:text-muted-foreground/40 border border-border/60" />
                </motion.div>
              )}

              {/* Target Amount */}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Target Amount</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">৳</span>
                  <input type="number" inputMode="decimal" placeholder="0" value={newTarget} onChange={e => { setNewTarget(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 text-[20px] font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[5000, 10000, 25000, 50000, 100000].map(q => (
                    <button key={q} onClick={() => setNewTarget(String(q))}
                      className={`flex-1 min-w-[55px] py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${newTarget === String(q) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                      ৳{q >= 1000 ? `${q / 1000}k` : q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Deposit */}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Initial Deposit <span className="text-destructive">*</span></p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">৳</span>
                  <input type="number" inputMode="decimal" placeholder="0" value={newInitialDeposit} onChange={e => { setNewInitialDeposit(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 text-[20px] font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[100, 500, 1000, 2000, 5000].map(q => (
                    <button key={q} onClick={() => setNewInitialDeposit(String(q))}
                      className={`flex-1 min-w-[55px] py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${newInitialDeposit === String(q) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                      ৳{q >= 1000 ? `${q / 1000}k` : q}
                    </button>
                  ))}
                </div>
                {parseFloat(newInitialDeposit) > balance && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1"><AlertCircle size={10} /> Exceeds wallet balance (৳{balance.toLocaleString()})</p>
                )}
                <p className="text-[10px] text-muted-foreground px-1">Wallet: ৳{balance.toLocaleString()}</p>
              </div>

              {/* ═══ Inline Auto-Save Toggle ═══ */}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                      <CalendarClock size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">Auto-Save & Invest</p>
                      <p className="text-[10px] text-muted-foreground">Set up automatic savings plan</p>
                    </div>
                  </div>
                  <Switch checked={enableAutoSaveInCreate} onCheckedChange={setEnableAutoSaveInCreate} />
                </div>

                <AnimatePresence>
                  {enableAutoSaveInCreate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                      {/* Sharia badge */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
                        <ShieldCheck size={14} className="text-primary" />
                        <p className="text-[10px] font-bold text-primary">100% Halal • No Interest • Trade-Based Profit</p>
                      </div>

                      {/* Frequency */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Save Frequency</p>
                        <Select value={autoFreq} onValueChange={setAutoFreq}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Amount */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount per {autoFreq === "daily" ? "Day" : autoFreq === "weekly" ? "Week" : "Month"}</p>
                        <div className="flex gap-2 flex-wrap">
                          {PRESET_AMOUNTS.map(q => (
                            <button key={q} onClick={() => { setAutoAmount(String(q)); setAutoCustom(false); }}
                              className={`flex-1 min-w-[55px] py-2 rounded-xl text-[12px] font-semibold transition-colors ${!autoCustom && autoAmount === String(q) ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                              ৳{q >= 1000 ? `${q / 1000}k` : q}
                            </button>
                          ))}
                          <button onClick={() => { setAutoCustom(true); setAutoAmount(""); }}
                            className={`flex-1 min-w-[55px] py-2 rounded-xl text-[12px] font-semibold transition-colors ${autoCustom ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>Custom</button>
                        </div>
                        {autoCustom && (
                          <div className="relative mt-2">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-bold text-muted-foreground">৳</span>
                            <input type="number" inputMode="decimal" placeholder="Enter amount" value={autoAmount} onChange={e => setAutoAmount(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 text-[16px] font-bold bg-muted rounded-xl outline-none text-foreground placeholder:text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      {/* Duration */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Duration</p>
                        <Select value={autoDuration} onValueChange={setAutoDuration}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>{DURATION_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                          <span>Ends: {new Date(calcEndsAt(autoDuration)).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}</span>
                          <span className="flex items-center gap-0.5"><Lock size={9} /> Min lock: {selectedDuration.minLock} months</span>
                        </div>
                      </div>

                      {/* Strategy */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Investment Strategy</p>
                        <div className="space-y-2">
                          {INVESTMENT_STRATEGIES.map(strat => (
                            <button key={strat.key} onClick={() => setAutoStrategy(strat.key)}
                              className={`w-full flex items-center gap-3 p-3 rounded-[14px] border transition-all text-left ${autoStrategy === strat.key ? "border-primary/50 bg-primary/8 shadow-sm" : "border-border/60 bg-muted/30 hover:bg-muted/50"}`}>
                              <span className="text-xl">{strat.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-foreground">{strat.label}</p>
                                <p className="text-[10px] text-muted-foreground">{strat.desc}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[14px] font-black text-emerald-600">~{getReturnRange(strat.key)}%</p>
                                <p className="text-[9px] text-muted-foreground">est. annual</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Estimated Profit */}
                      {estimatedProfit && estimatedProfit.totalDeposits > 0 && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                          className="rounded-[16px] p-4 bg-gradient-to-br from-emerald-500/12 to-emerald-600/5 border border-emerald-500/25 space-y-3">
                          <div className="flex items-center gap-2">
                            <Gift size={16} className="text-emerald-600" />
                            <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300">Estimated Returns</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-card/60 backdrop-blur-sm rounded-xl p-2.5 text-center">
                              <p className="text-[9px] text-muted-foreground font-semibold uppercase">You Save</p>
                              <p className="text-[14px] font-black text-foreground">৳{estimatedProfit.totalDeposits.toLocaleString()}</p>
                            </div>
                            <div className="bg-card/60 backdrop-blur-sm rounded-xl p-2.5 text-center">
                              <p className="text-[9px] text-muted-foreground font-semibold uppercase">Est. Profit</p>
                              <p className="text-[14px] font-black text-emerald-600">+৳{estimatedProfit.profit.toLocaleString()}</p>
                            </div>
                            <div className="bg-card/60 backdrop-blur-sm rounded-xl p-2.5 text-center">
                              <p className="text-[9px] text-muted-foreground font-semibold uppercase">Total Value</p>
                              <p className="text-[14px] font-black text-foreground">৳{estimatedProfit.totalValue.toLocaleString()}</p>
                            </div>
                          </div>
                          <p className="text-[9px] text-muted-foreground text-center">
                            *Based on ~{estimatedProfit.returnPct}% historical return. Not guaranteed.
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {error && <p className="text-[12px] text-destructive font-medium px-1">{error}</p>}

              <motion.button whileTap={{ scale: 0.96 }}
                onClick={() => {
                  if (enableAutoSaveInCreate) {
                    // Validate goal + auto-save, then go to review
                    if (!newName.trim()) { setError("Select or enter a goal name"); return; }
                    const target = parseFloat(newTarget);
                    if (!target || target <= 0) { setError("Enter a valid target amount"); return; }
                    if (!autoAmtNum || autoAmtNum <= 0) { setError("Enter auto-save amount"); return; }
                    setError("");
                    setStep("review");
                  } else {
                    // Goal-only: validate then go to goal-review
                    if (!newName.trim()) { setError("Select or enter a goal name"); return; }
                    const target = parseFloat(newTarget);
                    if (!target || target <= 0) { setError("Enter a valid target amount"); return; }
                    const initialAmt = parseFloat(newInitialDeposit);
                    if (!initialAmt || initialAmt <= 0) { setError("Enter an initial deposit amount"); return; }
                    if (initialAmt > balance) { setError("Initial deposit exceeds wallet balance"); return; }
                    setError("");
                    setStep("goal-review");
                  }
                }}
                disabled={processing}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                {processing ? "Creating…" : enableAutoSaveInCreate ? "Continue to Review →" : "Continue to Review →"}
              </motion.button>
            </motion.div>
          )}

          {/* ══════════ GOAL-ONLY: REVIEW & CONFIRM ══════════ */}
          {(mainTab === "savings" || mainTab === "goals") && step === "goal-review" && (
            <motion.div key="g-review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Goal Summary Card */}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-5 space-y-4">
                <p className="text-[14px] font-bold text-foreground flex items-center gap-2"><FileText size={16} className="text-primary" /> Goal Summary</p>
                
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center">
                    <span className="text-[36px]">{newEmoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[18px] font-black text-foreground">{newName}</p>
                    <p className="text-[12px] text-muted-foreground">Savings Goal</p>
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                <div className="space-y-2.5">
                  {[
                    { label: "Goal Name", value: `${newEmoji} ${newName}` },
                    { label: "Target Amount", value: `৳${parseFloat(newTarget).toLocaleString()}` },
                    { label: "Initial Deposit", value: `৳${parseFloat(newInitialDeposit).toLocaleString()}` },
                    { label: "Auto-Save", value: "Not enabled" },
                    { label: "Lock-in Period", value: "3 months minimum" },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center text-[12px]">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy notice */}
              <div className="rounded-[14px] px-3.5 py-3 bg-amber-500/8 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Important Notice</p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  🔒 <strong>3-month mandatory lock-in</strong> — you cannot cancel this goal within the first 3 months after creation. 
                  You can add money to this goal anytime. Enable auto-save later from the Goals tab.
                </p>
              </div>

              {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}

              <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
              <SlideToConfirm onConfirm={handleCreateGoal} label={processing ? "Creating…" : "Slide to Create Goal"} disabled={pin.length < 4 || processing} pinComplete={pin.length === 4} />
            </motion.div>
          )}

          {/* ══════════ SAVINGS: ACTIVE DPS PLANS ══════════ */}
          {(mainTab === "savings" || mainTab === "goals") && step === "autosave" && (
            <motion.div key="s-auto" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Sharia badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
                <ShieldCheck size={14} className="text-primary" />
                <p className="text-[11px] font-bold text-primary">100% Halal • No Interest • Trade-Based Profit</p>
              </div>

              {/* Active Plans */}
              {autoSaves.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Active Plans</p>
                  {autoSaves.map(schedule => {
                    const linkedGoal = goals.find(g => g.id === schedule.goal_id);
                    const durOpt = DURATION_OPTIONS.find(d => d.value === schedule.duration);
                    const scheduleMissed = missedPayments.filter(m => m.schedule_id === schedule.id);
                    const totalInst = schedule.total_installments ?? 0;
                    const paid = schedule.total_paid ?? 0;
                    const missed = schedule.missed_count ?? 0;
                    const stratObj = INVESTMENT_STRATEGIES.find(s => s.key === schedule.strategy);
                    return (
                      <div key={schedule.id} className={`bg-card rounded-[16px] border p-3.5 space-y-2.5 cursor-pointer hover:shadow-md transition-shadow ${schedule.settled ? "border-primary/40 bg-primary/5" : "border-border/60"}`}
                        onClick={async () => {
                          setSelectedSchedule(schedule);
                          const linkedGoal = goals.find(g => g.id === schedule.goal_id);
                          // Source the timeline from the authoritative run-log so we always
                          // know exactly what happened (collected / missed / no_goal / skipped)
                          // and which goal was credited. Also pull wallet transactions to detect refunds.
                          const [{ data: runRows }, { data: txRows }] = await Promise.all([
                            (supabase.from as any)("dps_run_log")
                              .select("*")
                              .eq("schedule_id", schedule.id)
                              .order("created_at", { ascending: true })
                              .limit(500),
                            supabase.from("transactions")
                              .select("id, reference, status, amount, balance_after, description, created_at")
                              .like("reference", `DPS-INST-${schedule.id.substring(0, 8)}-%`)
                              .order("created_at", { ascending: true })
                              .limit(500),
                          ]);
                          const txByRef: Record<string, any> = {};
                          (txRows ?? []).forEach((t: any) => { if (t.reference) txByRef[t.reference] = t; });

                          const scheduleMissed = missedPayments.filter(m => m.schedule_id === schedule.id);
                          const repaidById: Record<string, boolean> = {};
                          scheduleMissed.forEach(m => { repaidById[m.id] = !!m.repaid; });

                          const timeline: Array<{ id: string; date: string; amount: number; status: "processed" | "missed" | "repaid" | "refunded" | "skipped" | "pending"; goalName?: string | null; goalId?: string | null; note?: string; txReference?: string | null; txId?: string | null; txStatus?: string | null; balanceAfter?: number | null; walletDelta?: number | null; refundReason?: string | null; outcome?: string | null }> = [];

                          const referencedTxRefs = new Set<string>();
                          (runRows as any[] ?? []).forEach((r: any) => { if (r.tx_reference) referencedTxRefs.add(r.tx_reference); });

                          // ─── Opening deposit ─────────
                          // The 1st installment is deducted immediately at schedule creation
                          // and may not have a dps_run_log entry. Surface it explicitly so
                          // the user can trace where the opening ৳ went.
                          const scheduleCreatedMs = new Date(schedule.created_at ?? schedule.next_run_at).getTime();
                          const openingWindowMs = 5 * 60 * 1000; // 5-minute grace
                          const openingTxs = (txRows ?? []).filter((t: any) => {
                            if (!t.reference || referencedTxRefs.has(t.reference)) return false;
                            const ts = new Date(t.created_at).getTime();
                            return ts >= scheduleCreatedMs - 2000 && ts <= scheduleCreatedMs + openingWindowMs;
                          });
                          // Also fetch a fallback opening deposit by short_id pattern when txRows didn't match
                          // (e.g. legacy `DPS-INST-XXXXXXXX` references without numeric suffix).
                          const fallbackOpening = await supabase.from("transactions")
                            .select("id, reference, status, amount, balance_after, description, created_at")
                            .eq("user_id", schedule.user_id ?? (await supabase.auth.getUser()).data.user?.id ?? "")
                            .like("reference", "DPS-INST-%")
                            .gte("created_at", new Date(scheduleCreatedMs - 2000).toISOString())
                            .lte("created_at", new Date(scheduleCreatedMs + openingWindowMs).toISOString())
                            .order("created_at", { ascending: true })
                            .limit(5);
                          const seenOpeningIds = new Set(openingTxs.map((t: any) => t.id));
                          (fallbackOpening.data ?? []).forEach((t: any) => {
                            if (!referencedTxRefs.has(t.reference) && !seenOpeningIds.has(t.id)) {
                              openingTxs.push(t);
                              seenOpeningIds.add(t.id);
                            }
                          });

                          openingTxs.forEach((tx: any, idx: number) => {
                            const refunded = tx.status === "reversed" || tx.status === "refunded";
                            timeline.push({
                              id: `opening-${tx.id}`,
                              date: tx.created_at,
                              amount: Number(tx.amount),
                              status: refunded ? "refunded" : "processed",
                              goalName: linkedGoal?.name ?? null,
                              goalId: linkedGoal?.id ?? null,
                              txReference: tx.reference,
                              txId: tx.id,
                              txStatus: tx.status,
                              balanceAfter: tx.balance_after ?? null,
                              walletDelta: refunded ? Number(tx.amount) : -Number(tx.amount),
                              refundReason: refunded ? (tx.description ?? "Reversed by system") : null,
                              outcome: "opening_deposit",
                              note: refunded
                                ? `Opening deposit • Refunded to wallet${tx.description ? ` — ${tx.description}` : ""}`
                                : "Opening deposit (1st installment, deducted at plan creation)",
                            });
                          });

                          (runRows as any[] ?? []).forEach((r: any) => {
                            const ref = r.tx_reference as string | null;
                            const tx = ref ? txByRef[ref] : null;
                            const refunded = tx && (tx.status === "reversed" || tx.status === "refunded");
                            if (r.outcome === "collected") {
                              timeline.push({
                                id: r.id, date: r.created_at, amount: Number(r.amount),
                                status: refunded ? "refunded" : "processed",
                                goalName: r.goal_name ?? linkedGoal?.name ?? null,
                                goalId: r.goal_id ?? linkedGoal?.id ?? null,
                                txReference: ref,
                                txId: tx?.id ?? null,
                                txStatus: tx?.status ?? null,
                                balanceAfter: tx?.balance_after ?? null,
                                walletDelta: refunded ? Number(r.amount) : -Number(r.amount),
                                refundReason: refunded ? (tx?.description ?? "Reversed by system") : null,
                                outcome: r.outcome,
                                note: refunded ? "Refunded to wallet" : undefined,
                              });
                            } else if (r.outcome === "missed") {
                              timeline.push({
                                id: r.id, date: r.created_at, amount: Number(r.amount),
                                status: "missed",
                                goalName: r.goal_name ?? linkedGoal?.name ?? null,
                                goalId: r.goal_id ?? linkedGoal?.id ?? null,
                                outcome: r.outcome,
                                note: r.reason ?? "Insufficient balance",
                              });
                            } else if (r.outcome === "no_goal" || r.outcome === "schedule_inactive" || r.outcome === "dedup_skipped" || r.outcome === "plan_expired") {
                              timeline.push({
                                id: r.id, date: r.created_at, amount: Number(r.amount || 0),
                                status: "skipped",
                                outcome: r.outcome,
                                note: r.reason ?? r.outcome,
                              });
                            }
                          });

                          // Mark missed entries that have since been repaid (legacy missed_payments table)
                          scheduleMissed.forEach(m => {
                            if (!m.repaid) return;
                            timeline.push({
                              id: `repaid-${m.id}`, date: m.due_date, amount: Number(m.amount),
                              status: "repaid", goalName: linkedGoal?.name ?? null,
                              goalId: linkedGoal?.id ?? null,
                              walletDelta: -Number(m.amount),
                              note: "Caught up later",
                            });
                          });

                          // Project upcoming pending installments (next N cycles up to total_installments)
                          const totalInst = schedule.total_installments ?? 0;
                          const paid = schedule.total_paid ?? 0;
                          const remaining = Math.max(0, totalInst - paid);
                          if (schedule.is_active && !schedule.settled && schedule.next_run_at && remaining > 0) {
                            const stepMs = schedule.frequency === "daily" ? 86400000
                              : schedule.frequency === "weekly" ? 7 * 86400000
                              : 30 * 86400000;
                            let cursor = new Date(schedule.next_run_at).getTime();
                            const projectCount = Math.min(remaining, 12);
                            for (let i = 0; i < projectCount; i++) {
                              timeline.push({
                                id: `pending-${schedule.id}-${i}`,
                                date: new Date(cursor).toISOString(),
                                amount: Number(schedule.amount),
                                status: "pending",
                                goalName: linkedGoal?.name ?? null,
                                goalId: linkedGoal?.id ?? null,
                              });
                              cursor += stepMs;
                            }
                          }

                          timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          setDpsTimeline(timeline);
                          setStep("dps-detail");
                        }}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-[13px] font-semibold text-foreground">৳{Number(schedule.amount).toLocaleString()} / {schedule.frequency}</p>
                              {schedule.settled && <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[9px] font-bold uppercase">Completed</span>}
                              {stratObj && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">{stratObj.icon} {stratObj.label}</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {linkedGoal ? `${linkedGoal.emoji} ${linkedGoal.name}` : "General Savings"}
                              {durOpt && ` • ${durOpt.label}`}
                            </p>
                            {totalInst > 0 && !schedule.settled && (
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-muted-foreground font-medium">{paid}/{totalInst} installments paid</span>
                                  <span className="font-bold text-primary">{totalInst > 0 ? Math.round((paid / totalInst) * 100) : 0}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted/80 overflow-hidden">
                                  <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500"
                                    initial={{ width: 0 }} animate={{ width: `${totalInst > 0 ? (paid / totalInst) * 100 : 0}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }} />
                                </div>
                              </div>
                            )}
                            {schedule.ends_at && !schedule.settled && (
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-muted-foreground"><Clock size={10} className="inline mr-0.5 -mt-0.5" />{remainingTime(schedule.ends_at)}</p>
                                {durOpt && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                                  <Lock size={8} /> {durOpt.minLock}m lock
                                </span>}
                              </div>
                            )}
                            {missed > 0 && scheduleMissed.length > 0 && !schedule.settled && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[9px] px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-bold flex items-center gap-1">
                                  <AlertTriangle size={9} /> {missed} missed
                                </span>
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  setRepayScheduleId(schedule.id);
                                  setSelectedMissedIds(scheduleMissed.map(m => m.id));
                                  setStep("repay-missed"); setError(""); setPin(""); setPinError("");
                                }} className="text-[10px] font-bold text-primary underline underline-offset-2">
                                  Repay Now
                                </button>
                              </div>
                            )}
                            {schedule.is_active && !schedule.settled && schedule.next_run_at && (
                              <p className="text-[9px] text-muted-foreground mt-1">
                                Next collection: {new Date(schedule.next_run_at).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            )}
                          </div>
                          {!schedule.settled && <Switch checked={schedule.is_active} onCheckedChange={() => toggleAutoSave(schedule.id, schedule.is_active)} />}
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "auto", id: schedule.id, label: `৳${Number(schedule.amount).toLocaleString()} ${schedule.frequency}` }); setDeletePin(""); setDeletePinError(""); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                        </div>
                        {(() => {
                          const isMatured = schedule.ends_at && new Date(schedule.ends_at) <= new Date();
                          if (!isMatured || schedule.settled) return null;
                          const principal = Number(schedule.amount) * (schedule.total_paid ?? 0);
                          const profit = Math.round(principal * 0.05 * 100) / 100;
                          const total = principal + profit;
                          if (principal <= 0) return null;
                          return (
                            <motion.button
                              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              whileTap={{ scale: 0.97 }}
                              disabled={processing}
                              onClick={(e) => { e.stopPropagation(); handleClaimMaturedDps(schedule.id); }}
                              className="w-full mt-1 rounded-xl px-3 py-2.5 text-white shadow-md flex items-center justify-between gap-2 disabled:opacity-60"
                              style={{ background: "linear-gradient(135deg, hsl(35 92% 48%), hsl(20 88% 42%))" }}>
                              <div className="text-left">
                                <p className="text-[11px] font-bold uppercase tracking-wide">🎉 Matured · Claim Now</p>
                                <p className="text-[10px] opacity-90">Principal ৳{principal.toLocaleString()} + Profit ৳{profit.toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] opacity-80">Total</p>
                                <p className="text-[14px] font-extrabold leading-none">৳{total.toLocaleString()}</p>
                              </div>
                            </motion.button>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-8 flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp size={24} className="text-primary" />
                  </div>
                  <p className="text-[14px] font-bold text-foreground">No Active DPS Plans Yet</p>
                  <p className="text-[12px] text-muted-foreground max-w-[240px]">Start your first savings & investment plan to grow your wealth with Sharia-compliant returns.</p>
                </div>
              )}

              {/* Open New DPS Button */}
              <motion.button whileTap={{ scale: 0.96 }}
                onClick={() => { setStep("dps-create"); setError(""); }}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                <Plus size={18} /> Open New DPS
              </motion.button>
            </motion.div>
          )}

          {/* ══════════ SAVINGS: DPS CREATE FORM ══════════ */}
          {(mainTab === "savings" || mainTab === "goals") && step === "dps-create" && (
            <motion.div key="s-dps-create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold text-foreground">Create Savings + Investment Plan</p>
                  <AvailableBalanceBadge />
                </div>

                {/* Frequency */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Save Frequency</p>
                  <Select value={autoFreq} onValueChange={setAutoFreq}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount per {autoFreq === "daily" ? "Day" : autoFreq === "weekly" ? "Week" : "Month"}</p>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_AMOUNTS.map(q => {
                      const bal = getBalance();
                      const insufficient = q > bal;
                      return (
                        <button key={q} onClick={() => { if (!insufficient) { setAutoAmount(String(q)); setAutoCustom(false); } }}
                          disabled={insufficient}
                          className={`flex-1 min-w-[55px] py-2 rounded-xl text-[12px] font-semibold transition-colors ${insufficient ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed" : !autoCustom && autoAmount === String(q) ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                          {insufficient ? <span className="text-[10px]">৳{q >= 1000 ? `${q / 1000}k` : q}<br/><span className="text-destructive/60">Low</span></span> : <>৳{q >= 1000 ? `${q / 1000}k` : q}</>}
                        </button>
                      );
                    })}
                    <button onClick={() => { setAutoCustom(true); setAutoAmount(""); }}
                      className={`flex-1 min-w-[55px] py-2 rounded-xl text-[12px] font-semibold transition-colors ${autoCustom ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>Custom</button>
                  </div>
                  {autoCustom && (
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-bold text-muted-foreground">৳</span>
                      <input type="number" inputMode="decimal" placeholder="Enter amount" value={autoAmount} onChange={e => setAutoAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-[16px] font-bold bg-muted rounded-xl outline-none text-foreground placeholder:text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Duration</p>
                  <Select value={autoDuration} onValueChange={setAutoDuration}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATION_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                    <span>Ends: {new Date(calcEndsAt(autoDuration)).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}</span>
                    <span className="flex items-center gap-0.5"><Lock size={9} /> Min lock: {selectedDuration.minLock} months</span>
                  </div>
                </div>

                {/* Investment strategy */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Investment Strategy</p>
                  <div className="space-y-2">
                    {INVESTMENT_STRATEGIES.map(strat => (
                      <button key={strat.key} onClick={() => setAutoStrategy(strat.key)}
                        className={`w-full flex items-center gap-3 p-3 rounded-[14px] border transition-all text-left ${autoStrategy === strat.key ? "border-primary/50 bg-primary/8 shadow-sm" : "border-border/60 bg-muted/30 hover:bg-muted/50"}`}>
                        <span className="text-xl">{strat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-foreground">{strat.label}</p>
                          <p className="text-[10px] text-muted-foreground">{strat.desc}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[14px] font-black text-emerald-600">~{getReturnRange(strat.key)}%</p>
                          <p className="text-[9px] text-muted-foreground">est. annual</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Link to goal */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Link to Goal (optional)</p>
                  <Select value={autoGoalId} onValueChange={(val) => {
                    if (val.startsWith("new:")) {
                      const preset = LIFE_GOAL_PRESETS.find(p => p.name === val.replace("new:", ""));
                      if (preset) {
                        setNewEmoji(preset.emoji); setNewName(preset.name); setNewTarget("");
                        setEnableAutoSaveInCreate(true); setStep("create");
                      }
                    } else {
                      setAutoGoalId(val);
                    }
                  }}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Savings</SelectItem>
                      {goals.filter(g => g.status === "active").map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                      {LIFE_GOAL_PRESETS.filter(p => p.name !== "Custom" && !goals.some(g => g.name === p.name)).map(preset => (
                        <SelectItem key={preset.name} value={`new:${preset.name}`}>{preset.emoji} + {preset.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Estimated Profit Card */}
                {estimatedProfit && estimatedProfit.totalDeposits > 0 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-[16px] p-4 bg-gradient-to-br from-emerald-500/12 to-emerald-600/5 border border-emerald-500/25 space-y-3">
                    <div className="flex items-center gap-2">
                      <Gift size={16} className="text-emerald-600" />
                      <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300">Estimated Returns on Completion</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-2.5 text-center">
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase">You Save</p>
                        <p className="text-[14px] font-black text-foreground">৳{estimatedProfit.totalDeposits.toLocaleString()}</p>
                      </div>
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-2.5 text-center">
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase">Est. Profit</p>
                        <p className="text-[14px] font-black text-emerald-600">+৳{estimatedProfit.profit.toLocaleString()}</p>
                      </div>
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-2.5 text-center">
                        <p className="text-[9px] text-muted-foreground font-semibold uppercase">Total Value</p>
                        <p className="text-[14px] font-black text-foreground">৳{estimatedProfit.totalValue.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center">
                      *Based on ~{estimatedProfit.returnPct}% historical return. Actual returns may vary. Not guaranteed.
                    </p>
                  </motion.div>
                )}

                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}

                <motion.button whileTap={{ scale: 0.96 }} 
                  onClick={() => {
                    if (!autoAmtNum || autoAmtNum <= 0) { setError("Select or enter an amount"); return; }
                    const bal = getBalance();
                    if (autoAmtNum > bal) { setError(`Insufficient balance. You need at least ৳${autoAmtNum.toLocaleString()} to open a DPS (1st installment is deposited immediately).`); return; }
                    setStep("review"); setError("");
                  }}
                  className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg"
                  style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                  Continue to Review →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ══════════ REPAY MISSED PAYMENTS ══════════ */}
          {mainTab === "savings" && step === "repay-missed" && (
            <motion.div key="repay-missed" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-destructive" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-foreground">Repay Missed Installments</p>
                    <p className="text-[11px] text-muted-foreground">Select payments to repay from your wallet</p>
                  </div>
                </div>
              </div>

              {(() => {
                const scheduleMissed = missedPayments.filter(m => m.schedule_id === repayScheduleId);
                const totalSelected = scheduleMissed.filter(m => selectedMissedIds.includes(m.id)).reduce((s, m) => s + Number(m.amount), 0);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{scheduleMissed.length} Missed Payment(s)</p>
                      <button onClick={() => {
                        if (selectedMissedIds.length === scheduleMissed.length) setSelectedMissedIds([]);
                        else setSelectedMissedIds(scheduleMissed.map(m => m.id));
                      }} className="text-[11px] font-bold text-primary">
                        {selectedMissedIds.length === scheduleMissed.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    {scheduleMissed.map(mp => (
                      <label key={mp.id} className={`flex items-center gap-3 p-3 rounded-[14px] border cursor-pointer transition-all ${selectedMissedIds.includes(mp.id) ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card"}`}>
                        <Checkbox checked={selectedMissedIds.includes(mp.id)} onCheckedChange={(v) => {
                          if (v) setSelectedMissedIds(prev => [...prev, mp.id]);
                          else setSelectedMissedIds(prev => prev.filter(id => id !== mp.id));
                        }} />
                        <div className="flex-1">
                          <p className="text-[13px] font-semibold text-foreground">৳{Number(mp.amount).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Due: {new Date(mp.due_date).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                      </label>
                    ))}
                    <div className="rounded-[14px] p-3 bg-muted/50 border border-border/40 flex items-center justify-between">
                      <span className="text-[12px] font-bold text-muted-foreground">Total to Repay</span>
                      <span className="text-[16px] font-black text-foreground">৳{totalSelected.toLocaleString()}</span>
                    </div>
                    {totalSelected > balance && (
                      <p className="text-[10px] text-destructive font-medium flex items-center gap-1 px-1"><AlertCircle size={10} /> Insufficient wallet balance (৳{balance.toLocaleString()})</p>
                    )}
                  </div>
                );
              })()}

              {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}

              <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
              <SlideToConfirm onConfirm={handleRepayMissed} label={processing ? "Processing…" : "Slide to Repay"} disabled={pin.length < 4 || processing || selectedMissedIds.length === 0} pinComplete={pin.length === 4 && selectedMissedIds.length > 0} />
            </motion.div>
          )}

          {/* ══════════ SAVINGS: REVIEW & CONFIRM ══════════ */}
          {(mainTab === "savings" || mainTab === "goals") && step === "review" && (
            <motion.div key="s-review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Summary card */}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <p className="text-[14px] font-bold text-foreground flex items-center gap-2"><FileText size={16} className="text-primary" /> Plan Summary</p>
                <div className="space-y-2">
                  {[
                    { label: "Frequency", value: autoFreq.charAt(0).toUpperCase() + autoFreq.slice(1) },
                    { label: "Amount", value: `৳${autoAmtNum.toLocaleString()} / ${autoFreq === "daily" ? "day" : autoFreq === "weekly" ? "week" : "month"}` },
                    { label: "Duration", value: selectedDuration.label },
                    { label: "Strategy", value: `${selectedStrategyObj.icon} ${selectedStrategyObj.label}` },
                    { label: "Linked Goal", value: enableAutoSaveInCreate ? `${newEmoji} ${newName} (new)` : autoGoalId === "general" ? "General Savings" : (goals.find(g => g.id === autoGoalId)?.name ?? "General Savings") },
                    ...(enableAutoSaveInCreate && newTarget ? [{ label: "Goal Target", value: `৳${parseFloat(newTarget).toLocaleString()}` }] : []),
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center text-[12px]">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
                {estimatedProfit && (
                  <div className="grid grid-cols-3 gap-2 mt-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase">Total Deposits</p>
                      <p className="text-[13px] font-black text-foreground">৳{estimatedProfit.totalDeposits.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase">Est. Profit</p>
                      <p className="text-[13px] font-black text-emerald-600">+৳{estimatedProfit.profit.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground font-semibold uppercase">Est. Return</p>
                      <p className="text-[13px] font-black text-primary">{estimatedProfit.returnPct}%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Early cancellation warning */}
              <div className="rounded-[14px] px-3.5 py-3 bg-amber-500/8 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Early Cancellation Policy</p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  🔒 <strong>3-month mandatory lock-in</strong> — you cannot cancel within the first 3 months. 
                  Early cancellation after lock-in incurs a <strong>{selectedDuration.penaltyPct}% penalty</strong> ({selectedDuration.penaltyPct <= 1 ? "1%" : "1–2%"}) on total saved amount.
                </p>
                <div className="rounded-xl px-3 py-2 bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
                    💰 Stay invested to earn up to 2-5% profit! Complete your goal and withdraw your full savings + profit!
                  </p>
                </div>
              </div>

              {/* T&C acceptance — inline */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-primary" /> Investment Terms & Conditions
                </p>
                <ScrollArea className="h-40 rounded-[14px] border border-border/60 bg-muted/30 p-3">
                  <div className="space-y-3 text-[11px] text-muted-foreground pr-2">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                        Investments carry risk. Past performance does not guarantee future returns.
                      </p>
                    </div>
                    {[
                      { n: 1, title: "Investment Products & Services", body: "EasyPay provides access to Gold Investment (22K and 24K digital gold), Sharia-compliant Halal Stock trading (DSE-listed securities), and automated savings plans. All investment products are offered on a best-effort basis and are subject to market conditions." },
                      { n: 2, title: "Platform Fees & Charges", body: "Gold Trading — 1.5% spread (buy/sell). Stock Trading — ৳15 flat brokerage per trade. Savings Goals — no platform fee." },
                      { n: 3, title: "Risk Disclosures", body: "Gold and stock prices are subject to market fluctuations. The value of your investments can go down as well as up. There is no guarantee of returns. EasyPay does not provide financial advice." },
                      { n: 4, title: "Lock-in Period & Early Withdrawal", body: "Auto-save investment plans have a mandatory 3-month lock-in period. Early cancellation after lock-in incurs a 1–2% penalty on total saved amount." },
                      { n: 5, title: "Sharia Compliance", body: "All stock investments are screened against Sharia compliance criteria. EasyPay follows a trade-based profit-sharing (Mudarabah) model. No interest (Riba) is involved." },
                      { n: 6, title: "Account Security & PIN", body: "All transactions require 4-digit PIN verification. You are responsible for keeping your PIN confidential." },
                      { n: 7, title: "Regulatory Compliance", body: "EasyPay operates under the guidelines of Bangladesh Bank and BSEC. KYC verification is mandatory for all investment activities." },
                      { n: 8, title: "Limitation of Liability", body: "EasyPay shall not be liable for any losses arising from market movements, system outages beyond our control, or force majeure events." },
                    ].map(s => (
                      <div key={s.n} className="space-y-0.5">
                        <p className="text-[10px] font-extrabold text-foreground flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-black text-primary shrink-0">{s.n}</span>
                          {s.title}
                        </p>
                        <p className="text-[10px] leading-relaxed pl-5">{s.body}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    I have read and agree to the <span className="font-bold text-foreground">Terms & Conditions</span>, <span className="font-bold text-foreground">Risk Disclosures</span>, and <span className="font-bold text-foreground">Fee Structures</span>
                  </span>
                </label>
              </div>

              {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}

              <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
              <SlideToConfirm onConfirm={handleCreateAutoSave} label={processing ? "Creating…" : "Slide to Start Plan"} disabled={pin.length < 4 || processing || !termsAccepted} pinComplete={pin.length === 4 && termsAccepted} />
            </motion.div>
          )}

          {/* ══════════ GOAL DETAIL VIEW ══════════ */}
          {mainTab === "goals" && step === "goal-detail" && selectedGoal && (
            <motion.div key="goal-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Header Card */}
              {(() => {
                const isWithdrawn = selectedGoal.status === "withdrawn" || selectedGoal.status === "cancelled";
                const savedNum = Number(selectedGoal.saved_amount);
                const targetNum = Number(selectedGoal.target_amount);
                const isCompleted = !isWithdrawn && (selectedGoal.status === "completed" || (targetNum > 0 && savedNum >= targetNum));
                const wAmount = Number((selectedGoal as any).withdrawn_amount ?? 0);
                const wAtRaw = (selectedGoal as any).withdrawn_at ?? (selectedGoal as any).updated_at ?? (selectedGoal as any).created_at;
                const wAt = wAtRaw ? new Date(wAtRaw) : null;
                const pct = targetNum > 0 ? Math.min(100, (savedNum / targetNum) * 100) : 0;
                const locked = !isWithdrawn && isGoalLocked(selectedGoal);
                const daysLeft = locked ? goalLockDaysLeft(selectedGoal) : 0;
                const unlockDate = locked ? goalUnlockDate(selectedGoal) : null;
                return (
                  <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${isWithdrawn ? "bg-muted/40 border-border/60 grayscale opacity-80" : "bg-gradient-to-br from-primary/15 to-primary/5 border-primary/20"}`}>
                        <span className="text-[36px]">{selectedGoal.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[18px] font-black text-foreground">{selectedGoal.name}</p>
                        {isWithdrawn ? (
                          <p className="text-[12px] text-muted-foreground">Goal of ৳{targetNum.toLocaleString()} • Closed</p>
                        ) : (
                          <p className="text-[12px] text-muted-foreground">৳{savedNum.toLocaleString()} / ৳{targetNum.toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    {locked && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-amber-500/10 border border-amber-500/30">
                        <Lock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-amber-700 dark:text-amber-300 leading-tight">
                            Locked for {daysLeft} more day{daysLeft === 1 ? "" : "s"}
                          </p>
                          {unlockDate && (
                            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                              Withdraw available {unlockDate.toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {isWithdrawn ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-[14px] p-3 text-center space-y-0.5">
                        <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                          {selectedGoal.status === "cancelled" ? "↩ Refunded" : "✓ Withdrawn"} ৳{(wAmount || targetNum).toLocaleString()}
                        </p>
                        {wAt && <p className="text-[11px] text-muted-foreground">on {wAt.toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}</p>}
                      </div>
                    ) : isCompleted ? (
                      <div className="space-y-1.5">
                        <div className="h-3 rounded-full bg-muted/80 overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1, ease: "easeOut" }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-bold text-amber-600 dark:text-amber-400">100% complete 🎉</p>
                          <p className="text-[11px] text-muted-foreground font-medium">{locked ? `Withdrawable in ${daysLeft}d` : "Ready to withdraw"}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="h-3 rounded-full bg-muted/80 overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-500 to-emerald-400" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-bold text-primary">{pct.toFixed(0)}% complete</p>
                          <p className="text-[11px] text-muted-foreground font-medium">৳{(targetNum - savedNum).toLocaleString()} remaining</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Timeline */}
              {goalDeposits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Deposit History</p>
                  <div className="relative py-6 px-2">
                    {/* Center trunk line */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/60 via-primary/25 to-transparent rounded-full" />
                    {goalDeposits.map((dep, i) => {
                      const isRight = (i * 7 + 3) % 2 === 1;
                      const nodeColor = dep.source === "auto" ? "border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.35)]"
                        : dep.source === "dps_repay" ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
                        : "border-primary shadow-[0_0_8px_hsl(var(--primary)/0.35)]";
                      const branchColor = dep.source === "auto" ? "bg-blue-500/30" : dep.source === "dps_repay" ? "bg-amber-500/30" : "bg-primary/30";
                      const amountColor = dep.source === "auto" ? "text-blue-600 dark:text-blue-400" : dep.source === "dps_repay" ? "text-amber-600 dark:text-amber-400" : "text-primary";

                      return (
                        <motion.div key={dep.id}
                          initial={{ opacity: 0, x: isRight ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08, type: "spring", stiffness: 350, damping: 28 }}
                          className="relative flex items-center mb-8 last:mb-0 min-h-[36px]"
                        >
                          {/* Left side */}
                          <div className="w-[42%] text-right pr-6">
                            {isRight ? (
                              <p className="text-[11px] font-semibold text-muted-foreground leading-tight">
                                {new Date(dep.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            ) : (
                              <div className="inline-flex flex-col items-end gap-0.5">
                                <p className={`text-[15px] font-black tracking-tight ${amountColor}`}>৳{Number(dep.amount).toLocaleString()}</p>
                                <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                                  {dep.source === "auto" ? "Auto" : dep.source === "dps_repay" ? "Repay" : "Manual"}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Center: node */}
                          <div className="absolute left-1/2 -translate-x-1/2 z-10">
                            <div className={`w-3.5 h-3.5 rounded-full border-[2.5px] bg-card ${nodeColor}`} />
                          </div>

                          {/* Branch line from node to content side */}
                          <div className={`absolute top-1/2 -translate-y-1/2 h-[1.5px] ${branchColor} ${
                            isRight ? "left-[calc(50%+8px)] w-6" : "right-[calc(50%+8px)] w-6"
                          }`} />

                          {/* Right side */}
                          <div className="w-[42%] ml-auto pl-6">
                            {isRight ? (
                              <div className="inline-flex flex-col items-start gap-0.5">
                                <p className={`text-[15px] font-black tracking-tight ${amountColor}`}>৳{Number(dep.amount).toLocaleString()}</p>
                                <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                                  {dep.source === "auto" ? "Auto" : dep.source === "dps_repay" ? "Repay" : "Manual"}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[11px] font-semibold text-muted-foreground leading-tight">
                                {new Date(dep.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {goalDeposits.length === 0 && (
                <div className="text-center py-6 rounded-[18px] border border-dashed border-border/60 bg-muted/20">
                  <p className="text-[13px] font-bold text-muted-foreground">No deposits yet</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Add your first deposit below</p>
                </div>
              )}

              {/* Deposit Section — gated by goal status */}
              {(() => {
                const _saved = Number(selectedGoal.saved_amount);
                const _target = Number(selectedGoal.target_amount);
                const _isWithdrawn = selectedGoal.status === "withdrawn" || selectedGoal.status === "cancelled";
                const _isCompleted = !_isWithdrawn && (selectedGoal.status === "completed" || (_target > 0 && _saved >= _target));
                const _locked = !_isWithdrawn && isGoalLocked(selectedGoal);
                const _unlock = goalUnlockDate(selectedGoal);

                if (_isWithdrawn) {
                  return (
                    <div className="bg-muted/40 border border-border/60 rounded-[20px] p-5 text-center">
                      <CheckCircle2 className="mx-auto text-muted-foreground mb-2" size={28} />
                      <p className="text-[13px] font-bold text-foreground">Goal Closed</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {selectedGoal.status === "cancelled" ? "Funds refunded to your wallet. This goal is archived." : "Funds withdrawn to your wallet. This goal is archived."}
                      </p>
                    </div>
                  );
                }

                if (_isCompleted) {
                  return (
                    <div className="bg-gradient-to-br from-emerald-500/10 to-amber-400/10 border border-emerald-500/30 rounded-[20px] p-5 text-center space-y-3">
                      <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
                      <p className="text-[15px] font-black text-foreground">Goal Completed 🎉</p>
                      <p className="text-[12px] text-muted-foreground">
                        {_locked
                          ? `Your funds are locked until ${_unlock?.toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}. You can withdraw after the 60-day minimum.`
                          : `You've reached your ৳${_target.toLocaleString()} target. Withdraw your savings to your wallet.`}
                      </p>
                      <button
                        onClick={() => handleWithdrawGoal(selectedGoal.id, selectedGoal.name, _saved)}
                        disabled={processing || _locked}
                        className="w-full py-3 rounded-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-[13px] shadow-md disabled:opacity-60 inline-flex items-center justify-center gap-2">
                        {_locked && <Lock size={14} />}
                        {processing ? "Processing…" : _locked ? `Withdrawable ${_unlock?.toLocaleDateString("en-BD", { month: "short", day: "numeric" })}` : `Withdraw ৳${_saved.toLocaleString()} to Wallet`}
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Add Deposit</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">৳</span>
                        <input type="number" inputMode="decimal" placeholder="0.00" value={amount}
                          onChange={e => { setAmount(e.target.value); setError(""); }}
                          className="w-full pl-10 pr-4 py-3 text-[22px] font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40" />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {PRESET_AMOUNTS.map(q => (
                          <button key={q} onClick={() => setAmount(String(q))}
                            className={`flex-1 min-w-[60px] py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${amount === String(q) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                            ৳{q >= 1000 ? `${q / 1000}k` : q}
                          </button>
                        ))}
                      </div>
                      {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
                    </div>

                    <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
                    <SlideToConfirm onConfirm={handleSave} label={processing ? "Processing…" : "Slide to Save"} disabled={pin.length < 4 || processing} pinComplete={pin.length === 4} />
                  </>
                );
              })()}
            </motion.div>
          )}

          {/* ══════════ DPS DETAIL VIEW ══════════ */}
          {mainTab === "savings" && step === "dps-detail" && selectedSchedule && (
            <motion.div key="dps-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Header */}
              {(() => {
                const stratObj = INVESTMENT_STRATEGIES.find(s => s.key === selectedSchedule.strategy);
                const linkedGoal = goals.find(g => g.id === selectedSchedule.goal_id);
                const totalInst = selectedSchedule.total_installments ?? 0;
                const paid = selectedSchedule.total_paid ?? 0;
                const missed = selectedSchedule.missed_count ?? 0;
                const totalDeposited = paid * Number(selectedSchedule.amount);
                const paidPct = totalInst > 0 ? Math.round((paid / totalInst) * 100) : 0;

                return (
                  <>
                    <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                          <CalendarClock size={24} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-black text-foreground">৳{Number(selectedSchedule.amount).toLocaleString()} / {selectedSchedule.frequency}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {stratObj && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">{stratObj.icon} {stratObj.label}</span>}
                            {linkedGoal && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">{linkedGoal.emoji} {linkedGoal.name}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-muted/50 rounded-[14px] p-3 text-center">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Deposited</p>
                          <p className="text-[18px] font-black text-foreground mt-1">৳{totalDeposited.toLocaleString()}</p>
                        </div>
                        <div className="bg-muted/50 rounded-[14px] p-3 text-center">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Next Installment</p>
                          <p className="text-[13px] font-black text-foreground mt-1">
                            {selectedSchedule.is_active && selectedSchedule.next_run_at
                              ? new Date(selectedSchedule.next_run_at).toLocaleDateString("en-BD", { month: "short", day: "numeric" })
                              : "—"}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-[14px] p-3 text-center">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Installments</p>
                          <p className="text-[14px] font-black text-foreground mt-1">{paid}/{totalInst}</p>
                        </div>
                        <div className="bg-muted/50 rounded-[14px] p-3 text-center">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Missed</p>
                          <p className={`text-[14px] font-black mt-1 ${missed > 0 ? "text-destructive" : "text-foreground"}`}>{missed}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {totalInst > 0 && (
                        <div className="space-y-1.5">
                          <div className="h-2.5 rounded-full bg-muted/80 overflow-hidden">
                            <motion.div className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-500 to-emerald-400"
                              initial={{ width: 0 }} animate={{ width: `${paidPct}%` }}
                              transition={{ duration: 1, ease: "easeOut" }} />
                          </div>
                          <p className="text-[10px] font-bold text-primary text-center">{paidPct}% complete</p>
                        </div>
                      )}
                    </div>

                    {/* Repay button if missed */}
                    {missed > 0 && (
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          const scheduleMissed = missedPayments.filter(m => m.schedule_id === selectedSchedule.id);
                          setRepayScheduleId(selectedSchedule.id);
                          setSelectedMissedIds(scheduleMissed.map(m => m.id));
                          setStep("repay-missed"); setError(""); setPin(""); setPinError("");
                        }}
                        className="w-full flex items-center gap-3 p-3.5 rounded-[16px] border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                          <AlertTriangle size={18} className="text-destructive" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-[13px] font-bold text-destructive">{missed} Missed Installment{missed !== 1 ? "s" : ""}</p>
                          <p className="text-[10px] text-muted-foreground">Tap to repay overdue payments</p>
                        </div>
                        <ChevronRight size={16} className="text-destructive/50" />
                      </motion.button>
                    )}

                    {/* Collect Now (manual trigger) */}
                    {selectedSchedule.is_active && !selectedSchedule.settled && (
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={async () => {
                          try {
                            toast.loading("Processing installment…", { id: "collect-now" });
                            const { data, error } = await supabase.functions.invoke("process-auto-save", {
                              body: { schedule_id: selectedSchedule.id },
                            });
                            if (error) throw error;
                            const r = (data ?? {}) as any;
                            const out = r.perSchedule?.[0]?.outcome as string | undefined;
                            if (out === "collected") toast.success("Installment collected", { id: "collect-now" });
                            else if (out === "missed") toast.error("Insufficient balance — marked missed", { id: "collect-now" });
                            else if (out === "dedup_skipped") toast("Already collected for this cycle", { id: "collect-now" });
                            else if (out === "settled") toast.success("Plan completed", { id: "collect-now" });
                            else if (out === "no_goal") toast.error("No active linked goal", { id: "collect-now" });
                            else toast.success("Done", { id: "collect-now" });
                            loadAutoSaves(); loadMissedPayments(); loadGoals();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Failed to collect", { id: "collect-now" });
                          }
                        }}
                        className="w-full flex items-center gap-3 p-3.5 rounded-[16px] border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Zap size={18} className="text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-[13px] font-bold text-primary">Collect Now</p>
                          <p className="text-[10px] text-muted-foreground">Run this installment immediately</p>
                        </div>
                        <ChevronRight size={16} className="text-primary/50" />
                      </motion.button>
                    )}
                  </>
                );
              })()}

              {/* Timeline */}
              {dpsTimeline.length > 0 && (() => {
                // ─── Bucket the timeline once (single source of truth) ─────────
                const amount = Number(selectedSchedule?.amount ?? 0);
                const processedItems = dpsTimeline.filter(i => i.status === "processed");
                const repaidItems    = dpsTimeline.filter(i => i.status === "repaid");
                const refundedItems  = dpsTimeline.filter(i => i.status === "refunded");
                const missedItems    = dpsTimeline.filter(i => i.status === "missed");
                const pendingItems   = dpsTimeline.filter(i => i.status === "pending");
                const openingItems   = dpsTimeline.filter(i => i.outcome === "opening_deposit" && i.status === "processed");

                const sum = (arr: typeof dpsTimeline) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);
                const processedSum = sum(processedItems);
                const repaidSum    = sum(repaidItems);
                const refundedSum  = sum(refundedItems);
                const missedSum    = sum(missedItems);
                const pendingSum   = sum(pendingItems);

                // Net = money that currently sits in the goal (debited & not refunded)
                const totalCollected = processedSum + repaidSum;
                const totalRefunded  = refundedSum;
                const totalPending   = pendingSum;
                const totalMissed    = missedSum;

                // ─── Reconciliation ─────────
                // Use max of declared installments vs observed events so open-ended
                // plans (total_installments = 0) still reconcile sensibly.
                const declaredInst = selectedSchedule?.total_installments ?? 0;
                const observedInst =
                  processedItems.length + refundedItems.length + missedItems.length + pendingItems.length;
                const scheduledCount = Math.max(declaredInst, observedInst);
                const expectedAmount = scheduledCount * amount;
                // Planned total shown in summary should equal expected when known,
                // otherwise fall back to sum of observed buckets.
                const totalPlanned = expectedAmount > 0
                  ? expectedAmount
                  : totalCollected + totalRefunded + totalPending + totalMissed;

                // Tx-ledger reconciliation: only debit-bearing rows should have a txId.
                const debitableItems = [...processedItems, ...repaidItems, ...refundedItems];
                const linkedTxCount  = debitableItems.filter(i => !!i.txId).length;
                const expectedTxCount = debitableItems.length;
                const unlinkedRuns = debitableItems.filter(i => !i.txId);

                // Schedule counter mismatch: the schedule's `total_paid` counts cron
                // collections only — it does NOT include the opening deposit (debited
                // at plan creation) nor any later refunds. Compare gross debits
                // against `total_paid`, allowing for the opening deposit if present.
                const totalPaid = selectedSchedule?.total_paid ?? 0;
                const grossDebited = processedSum + repaidSum + refundedSum;
                const expectedFromSchedule = totalPaid * amount;
                const grossVariance = grossDebited - expectedFromSchedule;
                const openingOffset = openingItems.length * amount; // 0 or amount
                const counterReconciled =
                  Math.abs(grossVariance) < 0.5 ||
                  Math.abs(grossVariance - openingOffset) < 0.5;
                // Variance shown to user excludes the legitimate opening-deposit gap.
                const variance = counterReconciled
                  ? 0
                  : grossVariance - (Math.abs(grossVariance - openingOffset) < Math.abs(grossVariance) ? openingOffset : 0);

                // `netCollectedAmt` retained for the summary card; equals net in goal.
                const netCollectedAmt = totalCollected;

                const recIssues =
                  refundedItems.length +
                  missedItems.length +
                  unlinkedRuns.length +
                  (counterReconciled ? 0 : 1);

                return (
                <div className="space-y-2">
                  {/* Summary above timeline */}
                  <div className="rounded-[18px] border border-border/60 bg-card p-3.5 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">DPS Summary</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[12px] bg-muted/40 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Planned</p>
                        <p className="text-[15px] font-black text-foreground mt-0.5">৳{totalPlanned.toLocaleString()}</p>
                      </div>
                      <div className="rounded-[12px] bg-emerald-500/10 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Collected</p>
                        <p className="text-[15px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">৳{totalCollected.toLocaleString()}</p>
                      </div>
                      <div className="rounded-[12px] bg-sky-500/10 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">Refunded</p>
                        <p className="text-[15px] font-black text-sky-600 dark:text-sky-400 mt-0.5">৳{totalRefunded.toLocaleString()}</p>
                      </div>
                      <div className="rounded-[12px] bg-muted/40 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Pending</p>
                        <p className="text-[15px] font-black text-foreground mt-0.5">৳{totalPending.toLocaleString()}</p>
                      </div>
                    </div>
                    {totalPlanned > 0 && (
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-muted/60 overflow-hidden flex">
                          <div className="h-full bg-emerald-500" style={{ width: `${(totalCollected / totalPlanned) * 100}%` }} />
                          <div className="h-full bg-sky-500" style={{ width: `${(totalRefunded / totalPlanned) * 100}%` }} />
                          <div className="h-full bg-destructive/70" style={{ width: `${(totalMissed / totalPlanned) * 100}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground text-center">
                          {Math.round((totalCollected / totalPlanned) * 100)}% collected • {Math.round((totalPending / totalPlanned) * 100)}% remaining
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Deposit Reconciliation */}
                  <div className={`rounded-[18px] border p-3.5 space-y-2.5 ${recIssues > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                        {recIssues > 0 ? <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" /> : <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />}
                        Deposit Reconciliation
                      </p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${recIssues > 0 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>
                        {recIssues > 0 ? `${recIssues} issue${recIssues !== 1 ? "s" : ""}` : "All clear"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Scheduled</span>
                        <span className="font-bold text-foreground">{scheduledCount}× ৳{Number(selectedSchedule?.amount ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Expected total</span>
                        <span className="font-bold text-foreground">৳{expectedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Collected (net)</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">৳{netCollectedAmt.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Linked txns</span>
                        <span className="font-bold text-foreground">{linkedTxCount} / {dpsTimeline.filter(i => i.status !== "pending").length}</span>
                      </div>
                    </div>

                    {(refundedItems.length > 0 || missedItems.length > 0 || unlinkedRuns.length > 0 || variance !== 0) && (
                      <div className="space-y-1.5 pt-1 border-t border-border/40">
                        {variance !== 0 && (
                          <div className="flex items-start gap-2 text-[11px]">
                            <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-foreground">
                              <span className="font-bold">Counter mismatch:</span> schedule says {selectedSchedule?.total_paid ?? 0} paid (৳{((selectedSchedule?.total_paid ?? 0) * Number(selectedSchedule?.amount ?? 0)).toLocaleString()}), transactions show ৳{netCollectedAmt.toLocaleString()} ({variance > 0 ? "+" : ""}৳{variance.toLocaleString()}).
                            </p>
                          </div>
                        )}
                        {refundedItems.length > 0 && (
                          <div className="flex items-start gap-2 text-[11px]">
                            <RefreshCw size={12} className="text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                            <p className="text-foreground">
                              <span className="font-bold">{refundedItems.length} refunded deposit{refundedItems.length !== 1 ? "s" : ""}</span> (৳{refundedItems.reduce((s, i) => s + i.amount, 0).toLocaleString()}) — money was returned to wallet, goal not credited.
                            </p>
                          </div>
                        )}
                        {missedItems.length > 0 && (
                          <div className="flex items-start gap-2 text-[11px]">
                            <AlertTriangle size={12} className="text-destructive mt-0.5 shrink-0" />
                            <p className="text-foreground">
                              <span className="font-bold">{missedItems.length} missed installment{missedItems.length !== 1 ? "s" : ""}</span> (৳{missedItems.reduce((s, i) => s + i.amount, 0).toLocaleString()}) — no transaction recorded, balance was insufficient.
                            </p>
                          </div>
                        )}
                        {unlinkedRuns.length > 0 && (
                          <div className="flex items-start gap-2 text-[11px]">
                            <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-foreground">
                              <span className="font-bold">{unlinkedRuns.length} uncredited run{unlinkedRuns.length !== 1 ? "s" : ""}</span> — run logged but no matching wallet transaction found.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1 pt-1">Installment History</p>
                  <p className="text-[10px] text-muted-foreground/70 px-1">Tap any installment for full details</p>
                  <div className="relative py-6 px-2">
                    {/* Center trunk line */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/60 via-primary/25 to-transparent rounded-full" />
                    {dpsTimeline.map((item, i) => {
                      const isRight = (i * 7 + 3) % 2 === 1;
                      const palette = (() => {
                        switch (item.status) {
                          case "processed":
                            return { node: "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]", branch: "bg-emerald-500/30", amount: "text-emerald-600 dark:text-emerald-400", label: "Processed", icon: <CheckCircle2 size={8} /> };
                          case "repaid":
                            return { node: "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]", branch: "bg-amber-500/30", amount: "text-amber-600 dark:text-amber-400", label: "Repaid", icon: <RefreshCw size={8} /> };
                          case "refunded":
                            return { node: "border-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.35)]", branch: "bg-sky-500/30", amount: "text-sky-600 dark:text-sky-400", label: "Refunded", icon: <RefreshCw size={8} /> };
                          case "missed":
                            return { node: "border-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.35)]", branch: "bg-destructive/30", amount: "text-destructive", label: "Missed", icon: <AlertTriangle size={8} /> };
                          case "skipped":
                            return { node: "border-muted-foreground/60", branch: "bg-muted-foreground/20", amount: "text-muted-foreground", label: "Skipped", icon: <AlertTriangle size={8} /> };
                          case "pending":
                          default:
                            return { node: "border-muted-foreground/40 border-dashed", branch: "bg-muted-foreground/20", amount: "text-muted-foreground", label: "Pending", icon: <CalendarClock size={8} /> };
                        }
                      })();
                      const dateStr = `${formatInstallmentDate(item.date)}${USER_TZ_ABBR ? ` ${USER_TZ_ABBR}` : ""}`;
                      const detailBlock = (
                        <div className={`inline-flex flex-col gap-0.5 ${isRight ? "items-start" : "items-end"}`}>
                          <p className={`text-[15px] font-black tracking-tight ${palette.amount}`}>৳{item.amount.toLocaleString()}</p>
                          <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider inline-flex items-center gap-0.5">
                            {palette.icon} {palette.label}
                          </p>
                          {item.goalName && (
                            <p className="text-[9px] font-semibold text-primary/80 truncate max-w-[120px]" title={item.goalName}>
                              → {item.goalName}
                            </p>
                          )}
                          {item.note && (
                            <p className="text-[9px] text-muted-foreground/80 truncate max-w-[140px]" title={item.note}>
                              {item.note}
                            </p>
                          )}
                          {item.txReference && (
                            <p className="text-[8px] font-mono text-muted-foreground/60 truncate max-w-[140px]" title={item.txReference}>
                              {item.txReference}
                            </p>
                          )}
                        </div>
                      );

                      return (
                        <motion.button key={item.id} type="button"
                          onClick={() => setSelectedInstallment(item)}
                          initial={{ opacity: 0, x: isRight ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ delay: Math.min(i * 0.06, 0.6), type: "spring", stiffness: 350, damping: 28 }}
                          className={`relative flex items-center mb-8 last:mb-0 min-h-[36px] w-full text-left rounded-lg hover:bg-muted/30 transition-colors ${item.status === "pending" ? "opacity-70" : ""}`}
                        >
                          <div className="w-[42%] text-right pr-6">
                            {isRight ? (
                              <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{dateStr}</p>
                            ) : detailBlock}
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 z-10">
                            <div className={`w-3.5 h-3.5 rounded-full border-[2.5px] bg-card ${palette.node}`} />
                          </div>
                          <div className={`absolute top-1/2 -translate-y-1/2 h-[1.5px] ${palette.branch} ${
                            isRight ? "left-[calc(50%+8px)] w-6" : "right-[calc(50%+8px)] w-6"
                          }`} />
                          <div className="w-[42%] ml-auto pl-6">
                            {isRight ? detailBlock : (
                              <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{dateStr}</p>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {dpsTimeline.length === 0 && (
                <div className="text-center py-6 rounded-[18px] border border-dashed border-border/60 bg-muted/20">
                  <CalendarClock size={28} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-[13px] font-bold text-muted-foreground">No installments yet</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Auto-collection will start on the next cycle date</p>
                </div>
              )}
            </motion.div>
          )}


          {mainTab === "gold" && goldStep === "portfolio" && (
            <motion.div key="g-port" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <ShieldCheck size={14} className="text-amber-600 dark:text-amber-400" />
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Sharia Compliant • BAJUS Certified Rate</p>
              </div>
              <div className="rounded-[20px] p-5 border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg"><Coins size={22} className="text-white" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Gold</p>
                    <p className="text-[28px] font-black text-foreground leading-tight">{totalGoldGrams > 0 ? `${totalGoldGrams}g` : "0g"}</p>
                    {goldHoldings22k.grams > 0 || goldHoldings24k.grams > 0 ? (
                      <p className="text-[11px] text-muted-foreground">22K: {goldHoldings22k.grams}g • 24K: {goldHoldings24k.grams}g</p>
                    ) : null}
                  </div>
                </div>
                {totalGoldGrams > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground font-semibold">Current Value</p>
                      <p className="text-[16px] font-black text-foreground">৳{totalGoldValue.toLocaleString()}</p>
                    </div>
                    <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground font-semibold">Profit/Loss</p>
                      <p className={`text-[16px] font-black flex items-center gap-0.5 ${totalGoldValue - totalGoldCost >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {totalGoldValue - totalGoldCost >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}৳{Math.abs(totalGoldValue - totalGoldCost).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-card rounded-[18px] border border-border/60 shadow-[var(--shadow-card)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-bold text-foreground">Live Gold Price</p>
                  <div className="flex items-center gap-2">
                    <button onClick={refreshGoldPrice} className="p-1 rounded-lg hover:bg-muted transition-colors" disabled={goldPriceLoading}>
                      <RefreshCw size={12} className={`text-muted-foreground ${goldPriceLoading ? "animate-spin" : ""}`} />
                    </button>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live</div>
                  </div>
                </div>
                {goldUpdatedAt && (
                  <p className="text-[9px] text-muted-foreground mb-2">Updated: {new Date(goldUpdatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-semibold">22K Gold</p>
                    <p className="text-[18px] font-black text-amber-600 dark:text-amber-400">৳{LIVE_GOLD_PRICE.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">per gram</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-semibold">24K Gold</p>
                    <p className="text-[18px] font-black text-amber-600 dark:text-amber-400">৳{LIVE_GOLD_24K_PRICE.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">per gram</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setGoldStep("buy"); setGoldGrams(""); setError(""); }}
                  className="h-14 rounded-2xl text-white font-bold text-[14px] shadow-lg bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center gap-2">
                  <ArrowDownRight size={16} /> Buy Gold
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setGoldStep("sell"); setGoldGrams(""); setError(""); }}
                  className="h-14 rounded-2xl font-bold text-[14px] border-2 border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2"
                  style={{ background: "transparent" }}>
                  <ArrowUpRight size={16} /> Sell Gold
                </motion.button>
              </div>
              {totalGoldGrams > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => { const has24k = goldHoldings24k.grams > 0; setGoldKarat(has24k ? "24k" : "22k"); setGoldGrams(String(has24k ? goldHoldings24k.grams : goldHoldings22k.grams)); setGoldStep("sell"); setError(""); }}
                    className="h-12 rounded-2xl font-bold text-[13px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center gap-2">
                    <Wallet size={14} /> Sell All
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => { const has24k = goldHoldings24k.grams > 0; const availableGrams = has24k ? goldHoldings24k.grams : goldHoldings22k.grams; setGoldKarat(has24k ? "24k" : "22k"); setGoldGrams(String(Math.round(availableGrams * 50) / 100)); setGoldStep("sell"); setError(""); }}
                    className="h-12 rounded-2xl font-bold text-[13px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center justify-center gap-2">
                    <CircleDollarSign size={14} /> Sell Half
                  </motion.button>
                </div>
              )}
              <div className="bg-card rounded-[18px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-3">
                <p className="text-[12px] font-bold text-foreground flex items-center gap-1.5"><Sparkles size={14} className="text-amber-500" /> Why Invest in Gold?</p>
                {[
                  { icon: "🛡️", text: "Hedge against inflation & currency devaluation" },
                  { icon: "📈", text: "Historical average return of 8-12% annually" },
                  { icon: "🕌", text: "Sharia-compliant, no interest involved" },
                  { icon: "💧", text: "High liquidity — sell anytime instantly" },
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-lg">{b.icon}</span>
                    <p className="text-[12px] text-muted-foreground">{b.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* GOLD: BUY/SELL */}
          {mainTab === "gold" && (goldStep === "buy" || goldStep === "sell") && (
            <motion.div key={`g-${goldStep}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${goldStep === "buy" ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                    {goldStep === "buy" ? <ArrowDownRight size={18} className="text-emerald-600" /> : <ArrowUpRight size={18} className="text-amber-600" />}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-foreground">{goldStep === "buy" ? "Buy Gold" : "Sell Gold"}</p>
                    <p className="text-[11px] text-muted-foreground">{goldStep === "sell" ? `Available: ${goldHolding.grams}g` : `Wallet: ৳${balance.toLocaleString()}`}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Purity</p>
                  <div className="flex gap-2">
                    {(["22k", "24k"] as const).map(k => (
                      <button key={k} onClick={() => setGoldKarat(k)}
                        className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${goldKarat === k ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30" : "bg-muted text-muted-foreground"}`}>
                        {k.toUpperCase()} — ৳{(k === "22k" ? LIVE_GOLD_PRICE : LIVE_GOLD_24K_PRICE).toLocaleString()}/g
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Grams</p>
                  <input type="number" inputMode="decimal" placeholder="0.00" value={goldGrams}
                    onChange={e => { setGoldGrams(e.target.value); setError(""); }}
                    className="w-full px-4 py-3 text-[22px] font-bold bg-muted rounded-xl outline-none text-foreground placeholder:text-muted-foreground/40" />
                  <div className="flex gap-2 flex-wrap">
                    {GOLD_PRESETS.map(g => (
                      <button key={g} onClick={() => setGoldGrams(String(g))}
                        className={`flex-1 min-w-[50px] py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${goldGrams === String(g) ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                        {g}g
                      </button>
                    ))}
                  </div>
                </div>
                {parseFloat(goldGrams) > 0 && (() => {
                  const g = parseFloat(goldGrams);
                  const subtotal = Math.round(g * currentGoldPrice);
                  const fee = Math.round(subtotal * 0.015);
                  const total = goldStep === "buy" ? subtotal + fee : subtotal - fee;
                  return (
                    <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Rate</span>
                        <span className="text-muted-foreground">৳{currentGoldPrice.toLocaleString()} × {goldGrams}g</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-muted-foreground">৳{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-amber-600 dark:text-amber-400">Platform fee (1.5%)</span>
                        <span className="text-amber-600 dark:text-amber-400">{goldStep === "buy" ? "+" : "−"}৳{fee.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-border/30 pt-1 flex justify-between text-[12px]">
                        <span className="text-muted-foreground font-semibold">{goldStep === "buy" ? "You Pay" : "You Receive"}</span>
                        <span className="font-black text-foreground">৳{total.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
               </div>
               <div className="space-y-2">
                 <button onClick={() => setShowTermsSheet(true)} className="flex items-center gap-2 text-[11px] font-medium text-primary">
                   <FileText size={13} /> Read Terms & Conditions
                 </button>
                 <button onClick={() => setTradeTermsAccepted(!tradeTermsAccepted)}
                   className="flex items-center gap-2.5 w-full text-left">
                   <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${tradeTermsAccepted ? "bg-primary border-primary" : "border-border"}`}>
                     {tradeTermsAccepted && <CheckCircle2 size={12} className="text-white" />}
                   </div>
                   <p className="text-[11px] text-muted-foreground">
                     I agree to the <span className="text-foreground font-semibold">Terms & Conditions</span>, risk disclosures, and fee structures
                   </p>
                 </button>
               </div>
               <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
               <SlideToConfirm onConfirm={goldStep === "buy" ? handleBuyGold : handleSellGold} label={processing ? "Processing…" : goldStep === "buy" ? "Slide to Buy Gold" : "Slide to Sell Gold"} disabled={pin.length < 4 || processing || !tradeTermsAccepted} pinComplete={pin.length === 4 && tradeTermsAccepted} />
            </motion.div>
          )}

          {/* ══════════ STOCKS: MARKET ══════════ */}
          {mainTab === "stocks" && stockStep === "market" && (
            <motion.div key="st-market" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">Sharia Screened Stocks • Halal Trading</p>
              </div>
              {stockHoldings.length > 0 && (
                <button onClick={() => setStockStep("portfolio")}
                  className="w-full rounded-[20px] p-4 border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Portfolio</p>
                      <p className="text-[22px] font-black text-foreground">৳{Math.round(totalStockValue).toLocaleString()}</p>
                      <p className={`text-[11px] font-bold flex items-center gap-0.5 ${totalStockProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {totalStockProfit >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {totalStockProfit >= 0 ? "+" : ""}৳{Math.round(Math.abs(totalStockProfit)).toLocaleString()} total P/L
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground/40" />
                  </div>
                </button>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DSE Market — Top Halal Stocks</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={refreshStockPrices} className="p-1 rounded-lg hover:bg-muted transition-colors" disabled={stockPriceLoading} aria-label="Refresh prices">
                      <RefreshCw size={11} className={`text-muted-foreground ${stockPriceLoading ? "animate-spin" : ""}`} />
                    </button>
                    <div className="flex items-center gap-1 text-[9px] font-bold">
                      <div className={`w-1.5 h-1.5 rounded-full ${stockSource === "dse_live" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                      <span className={stockSource === "dse_live" ? "text-emerald-600" : "text-amber-600"}>
                        {stockSource === "dse_live" ? "Live" : "Indicative"}
                      </span>
                    </div>
                  </div>
                </div>
                {stockUpdatedAt && (
                  <p className="text-[9px] text-muted-foreground px-1">Updated: {new Date(stockUpdatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                )}
                {liveStocks.map((stock, i) => {
                  const holding = stockHoldings.find(h => h.symbol === stock.symbol);
                  return (
                    <motion.button key={stock.symbol} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => { setSelectedStock(stock); setStockAction("buy"); setStockQty(""); setStockStep("trade"); setError(""); }}
                      className="w-full bg-card rounded-[16px] border border-border/60 shadow-[var(--shadow-xs)] p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[12px] font-black text-blue-600 dark:text-blue-400">{stock.symbol.slice(0, 2)}</div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[13px] font-bold text-foreground truncate">{stock.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{stock.sector}</span>
                          {holding && <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[9px] font-bold">{holding.qty} held</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-black text-foreground">৳{stock.price.toLocaleString()}</p>
                        <p className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${stock.change >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {stock.change >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {stock.change >= 0 ? "+" : ""}{stock.change}%
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STOCKS: PORTFOLIO */}
          {mainTab === "stocks" && stockStep === "portfolio" && (
            <motion.div key="st-port" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="rounded-[20px] p-5 border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Portfolio Value</p>
                <p className="text-[28px] font-black text-foreground leading-tight">৳{Math.round(totalStockValue).toLocaleString()}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="bg-card/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Invested</p>
                    <p className="text-[13px] font-bold text-foreground">৳{Math.round(totalStockCost).toLocaleString()}</p>
                  </div>
                  <div className="bg-card/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-muted-foreground">P/L</p>
                    <p className={`text-[13px] font-bold ${totalStockProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {totalStockProfit >= 0 ? "+" : ""}৳{Math.round(totalStockProfit).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              {stockHoldings.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-4xl">📊</p>
                  <p className="text-sm text-muted-foreground">No stocks in portfolio</p>
                  <button onClick={() => setStockStep("market")} className="text-sm font-semibold text-blue-600 dark:text-blue-400">Browse market →</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Holdings</p>
                  {stockHoldings.map(h => {
                    const pl = (h.currentPrice - h.avgPrice) * h.qty;
                    const plPct = ((h.currentPrice - h.avgPrice) / h.avgPrice * 100);
                    const stock = liveStocks.find(s => s.symbol === h.symbol);
                    return (
                      <div key={h.symbol} className="w-full bg-card rounded-[16px] border border-border/60 shadow-[var(--shadow-xs)] p-3.5 space-y-2">
                        <button onClick={() => {
                          if (stock) { setSelectedStock(stock); setStockAction("sell"); setStockQty(""); setStockStep("trade"); setError(""); }
                        }} className="w-full flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[12px] font-black text-blue-600 dark:text-blue-400">{h.symbol.slice(0, 2)}</div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-[13px] font-bold text-foreground truncate">{h.name}</p>
                            <p className="text-[11px] text-muted-foreground">{h.qty} shares @ ৳{h.avgPrice.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-black text-foreground">৳{Math.round(h.qty * h.currentPrice).toLocaleString()}</p>
                            <p className={`text-[10px] font-bold ${pl >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {pl >= 0 ? "+" : ""}৳{Math.round(Math.abs(pl)).toLocaleString()} ({plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
                            </p>
                          </div>
                        </button>
                        <div className="flex gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); if (stock) { setSelectedStock(stock); setStockAction("sell"); setStockQty(String(h.qty)); setStockStep("trade"); setError(""); } }}
                            className="flex-1 py-2 rounded-xl bg-destructive/10 text-destructive text-[11px] font-bold hover:bg-destructive/20 transition-colors">
                            Sell All ({h.qty})
                          </button>
                          {h.qty > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); if (stock) { setSelectedStock(stock); setStockAction("sell"); setStockQty(String(Math.ceil(h.qty / 2))); setStockStep("trade"); setError(""); } }}
                              className="flex-1 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold hover:bg-amber-500/20 transition-colors">
                              Sell Half ({Math.ceil(h.qty / 2)})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* STOCKS: TRADE */}
          {mainTab === "stocks" && stockStep === "trade" && selectedStock && (
            <motion.div key="st-trade" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-[14px] font-black text-blue-600 dark:text-blue-400">{selectedStock.symbol.slice(0, 2)}</div>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-foreground">{selectedStock.name}</p>
                    <p className="text-[11px] text-muted-foreground">{selectedStock.symbol} • {selectedStock.sector}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-foreground">৳{selectedStock.price.toLocaleString()}</p>
                    <p className={`text-[11px] font-bold ${selectedStock.change >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {selectedStock.change >= 0 ? "+" : ""}{selectedStock.change}%
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 bg-muted rounded-xl p-1">
                  <button onClick={() => setStockAction("buy")}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${stockAction === "buy" ? "bg-emerald-500 text-white shadow-md" : "text-muted-foreground"}`}>Buy</button>
                  <button onClick={() => setStockAction("sell")}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${stockAction === "sell" ? "bg-destructive text-white shadow-md" : "text-muted-foreground"}`}>Sell</button>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Quantity {stockAction === "sell" && (() => {
                      const h = stockHoldings.find(x => x.symbol === selectedStock.symbol);
                      return h ? `(Available: ${h.qty})` : "(0 held)";
                    })()}
                  </p>
                  <input type="number" inputMode="numeric" placeholder="0" value={stockQty}
                    onChange={e => { setStockQty(e.target.value); setError(""); }}
                    className="w-full px-4 py-3 text-[22px] font-bold bg-muted rounded-xl outline-none text-foreground placeholder:text-muted-foreground/40" />
                  <div className="flex gap-2">
                    {stockAction === "sell" ? (() => {
                      const h = stockHoldings.find(x => x.symbol === selectedStock.symbol);
                      const max = h?.qty || 0;
                      return [max, Math.ceil(max / 2), Math.ceil(max / 4), 1].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 5).map(q => (
                        <button key={q} onClick={() => setStockQty(String(q))}
                          className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${stockQty === String(q) ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
                          {q === max ? "All" : q}
                        </button>
                      ));
                    })() : [1, 5, 10, 25, 50].map(q => (
                      <button key={q} onClick={() => setStockQty(String(q))}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${stockQty === String(q) ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                {parseInt(stockQty) > 0 && (() => {
                  const qty = parseInt(stockQty);
                  const subtotal = Math.round(qty * selectedStock.price);
                  const brokerage = 15;
                  const total = stockAction === "buy" ? subtotal + brokerage : subtotal - brokerage;
                  return (
                    <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Price per share</span>
                        <span className="text-muted-foreground">৳{selectedStock.price.toLocaleString()} × {stockQty}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-muted-foreground">৳{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-blue-600 dark:text-blue-400">Brokerage fee</span>
                        <span className="text-blue-600 dark:text-blue-400">{stockAction === "buy" ? "+" : "−"}৳{brokerage}</span>
                      </div>
                      <div className="border-t border-border/30 pt-1 flex justify-between text-[12px]">
                        <span className="text-muted-foreground font-semibold">{stockAction === "buy" ? "You Pay" : "You Receive"}</span>
                        <span className="font-black text-foreground">৳{total.toLocaleString()}</span>
                      </div>
                      {stockAction === "sell" && (() => {
                        const h = stockHoldings.find(x => x.symbol === selectedStock.symbol);
                        if (!h) return null;
                        const profit = (selectedStock.price - h.avgPrice) * qty;
                        return (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Estimated P/L</span>
                            <span className={`font-bold ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {profit >= 0 ? "+" : ""}৳{Math.round(Math.abs(profit)).toLocaleString()}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
               </div>
               <div className="space-y-2">
                 <button onClick={() => setShowTermsSheet(true)} className="flex items-center gap-2 text-[11px] font-medium text-primary">
                   <FileText size={13} /> Read Terms & Conditions
                 </button>
                 <button onClick={() => setTradeTermsAccepted(!tradeTermsAccepted)}
                   className="flex items-center gap-2.5 w-full text-left">
                   <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${tradeTermsAccepted ? "bg-primary border-primary" : "border-border"}`}>
                     {tradeTermsAccepted && <CheckCircle2 size={12} className="text-white" />}
                   </div>
                   <p className="text-[11px] text-muted-foreground">
                     I agree to the <span className="text-foreground font-semibold">Terms & Conditions</span>, risk disclosures, and fee structures
                   </p>
                 </button>
               </div>
               <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
               <SlideToConfirm onConfirm={stockAction === "buy" ? handleBuyStock : handleSellStock} label={processing ? "Processing…" : stockAction === "buy" ? "Slide to Buy" : "Slide to Sell"} disabled={pin.length < 4 || processing || !tradeTermsAccepted} pinComplete={pin.length === 4 && tradeTermsAccepted} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ TERMS & CONDITIONS SHEET ═══════ */}
      <AnimatePresence>
        {showTermsSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end">
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-h-[85vh] bg-card rounded-t-[24px] shadow-[var(--shadow-float)] overflow-hidden flex flex-col"
            >
              <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-primary" />
                  <p className="text-[15px] font-bold text-foreground">Terms & Conditions</p>
                </div>
                <button onClick={() => setShowTermsSheet(false)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-[12px] text-muted-foreground leading-relaxed">
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-foreground">1. Savings Plan Overview</p>
                  <p>Your savings are automatically invested in Sharia-compliant assets (Gold, Halal Stocks, or a mix) based on your selected investment strategy. All investments follow Islamic finance principles — <strong>no riba (interest)</strong> is involved.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-foreground">2. Profit Structure</p>
                  <p>Profits are generated through <strong>trade-based returns</strong> — gold price appreciation, stock capital gains, and halal dividend income. Estimated returns are indicative and based on historical performance. <strong>Actual returns may vary</strong> and are not guaranteed.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-foreground">3. Minimum Lock-in Period</p>
                  <p>Each savings plan has a <strong>minimum lock-in period</strong> based on the chosen duration:</p>
                  <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                    {DURATION_OPTIONS.map(d => (
                      <div key={d.value} className="flex justify-between text-[11px]">
                        <span>{d.label} plan</span>
                        <span className="font-semibold text-foreground">{d.minLock} months lock-in</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-foreground">4. Early Cancellation</p>
                  <p>All plans have a <strong>mandatory 3-month lock-in period</strong>. You <strong>cannot cancel</strong> within the first 3 months under any circumstances.</p>
                  <p>If you cancel your plan <strong>after the 3-month lock-in but before the selected duration ends</strong>, a penalty fee (1–2%) will be deducted from your total saved amount:</p>
                  <div className="bg-destructive/8 rounded-xl p-3 space-y-1">
                    {DURATION_OPTIONS.map(d => (
                      <div key={d.value} className="flex justify-between text-[11px]">
                        <span>{d.label} plan</span>
                        <span className="font-semibold text-destructive">{d.penaltyPct}% penalty</span>
                      </div>
                    ))}
                  </div>
                  <p>After the full plan duration, you may withdraw at any time with <strong>no penalty</strong>. You will receive your full savings plus any accrued profits. 💰</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-foreground">5. Profit Distribution</p>
                  <p>Upon plan completion, profits are calculated based on actual market performance of the invested assets and credited to your wallet within <strong>3 business days</strong>.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-foreground">6. Sharia Compliance</p>
                  <p>All investment activities are overseen by our Sharia Advisory Board. Only assets that pass Islamic screening criteria are eligible for investment. The platform does not engage in any form of interest-bearing transactions.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-bold text-foreground">7. Risk Disclosure</p>
                  <p>All investments carry risk. Gold prices and stock values can <strong>decrease as well as increase</strong>. Past performance is not indicative of future results. You may receive less than you invested.</p>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-border/40 shrink-0">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setTermsAccepted(true); setShowTermsSheet(false); }}
                  className="w-full h-12 rounded-2xl text-white font-bold text-[14px] shadow-lg"
                  style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                  I Accept Terms & Conditions
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Delete confirmation overlay ─── */}
      <AnimatePresence>
        {deleteTarget && (() => {
          // Calculate lock-in and penalty info for the delete sheet (60-day lock for goals)
          const isGoal = deleteTarget.type === "goal";
          const goalForDelete = isGoal ? goals.find(g => g.id === deleteTarget.id) : null;
          const autoForDelete = !isGoal ? autoSaves.find(a => a.id === deleteTarget.id) : null;
          const isArchivedGoal = isGoal && goalForDelete && goalForDelete.status !== "active";
          const isWithinLockIn = isGoal
            ? (goalForDelete && goalForDelete.status === "active" ? isGoalLocked(goalForDelete) : false)
            : (() => {
                const createdAt = new Date((autoForDelete as any)?.created_at || Date.now());
                const threeMonthsLater = new Date(createdAt);
                threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
                return Date.now() < threeMonthsLater.getTime();
              })();
          const lockInDaysLeft = !isWithinLockIn ? 0 : isGoal
            ? goalLockDaysLeft(goalForDelete)
            : (() => {
                const createdAt = new Date((autoForDelete as any)?.created_at || Date.now());
                const threeMonthsLater = new Date(createdAt);
                threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
                return Math.ceil((threeMonthsLater.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              })();
          const lockLabel = isGoal ? "60-day lock-in period" : "3-month lock-in period";

          // Calculate penalty
          const savedAmt = goalForDelete ? Number(goalForDelete.saved_amount) : 0;
          const durOpt = autoForDelete ? DURATION_OPTIONS.find(d => d.value === autoForDelete.duration) : DURATION_OPTIONS[0];
          const penaltyPct = durOpt?.penaltyPct ?? 2;
          const penaltyAmt = Math.round(savedAmt * penaltyPct / 100);
          const goalPct = goalForDelete && goalForDelete.target_amount > 0 ? Math.min(100, (savedAmt / Number(goalForDelete.target_amount)) * 100) : 0;

          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center" onClick={() => setDeleteTarget(null)}>
              <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="w-full max-w-md bg-card rounded-t-3xl p-5 space-y-4 pb-8" onClick={(e) => e.stopPropagation()}>
                <div className="w-10 h-1 rounded-full bg-muted mx-auto" />
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
                    {isWithinLockIn ? <Lock className="w-6 h-6 text-destructive" /> : <Trash2 className="w-6 h-6 text-destructive" />}
                  </div>
                  {isWithinLockIn ? (
                    <>
                      <h3 className="text-lg font-bold text-foreground">Cannot Cancel Yet</h3>
                      <p className="text-sm text-muted-foreground">
                        🔒 Your plan has a <strong>{lockLabel}</strong>. You have <strong>{lockInDaysLeft} day{lockInDaysLeft === 1 ? "" : "s"}</strong> remaining before you can cancel or withdraw.
                      </p>
                      <div className="rounded-xl px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 mt-2">
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                          💰 Stay invested! Complete your goal and withdraw your savings with profit!
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold text-foreground">Cancel Plan</h3>
                      <p className="text-sm text-muted-foreground">
                        Cancel <span className="font-semibold text-foreground">"{deleteTarget.label}"</span>?
                      </p>
                      {savedAmt > 0 && (
                        <div className="rounded-xl px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 text-left space-y-1.5">
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                            <AlertTriangle size={12} /> Early Cancellation Penalty
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            A <strong>{penaltyPct}% penalty (৳{penaltyAmt.toLocaleString()})</strong> will be deducted from your saved amount of ৳{savedAmt.toLocaleString()}.
                          </p>
                        </div>
                      )}
                      {goalPct > 0 && (
                        <div className="rounded-xl px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-left">
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                            🎯 You're {goalPct.toFixed(0)}% towards your goal! Stay invested to earn profit on completion! 💰
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {isWithinLockIn ? (
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setDeleteTarget(null)}
                    className="w-full h-12 rounded-2xl font-bold text-sm text-white"
                    style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                    Got it, Keep Saving 💪
                  </motion.button>
                ) : (
                  <>
                    <SavingsPinInput pin={deletePin} onChange={(p) => { setDeletePin(p); setDeletePinError(""); }} error={deletePinError} />
                    <div className="flex gap-3">
                      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setDeleteTarget(null)}
                        className="flex-1 h-12 rounded-2xl border-2 border-border font-bold text-sm text-muted-foreground">
                        Keep Saving
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }}
                        disabled={deletePin.length < 4 || deleting}
                        onClick={() => deleteTarget.type === "goal" ? handleDeleteGoal(deleteTarget.id) : deleteAutoSave(deleteTarget.id)}
                        className="flex-1 h-12 rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm disabled:opacity-40">
                        {deleting ? "Cancelling…" : savedAmt > 0 ? `Cancel (৳${penaltyAmt} penalty)` : "Cancel Plan"}
                      </motion.button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Installment Detail Modal */}
      <Dialog open={!!selectedInstallment} onOpenChange={(o) => { if (!o) setSelectedInstallment(null); }}>
        <DialogContent className="max-w-md rounded-[20px]">
          {selectedInstallment && (() => {
            const item = selectedInstallment;
            const statusLabel: Record<string, string> = {
              processed: "Processed", repaid: "Repaid", refunded: "Refunded",
              missed: "Missed", skipped: "Skipped", pending: "Pending",
            };
            const statusColor: Record<string, string> = {
              processed: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
              repaid: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
              refunded: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30",
              missed: "text-destructive bg-destructive/10 border-destructive/30",
              skipped: "text-muted-foreground bg-muted/40 border-border/60",
              pending: "text-muted-foreground bg-muted/40 border-dashed border-border/60",
            };
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CalendarClock size={18} className="text-primary" />
                    Installment Details
                  </DialogTitle>
                  <DialogDescription className="text-[11px]">
                    {formatInstallmentDate(item.date, { long: true })}{USER_TZ_ABBR ? ` • ${USER_TZ_ABBR}` : ""} ({USER_TIMEZONE})
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[14px] border border-border/60 bg-muted/30 p-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount</p>
                      <p className="text-[22px] font-black text-foreground">৳{item.amount.toLocaleString()}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${statusColor[item.status]}`}>
                      {statusLabel[item.status]}
                    </span>
                  </div>

                  <div className="space-y-2 text-[12px]">
                    {item.goalName && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Credited Goal</span>
                        <span className="font-semibold text-foreground text-right truncate">{item.goalName}</span>
                      </div>
                    )}
                    {item.goalId && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Goal ID</span>
                        <span className="font-mono text-[10px] text-muted-foreground/80 truncate">{item.goalId}</span>
                      </div>
                    )}
                    {item.txReference && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Tx Reference</span>
                        <span className="font-mono text-[10px] text-foreground truncate">{item.txReference}</span>
                      </div>
                    )}
                    {item.txId && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Transaction ID</span>
                        <span className="font-mono text-[10px] text-foreground truncate">{item.txId}</span>
                      </div>
                    )}
                    {item.txStatus && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Tx Status</span>
                        <span className="font-semibold text-foreground capitalize">{item.txStatus}</span>
                      </div>
                    )}
                    {item.outcome && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Run Outcome</span>
                        <span className="font-semibold text-foreground">{item.outcome}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Run ID</span>
                      <span className="font-mono text-[10px] text-muted-foreground/80 truncate">{item.id}</span>
                    </div>
                  </div>

                  {(item.walletDelta != null || item.balanceAfter != null) && (
                    <div className="rounded-[14px] border border-border/60 bg-card p-3 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Wallet Movement</p>
                      {item.walletDelta != null && (
                        <div className="flex justify-between text-[12px]">
                          <span className="text-muted-foreground">Change</span>
                          <span className={`font-bold ${item.walletDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                            {item.walletDelta >= 0 ? "+" : ""}৳{Math.abs(item.walletDelta).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {item.balanceAfter != null && (
                        <div className="flex justify-between text-[12px]">
                          <span className="text-muted-foreground">Balance After</span>
                          <span className="font-semibold text-foreground">৳{Number(item.balanceAfter).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(item.refundReason || item.note) && (
                    <div className={`rounded-[14px] border p-3 ${item.status === "refunded" ? "border-sky-500/30 bg-sky-500/5" : item.status === "missed" ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-muted/30"}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        {item.status === "refunded" ? "Refund Reason" : item.status === "missed" ? "Reason Missed" : "Note"}
                      </p>
                      <p className="text-[12px] text-foreground">{item.refundReason ?? item.note}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

const SavingsFlowGuarded = (props: SavingsFlowProps) => (
  <FeatureGuard featureKey="savings" onClose={props.onClose}>
    <SavingsFlow {...props} />
  </FeatureGuard>
);

export default SavingsFlowGuarded;
