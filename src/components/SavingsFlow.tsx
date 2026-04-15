import { useState, useEffect, useCallback, useMemo } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown, CheckCircle2, ChevronRight,
  Trash2, Clock, CalendarClock, Power, Gem, BarChart3, Wallet,
  ArrowUpRight, ArrowDownRight, ShieldCheck, Coins, LineChart,
  RefreshCw, Sparkles, Target, CircleDollarSign, FileText, Lock,
  AlertTriangle, X, ChevronDown, Gift, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { getBalance, onBalanceChange, fetchBalance } from "@/lib/balanceStore";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { verifyPin } from "@/lib/verifyPin";
import SlideToConfirm from "@/components/SlideToConfirm";
import { haptics } from "@/lib/haptics";

// ─── Types ───────────────────────────────────────────────────────────
interface SavingsGoal {
  id: string; name: string; emoji: string;
  target_amount: number; saved_amount: number; status: string;
}
interface AutoSaveSchedule {
  id: string; goal_id: string | null; frequency: string; amount: number;
  is_active: boolean; next_run_at: string; duration: string | null;
  ends_at: string | null; settled: boolean;
}

// ─── Mock investment data ────────────────────────────────────────────
interface GoldHolding { grams: number; avgBuyPrice: number; }
interface StockHolding { symbol: string; name: string; qty: number; avgPrice: number; currentPrice: number; change: number; }

const MOCK_GOLD_PRICE = 16200;
const MOCK_GOLD_24K_PRICE = 19500;

const MOCK_STOCKS: { symbol: string; name: string; price: number; change: number; sector: string }[] = [
  { symbol: "GRPH", name: "Grameenphone", price: 385.50, change: 2.4, sector: "Telecom" },
  { symbol: "SQPH", name: "Square Pharma", price: 218.30, change: -0.8, sector: "Pharma" },
  { symbol: "BRAC", name: "BRAC Bank", price: 42.10, change: 1.2, sector: "Banking" },
  { symbol: "BATB", name: "BAT Bangladesh", price: 550.00, change: 3.1, sector: "FMCG" },
  { symbol: "LHBL", name: "LafargeHolcim BD", price: 68.90, change: -1.5, sector: "Cement" },
  { symbol: "RENP", name: "Renata Pharma", price: 1320.00, change: 0.6, sector: "Pharma" },
  { symbol: "ISLB", name: "Islami Bank BD", price: 28.50, change: 4.2, sector: "Banking" },
  { symbol: "WALP", name: "Walton Hi-Tech", price: 1250.00, change: -2.1, sector: "Tech" },
];

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
const EMOJI_LIST = ["🎯", "🛡️", "📱", "✈️", "🏠", "🎓", "💍", "🚗", "💊", "🎁"];
const GOLD_PRESETS = [0.5, 1, 2, 5, 10];

type MainTab = "savings" | "gold" | "stocks";
type SavingsStep = "home" | "add" | "create" | "autosave" | "review" | "terms" | "detail";
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
  const [goldHolding, setGoldHolding] = useState<GoldHolding>({ grams: 0, avgBuyPrice: 0 });
  const [goldGrams, setGoldGrams] = useState("");
  const [goldKarat, setGoldKarat] = useState<"22k" | "24k">("22k");

  // ─── Stock state ────────
  const [stockStep, setStockStep] = useState<StockStep>("market");
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>([]);
  const [selectedStock, setSelectedStock] = useState<typeof MOCK_STOCKS[0] | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockAction, setStockAction] = useState<"buy" | "sell">("buy");

  useEffect(() => { const unsub = onBalanceChange(setBalance); return () => { unsub(); }; }, []);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("savings_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setGoals((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  const loadAutoSaves = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("savings_auto_save").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setAutoSaves((data as any[]) ?? []);
  }, [user]);

  const loadGoldHoldings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("gold_holdings" as any).select("*").eq("user_id", user.id);
    const holdings = (data as any[]) ?? [];
    const h22k = holdings.find((h: any) => h.karat === "22k");
    const h24k = holdings.find((h: any) => h.karat === "24k");
    const active = goldKarat === "24k" ? h24k : h22k;
    setGoldHolding({ grams: active?.grams ?? 0, avgBuyPrice: active?.avg_buy_price ?? 0 });
  }, [user, goldKarat]);

  const loadStockHoldings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("stock_holdings" as any).select("*").eq("user_id", user.id);
    const holdings = (data as any[]) ?? [];
    setStockHoldings(holdings.map((h: any) => ({
      symbol: h.symbol, name: h.name, qty: h.quantity,
      avgPrice: Number(h.avg_buy_price), currentPrice: MOCK_STOCKS.find(s => s.symbol === h.symbol)?.price ?? Number(h.avg_buy_price),
      change: MOCK_STOCKS.find(s => s.symbol === h.symbol)?.change ?? 0,
    })));
  }, [user]);

  useEffect(() => { loadGoals(); loadAutoSaves(); loadGoldHoldings(); loadStockHoldings(); }, [loadGoals, loadAutoSaves, loadGoldHoldings, loadStockHoldings]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("savings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_goals", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_deposits", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .on("postgres_changes", { event: "*", schema: "public", table: "gold_holdings", filter: `user_id=eq.${user.id}` }, () => loadGoldHoldings())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_holdings", filter: `user_id=eq.${user.id}` }, () => loadStockHoldings())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadGoals, loadGoldHoldings, loadStockHoldings]);

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
  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > balance) { setError("Insufficient balance"); return; }
    if (!selectedGoal) { setError("Select a savings goal"); return; }
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
    } catch (err: any) { setError(err.message || "Failed to save"); }
    finally { setProcessing(false); }
  };

  const handleCreateGoal = async () => {
    if (!newName.trim()) { setError("Enter a goal name"); return; }
    const target = parseFloat(newTarget);
    if (!target || target <= 0) { setError("Enter a valid target amount"); return; }
    if (!user) return;
    setProcessing(true); setError("");
    try {
      const { error: insertErr } = await supabase.from("savings_goals").insert({ user_id: user.id, name: newName.trim(), emoji: newEmoji, target_amount: target } as any);
      if (insertErr) throw insertErr;
      toast.success(`Goal "${newName}" created!`);
      setStep("home"); setNewName(""); setNewEmoji("🎯"); setNewTarget(""); loadGoals();
    } catch (err: any) { setError(err.message || "Failed to create goal"); }
    finally { setProcessing(false); }
  };

  const handleDeleteGoal = async (goalId: string) => {
    // Check 3-month lock-in
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
      const createdAt = new Date((goal as any).created_at || Date.now());
      const threeMonthsLater = new Date(createdAt);
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
      if (Date.now() < threeMonthsLater.getTime()) {
        const daysLeft = Math.ceil((threeMonthsLater.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        toast.error(`Cannot cancel before 3-month lock-in period. ${daysLeft} days remaining.`);
        setDeleteTarget(null); setDeletePin(""); setDeleting(false);
        return;
      }
    }
    if (deletePin.length < 4) { setDeletePinError("Enter your 4-digit PIN"); return; }
    setDeleting(true); setDeletePinError("");
    const pinValid = await verifyPin(deletePin);
    if (!pinValid) { setDeletePinError("Incorrect PIN"); setDeletePin(""); setDeleting(false); return; }
    const { error } = await supabase.from("savings_goals").delete().eq("id", goalId);
    if (error) { toast.error("Failed to delete goal"); setDeleting(false); return; }
    toast.success("Goal cancelled"); loadGoals();
    setDeleteTarget(null); setDeletePin(""); setDeleting(false);
  };

  const handleCreateAutoSave = async () => {
    const amt = parseFloat(autoAmount);
    if (!amt || amt <= 0) { setError("Select or enter an amount"); return; }
    if (!termsAccepted) { setError("Please accept Terms & Conditions"); return; }
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    if (!user) return;
    setProcessing(true); setError(""); setPinError("");
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { setPinError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }
      const nextRun = new Date();
      if (autoFreq === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (autoFreq === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setMonth(nextRun.getMonth() + 1);
      const endsAt = calcEndsAt(autoDuration);
      const { error: insertErr } = await supabase.from("savings_auto_save").insert({
        user_id: user.id, goal_id: autoGoalId === "general" ? null : autoGoalId,
        frequency: autoFreq, amount: amt, next_run_at: nextRun.toISOString(), duration: autoDuration, ends_at: endsAt,
      } as any);
      if (insertErr) throw insertErr;
      fireSuccessConfetti();
      toast.success("Auto-save + investment plan activated!");
      setAutoAmount(""); setAutoCustom(false); setTermsAccepted(false); setPin(""); loadAutoSaves();
    } catch (err: any) { setError(err.message || "Failed to create schedule"); }
    finally { setProcessing(false); }
  };

  const toggleAutoSave = async (id: string, current: boolean) => {
    await supabase.from("savings_auto_save").update({ is_active: !current } as any).eq("id", id);
    loadAutoSaves();
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

  // ─── Gold handlers ────────
  const currentGoldPrice = goldKarat === "24k" ? MOCK_GOLD_24K_PRICE : MOCK_GOLD_PRICE;

  const handleBuyGold = async () => {
    const grams = parseFloat(goldGrams);
    if (!grams || grams <= 0) { setError("Enter valid grams"); return; }
    const cost = Math.round(grams * currentGoldPrice);
    if (cost > balance) { setError("Insufficient balance"); return; }
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
      toast.success(`🪙 Purchased ${grams}g gold for ৳${cost.toLocaleString()}`);
      setGoldGrams(""); setGoldStep("portfolio"); setPin("");
    } catch (err: any) { setError(err.message || "Failed to buy gold"); }
    finally { setProcessing(false); }
  };

  const handleSellGold = async () => {
    const grams = parseFloat(goldGrams);
    if (!grams || grams <= 0) { setError("Enter valid grams"); return; }
    if (grams > goldHolding.grams) { setError("Insufficient gold balance"); return; }
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
      toast.success(`💰 Sold ${grams}g gold for ৳${revenue.toLocaleString()}`);
      setGoldGrams(""); setGoldStep("portfolio"); setPin("");
    } catch (err: any) { setError(err.message || "Failed to sell gold"); }
    finally { setProcessing(false); }
  };

  const goldValue = Math.round(goldHolding.grams * MOCK_GOLD_PRICE);
  const goldProfit = goldValue - Math.round(goldHolding.grams * goldHolding.avgBuyPrice);
  const goldProfitPct = goldHolding.avgBuyPrice > 0 ? ((MOCK_GOLD_PRICE - goldHolding.avgBuyPrice) / goldHolding.avgBuyPrice * 100) : 0;

  // ─── Stock handlers ────────
  const handleBuyStock = async () => {
    if (!selectedStock) return;
    const qty = parseInt(stockQty);
    if (!qty || qty <= 0) { setError("Enter valid quantity"); return; }
    const cost = Math.round(qty * selectedStock.price);
    if (cost > balance) { setError("Insufficient balance"); return; }
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
      toast.success(`📈 Bought ${qty} ${selectedStock.symbol} for ৳${cost.toLocaleString()}`);
      setStockQty(""); setSelectedStock(null); setStockStep("portfolio"); setPin("");
    } catch (err: any) { setError(err.message || "Failed to buy stock"); }
    finally { setProcessing(false); }
  };

  const handleSellStock = async () => {
    if (!selectedStock) return;
    const qty = parseInt(stockQty);
    const holding = stockHoldings.find(h => h.symbol === selectedStock.symbol);
    if (!qty || qty <= 0) { setError("Enter valid quantity"); return; }
    if (!holding || qty > holding.qty) { setError("Insufficient shares"); return; }
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
      toast.success(`💰 Sold ${qty} ${selectedStock.symbol} for ৳${revenue.toLocaleString()}`);
      setStockQty(""); setSelectedStock(null); setStockStep("portfolio"); setPin("");
    } catch (err: any) { setError(err.message || "Failed to sell stock"); }
    finally { setProcessing(false); }
  };


  const totalStockValue = stockHoldings.reduce((s, h) => s + h.qty * h.currentPrice, 0);
  const totalStockCost = stockHoldings.reduce((s, h) => s + h.qty * h.avgPrice, 0);
  const totalStockProfit = totalStockValue - totalStockCost;
  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0);

  // ─── Header config ────────
  const headerGradient = mainTab === "savings"
    ? "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))"
    : mainTab === "gold"
    ? "linear-gradient(135deg, hsl(43 90% 48%), hsl(35 85% 38%))"
    : "linear-gradient(135deg, hsl(217 80% 45%), hsl(230 70% 35%))";

  const headerTitle = mainTab === "savings" ? "Savings & Goals" : mainTab === "gold" ? "Gold Investment" : "Stock Market";
  const headerSub = mainTab === "savings"
    ? `Total Saved: ৳${totalSaved.toLocaleString()}`
    : mainTab === "gold" ? `Gold Price: ৳${MOCK_GOLD_PRICE.toLocaleString()}/g`
    : `Portfolio: ৳${Math.round(totalStockValue).toLocaleString()}`;

  const handleBack = () => {
    setError("");
    if (mainTab === "savings") {
      if (step === "review") { setPin(""); setPinError(""); setTermsAccepted(false); setStep("autosave"); }
      else if (step === "home") onClose();
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
          {mainTab === "savings" && step === "home" && (
            <div className="flex gap-1.5">
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setStep("autosave")}
                className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center"><CalendarClock size={16} /></motion.button>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setStep("create")}
                className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center"><Plus size={18} /></motion.button>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 mt-3 relative z-10">
          {([
            { key: "savings" as MainTab, icon: Target, label: "Savings" },
            { key: "gold" as MainTab, icon: Coins, label: "Gold" },
            { key: "stocks" as MainTab, icon: LineChart, label: "Stocks" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => { setMainTab(tab.key); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all ${mainTab === tab.key ? "bg-white/25 text-white shadow-sm" : "bg-white/8 text-white/60 hover:bg-white/12"}`}>
              <tab.icon size={14} />{tab.label}
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

              {autoSaves.filter(a => a.is_active).length > 0 && (
                <button onClick={() => setStep("autosave")} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/8 border border-primary/20 text-primary text-[12px] font-semibold">
                  <CalendarClock size={14} />
                  {autoSaves.filter(a => a.is_active).length} active auto-save plan(s)
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                </button>
              )}

              {/* Investment overview */}
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setMainTab("gold")} className="text-left p-3.5 rounded-[18px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center"><Coins size={16} className="text-amber-600 dark:text-amber-400" /></div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gold</p>
                  <p className="text-[16px] font-black text-foreground">{goldHolding.grams > 0 ? `${goldHolding.grams}g` : "—"}</p>
                  {goldHolding.grams > 0 && (
                    <p className={`text-[10px] font-bold flex items-center gap-0.5 ${goldProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {goldProfit >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{goldProfit >= 0 ? "+" : ""}৳{goldProfit.toLocaleString()}
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

              {/* Goals */}
              {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : goals.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-4xl">🎯</p>
                  <p className="text-sm text-muted-foreground">No savings goals yet</p>
                  <button onClick={() => setStep("create")} className="text-sm font-semibold text-primary">Create your first goal →</button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Your Goals</p>
                  {goals.map((goal, i) => {
                    const pct = goal.target_amount > 0 ? Math.min(100, (Number(goal.saved_amount) / Number(goal.target_amount)) * 100) : 0;
                    return (
                      <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="bg-card rounded-[18px] border border-border/60 shadow-[var(--shadow-card)] p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <button onClick={() => { setSelectedGoal(goal); setStep("add"); }} className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className="text-2xl">{goal.emoji}</span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-foreground truncate">{goal.name}</p>
                              <p className="text-[11px] text-muted-foreground">৳{Number(goal.saved_amount).toLocaleString()} / ৳{Number(goal.target_amount).toLocaleString()}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            {goal.status === "completed" ? <CheckCircle2 size={20} className="text-primary shrink-0" />
                              : <button onClick={() => { setSelectedGoal(goal); setStep("add"); }}><ChevronRight size={16} className="text-muted-foreground/50 shrink-0" /></button>}
                            <button onClick={() => { setDeleteTarget({ type: "goal", id: goal.id, label: goal.name }); setDeletePin(""); setDeletePinError(""); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-primary">{pct.toFixed(0)}% complete</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                            <Sparkles size={10} /> Complete goal & withdraw with profit! 💰
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════ SAVINGS: ADD MONEY ══════════ */}
          {mainTab === "savings" && step === "add" && (
            <motion.div key="s-add" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Select Goal</p>
                {goals.filter(g => g.status === "active").map(goal => (
                  <motion.button key={goal.id} whileTap={{ scale: 0.98 }} onClick={() => setSelectedGoal(goal)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-[18px] border transition-all ${selectedGoal?.id === goal.id ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card hover:bg-muted/30"}`}>
                    <span className="text-2xl">{goal.emoji}</span>
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-semibold text-foreground">{goal.name}</p>
                      <p className="text-[11px] text-muted-foreground">৳{(Number(goal.target_amount) - Number(goal.saved_amount)).toLocaleString()} remaining</p>
                    </div>
                    {selectedGoal?.id === goal.id && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                  </motion.button>
                ))}
              </div>
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
          {mainTab === "savings" && step === "create" && (
            <motion.div key="s-create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pick an Emoji</p>
                  <div className="flex gap-2 flex-wrap">
                    {EMOJI_LIST.map(e => (
                      <button key={e} onClick={() => setNewEmoji(e)}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${newEmoji === e ? "bg-primary/20 ring-2 ring-primary/40 scale-110" : "bg-muted hover:bg-muted/70"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Goal Name</p>
                  <input placeholder="e.g. New Phone, Vacation" value={newName} onChange={e => { setNewName(e.target.value); setError(""); }}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-[14px] font-medium outline-none placeholder:text-muted-foreground/40" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Target Amount</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-bold text-muted-foreground">৳</span>
                    <input type="number" inputMode="decimal" placeholder="0" value={newTarget} onChange={e => { setNewTarget(e.target.value); setError(""); }}
                      className="w-full pl-10 pr-4 py-3 text-[18px] font-bold bg-muted rounded-xl outline-none text-foreground placeholder:text-muted-foreground/40" />
                  </div>
                </div>
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreateGoal} disabled={processing}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                {processing ? "Creating…" : "Create Goal"}
              </motion.button>
            </motion.div>
          )}

          {/* ══════════ SAVINGS: AUTO-SAVE + INVEST ══════════ */}
          {mainTab === "savings" && step === "autosave" && (
            <motion.div key="s-auto" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Sharia badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
                <ShieldCheck size={14} className="text-primary" />
                <p className="text-[11px] font-bold text-primary">100% Halal • No Interest • Trade-Based Profit</p>
              </div>

              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <p className="text-[14px] font-bold text-foreground">Create Savings + Investment Plan</p>

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
                  <Select value={autoGoalId} onValueChange={setAutoGoalId}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Savings</SelectItem>
                      {goals.filter(g => g.status === "active").map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* ═══ Estimated Profit Card ═══ */}
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
                  onClick={() => { if (!autoAmtNum || autoAmtNum <= 0) { setError("Select or enter an amount"); return; } setStep("review"); setError(""); }}
                  className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg"
                  style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                  Continue to Review →
                </motion.button>
              </div>

              {/* Existing schedules */}
              {autoSaves.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Active Plans</p>
                  {autoSaves.map(schedule => {
                    const linkedGoal = goals.find(g => g.id === schedule.goal_id);
                    const durOpt = DURATION_OPTIONS.find(d => d.value === schedule.duration);
                    return (
                      <div key={schedule.id} className={`bg-card rounded-[16px] border p-3.5 space-y-2 ${schedule.settled ? "border-primary/40 bg-primary/5" : "border-border/60"}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-semibold text-foreground">৳{Number(schedule.amount).toLocaleString()} / {schedule.frequency}</p>
                              {schedule.settled && <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[9px] font-bold uppercase">Completed</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {linkedGoal ? `${linkedGoal.emoji} ${linkedGoal.name}` : "General Savings"}
                              {durOpt && ` • ${durOpt.label}`}
                            </p>
                            {schedule.ends_at && !schedule.settled && (
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-muted-foreground"><Clock size={10} className="inline mr-0.5 -mt-0.5" />{remainingTime(schedule.ends_at)}</p>
                                {durOpt && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                                  <Lock size={8} /> {durOpt.minLock}m lock
                                </span>}
                              </div>
                            )}
                          </div>
                          {!schedule.settled && <Switch checked={schedule.is_active} onCheckedChange={() => toggleAutoSave(schedule.id, schedule.is_active)} />}
                          <button onClick={() => { setDeleteTarget({ type: "auto", id: schedule.id, label: `৳${Number(schedule.amount).toLocaleString()} ${schedule.frequency}` }); setDeletePin(""); setDeletePinError(""); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════ SAVINGS: REVIEW & CONFIRM ══════════ */}
          {mainTab === "savings" && step === "review" && (
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
                    { label: "Linked Goal", value: autoGoalId === "general" ? "General Savings" : (goals.find(g => g.id === autoGoalId)?.name ?? "General Savings") },
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

              {/* T&C acceptance */}
              <div className="space-y-2">
                <button onClick={() => setShowTermsSheet(true)} className="flex items-center gap-2 text-[11px] font-medium text-primary">
                  <FileText size={13} /> Read Terms & Conditions
                </button>
                <button onClick={() => setTermsAccepted(!termsAccepted)}
                  className="flex items-center gap-2.5 w-full text-left">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${termsAccepted ? "bg-primary border-primary" : "border-border"}`}>
                    {termsAccepted && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    I agree to the <span className="text-foreground font-semibold">Terms & Conditions</span>, lock-in period, and cancellation policy
                  </p>
                </button>
              </div>

              {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}

              <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
              <SlideToConfirm onConfirm={handleCreateAutoSave} label={processing ? "Creating…" : "Slide to Start Plan"} disabled={pin.length < 4 || processing || !termsAccepted} pinComplete={pin.length === 4 && termsAccepted} />
            </motion.div>
          )}

          {/* ══════════ GOLD TAB ══════════ */}
          {mainTab === "gold" && goldStep === "portfolio" && (
            <motion.div key="g-port" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <ShieldCheck size={14} className="text-amber-600 dark:text-amber-400" />
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300"><p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Sharia Compliant • BAJUS Certified Rate</p></p>
              </div>
              <div className="rounded-[20px] p-5 border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg"><Coins size={22} className="text-white" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Gold</p>
                    <p className="text-[28px] font-black text-foreground leading-tight">{goldHolding.grams > 0 ? `${goldHolding.grams}g` : "0g"}</p>
                  </div>
                </div>
                {goldHolding.grams > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground font-semibold">Current Value</p>
                      <p className="text-[16px] font-black text-foreground">৳{goldValue.toLocaleString()}</p>
                    </div>
                    <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground font-semibold">Profit/Loss</p>
                      <p className={`text-[16px] font-black flex items-center gap-0.5 ${goldProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {goldProfit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}৳{Math.abs(goldProfit).toLocaleString()}
                      </p>
                      <p className={`text-[10px] font-bold ${goldProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>({goldProfitPct >= 0 ? "+" : ""}{goldProfitPct.toFixed(1)}%)</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-card rounded-[18px] border border-border/60 shadow-[var(--shadow-card)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-bold text-foreground">Live Gold Price</p>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-semibold">22K Gold</p>
                    <p className="text-[18px] font-black text-amber-600 dark:text-amber-400">৳{MOCK_GOLD_PRICE.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">per gram</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-semibold">24K Gold</p>
                    <p className="text-[18px] font-black text-amber-600 dark:text-amber-400">৳{MOCK_GOLD_24K_PRICE.toLocaleString()}</p>
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
                        {k.toUpperCase()} — ৳{(k === "22k" ? MOCK_GOLD_PRICE : MOCK_GOLD_24K_PRICE).toLocaleString()}/g
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
                {parseFloat(goldGrams) > 0 && (
                  <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">Total {goldStep === "buy" ? "Cost" : "Revenue"}</span>
                      <span className="font-black text-foreground">৳{Math.round(parseFloat(goldGrams) * currentGoldPrice).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="text-muted-foreground">৳{currentGoldPrice.toLocaleString()} × {goldGrams}g</span>
                    </div>
                  </div>
                )}
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
              </div>
              <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
              <SlideToConfirm onConfirm={goldStep === "buy" ? handleBuyGold : handleSellGold} label={processing ? "Processing…" : goldStep === "buy" ? "Slide to Buy Gold" : "Slide to Sell Gold"} disabled={pin.length < 4 || processing} pinComplete={pin.length === 4} />
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
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">DSE Market — Top Halal Stocks</p>
                {MOCK_STOCKS.map((stock, i) => {
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
                    const stock = MOCK_STOCKS.find(s => s.symbol === h.symbol);
                    return (
                      <button key={h.symbol} onClick={() => {
                        if (stock) { setSelectedStock(stock); setStockAction("sell"); setStockQty(""); setStockStep("trade"); setError(""); }
                      }} className="w-full bg-card rounded-[16px] border border-border/60 shadow-[var(--shadow-xs)] p-3.5 flex items-center gap-3">
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
                    {[1, 5, 10, 25, 50].map(q => (
                      <button key={q} onClick={() => setStockQty(String(q))}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${stockQty === String(q) ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                {parseInt(stockQty) > 0 && (
                  <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">Total {stockAction === "buy" ? "Cost" : "Revenue"}</span>
                      <span className="font-black text-foreground">৳{Math.round(parseInt(stockQty) * selectedStock.price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Price per share</span>
                      <span className="text-muted-foreground">৳{selectedStock.price.toLocaleString()} × {stockQty}</span>
                    </div>
                    {stockAction === "sell" && (() => {
                      const h = stockHoldings.find(x => x.symbol === selectedStock.symbol);
                      if (!h) return null;
                      const profit = (selectedStock.price - h.avgPrice) * parseInt(stockQty);
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
                )}
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
              </div>
              <SavingsPinInput pin={pin} onChange={(p) => { setPin(p); setPinError(""); }} error={pinError} />
              <SlideToConfirm onConfirm={stockAction === "buy" ? handleBuyStock : handleSellStock} label={processing ? "Processing…" : stockAction === "buy" ? "Slide to Buy" : "Slide to Sell"} disabled={pin.length < 4 || processing} pinComplete={pin.length === 4} />
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
          // Calculate lock-in and penalty info for the delete sheet
          const isGoal = deleteTarget.type === "goal";
          const goalForDelete = isGoal ? goals.find(g => g.id === deleteTarget.id) : null;
          const autoForDelete = !isGoal ? autoSaves.find(a => a.id === deleteTarget.id) : null;
          const createdAt = goalForDelete ? new Date((goalForDelete as any).created_at || Date.now()) : autoForDelete ? new Date((autoForDelete as any).created_at || Date.now()) : new Date();
          const threeMonthsLater = new Date(createdAt);
          threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
          const isWithinLockIn = Date.now() < threeMonthsLater.getTime();
          const lockInDaysLeft = isWithinLockIn ? Math.ceil((threeMonthsLater.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

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
                        🔒 Your plan has a <strong>3-month lock-in period</strong>. You have <strong>{lockInDaysLeft} days</strong> remaining before you can cancel.
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
    </motion.div>
  );
};

const SavingsFlowGuarded = (props: SavingsFlowProps) => (
  <FeatureGuard featureKey="savings" onClose={props.onClose}>
    <SavingsFlow {...props} />
  </FeatureGuard>
);

export default SavingsFlowGuarded;
