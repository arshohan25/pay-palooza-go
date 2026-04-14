import { useState, useEffect, useCallback, useMemo } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown, CheckCircle2, ChevronRight,
  Trash2, Clock, CalendarClock, Power, Gem, BarChart3, Wallet,
  ArrowUpRight, ArrowDownRight, ShieldCheck, Coins, LineChart,
  RefreshCw, Sparkles, Target, PiggyBank, CircleDollarSign
} from "lucide-react";
import { toast } from "sonner";
import { getBalance, onBalanceChange, fetchBalance } from "@/lib/balanceStore";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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

// ─── Mock investment data (client-side simulation) ───────────────────
interface GoldHolding { grams: number; avgBuyPrice: number; }
interface StockHolding { symbol: string; name: string; qty: number; avgPrice: number; currentPrice: number; change: number; }

const MOCK_GOLD_PRICE = 9850; // ৳ per gram (22K)
const MOCK_GOLD_24K_PRICE = 10750;

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

// ─── Constants ───────────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "3y", label: "3 Years" },
  { value: "5y", label: "5 Years" },
  { value: "10y", label: "10 Years" },
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

const PRESET_AMOUNTS = [100, 200, 500, 1000, 5000];
const EMOJI_LIST = ["🎯", "🛡️", "📱", "✈️", "🏠", "🎓", "💍", "🚗", "💊", "🎁"];
const GOLD_PRESETS = [0.5, 1, 2, 5, 10];

type MainTab = "savings" | "gold" | "stocks";
type SavingsStep = "home" | "add" | "create" | "autosave";
type GoldStep = "portfolio" | "buy" | "sell";
type StockStep = "market" | "portfolio" | "trade";

interface SavingsFlowProps { onClose: () => void; }

const SavingsFlow = ({ onClose }: SavingsFlowProps) => {
  const { t } = useI18n();
  const { user } = useAuth();

  // ─── Main tab ────────
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

  // ─── Gold state ────────
  const [goldStep, setGoldStep] = useState<GoldStep>("portfolio");
  const [goldHolding, setGoldHolding] = useState<GoldHolding>(() => {
    try {
      const s = localStorage.getItem("mfs_gold_holding");
      return s ? JSON.parse(s) : { grams: 0, avgBuyPrice: 0 };
    } catch { return { grams: 0, avgBuyPrice: 0 }; }
  });
  const [goldGrams, setGoldGrams] = useState("");
  const [goldKarat, setGoldKarat] = useState<"22k" | "24k">("22k");

  // ─── Stock state ────────
  const [stockStep, setStockStep] = useState<StockStep>("market");
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>(() => {
    try {
      const s = localStorage.getItem("mfs_stock_holdings");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [selectedStock, setSelectedStock] = useState<typeof MOCK_STOCKS[0] | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockAction, setStockAction] = useState<"buy" | "sell">("buy");

  // Persist investment data
  useEffect(() => { localStorage.setItem("mfs_gold_holding", JSON.stringify(goldHolding)); }, [goldHolding]);
  useEffect(() => { localStorage.setItem("mfs_stock_holdings", JSON.stringify(stockHoldings)); }, [stockHoldings]);

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

  useEffect(() => { loadGoals(); loadAutoSaves(); }, [loadGoals, loadAutoSaves]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("savings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_goals", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_deposits", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadGoals]);

  // ─── Savings handlers ────────
  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > balance) { setError("Insufficient balance"); return; }
    if (!selectedGoal) { setError("Select a savings goal"); return; }
    setProcessing(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("savings_deposit", { p_goal_id: selectedGoal.id, p_amount: amt, p_source: "manual" });
      if (rpcError) throw rpcError;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      await fetchBalance();
      if (result.goal_completed) { fireSuccessConfetti(); toast.success(`🎉 "${selectedGoal.name}" goal completed!`); }
      else { toast.success(`৳${amt.toLocaleString()} saved to "${selectedGoal.name}"`); }
      setStep("home"); setAmount(""); setSelectedGoal(null);
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
    const { error } = await supabase.from("savings_goals").delete().eq("id", goalId);
    if (error) { toast.error("Failed to delete goal"); return; }
    toast.success("Goal deleted"); loadGoals();
  };

  const handleCreateAutoSave = async () => {
    const amt = parseFloat(autoAmount);
    if (!amt || amt <= 0) { setError("Select or enter an amount"); return; }
    if (!user) return;
    setProcessing(true); setError("");
    try {
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
      toast.success("Auto-save schedule created!");
      setAutoAmount(""); setAutoCustom(false); loadAutoSaves();
    } catch (err: any) { setError(err.message || "Failed to create schedule"); }
    finally { setProcessing(false); }
  };

  const toggleAutoSave = async (id: string, current: boolean) => {
    await supabase.from("savings_auto_save").update({ is_active: !current } as any).eq("id", id);
    loadAutoSaves();
  };

  const deleteAutoSave = async (id: string) => {
    await supabase.from("savings_auto_save").delete().eq("id", id);
    loadAutoSaves(); toast.success("Schedule removed");
  };

  // ─── Gold handlers ────────
  const currentGoldPrice = goldKarat === "24k" ? MOCK_GOLD_24K_PRICE : MOCK_GOLD_PRICE;

  const handleBuyGold = () => {
    const grams = parseFloat(goldGrams);
    if (!grams || grams <= 0) { setError("Enter valid grams"); return; }
    const cost = Math.round(grams * currentGoldPrice);
    if (cost > balance) { setError("Insufficient balance"); return; }
    setProcessing(true);
    setTimeout(() => {
      const totalGrams = goldHolding.grams + grams;
      const totalCost = (goldHolding.grams * goldHolding.avgBuyPrice) + cost;
      setGoldHolding({ grams: totalGrams, avgBuyPrice: Math.round(totalCost / totalGrams) });
      fireSuccessConfetti();
      toast.success(`🪙 Purchased ${grams}g gold for ৳${cost.toLocaleString()}`);
      setGoldGrams(""); setGoldStep("portfolio"); setError(""); setProcessing(false);
    }, 1200);
  };

  const handleSellGold = () => {
    const grams = parseFloat(goldGrams);
    if (!grams || grams <= 0) { setError("Enter valid grams"); return; }
    if (grams > goldHolding.grams) { setError("Insufficient gold balance"); return; }
    setProcessing(true);
    setTimeout(() => {
      const revenue = Math.round(grams * currentGoldPrice);
      const remaining = goldHolding.grams - grams;
      setGoldHolding({ grams: remaining, avgBuyPrice: remaining > 0 ? goldHolding.avgBuyPrice : 0 });
      toast.success(`💰 Sold ${grams}g gold for ৳${revenue.toLocaleString()}`);
      setGoldGrams(""); setGoldStep("portfolio"); setError(""); setProcessing(false);
    }, 1200);
  };

  const goldValue = Math.round(goldHolding.grams * MOCK_GOLD_PRICE);
  const goldProfit = goldValue - Math.round(goldHolding.grams * goldHolding.avgBuyPrice);
  const goldProfitPct = goldHolding.avgBuyPrice > 0 ? ((MOCK_GOLD_PRICE - goldHolding.avgBuyPrice) / goldHolding.avgBuyPrice * 100) : 0;

  // ─── Stock handlers ────────
  const handleBuyStock = () => {
    if (!selectedStock) return;
    const qty = parseInt(stockQty);
    if (!qty || qty <= 0) { setError("Enter valid quantity"); return; }
    const cost = Math.round(qty * selectedStock.price);
    if (cost > balance) { setError("Insufficient balance"); return; }
    setProcessing(true);
    setTimeout(() => {
      setStockHoldings(prev => {
        const existing = prev.find(h => h.symbol === selectedStock.symbol);
        if (existing) {
          const newQty = existing.qty + qty;
          const newAvg = Math.round(((existing.qty * existing.avgPrice) + cost) / newQty);
          return prev.map(h => h.symbol === selectedStock.symbol
            ? { ...h, qty: newQty, avgPrice: newAvg, currentPrice: selectedStock.price, change: selectedStock.change }
            : h);
        }
        return [...prev, { symbol: selectedStock.symbol, name: selectedStock.name, qty, avgPrice: selectedStock.price, currentPrice: selectedStock.price, change: selectedStock.change }];
      });
      fireSuccessConfetti();
      toast.success(`📈 Bought ${qty} ${selectedStock.symbol} for ৳${cost.toLocaleString()}`);
      setStockQty(""); setSelectedStock(null); setStockStep("portfolio"); setError(""); setProcessing(false);
    }, 1200);
  };

  const handleSellStock = () => {
    if (!selectedStock) return;
    const qty = parseInt(stockQty);
    const holding = stockHoldings.find(h => h.symbol === selectedStock.symbol);
    if (!qty || qty <= 0) { setError("Enter valid quantity"); return; }
    if (!holding || qty > holding.qty) { setError("Insufficient shares"); return; }
    setProcessing(true);
    setTimeout(() => {
      setStockHoldings(prev => prev.map(h => {
        if (h.symbol !== selectedStock.symbol) return h;
        const newQty = h.qty - qty;
        return newQty <= 0 ? null! : { ...h, qty: newQty, currentPrice: selectedStock.price, change: selectedStock.change };
      }).filter(Boolean));
      const revenue = Math.round(qty * selectedStock.price);
      toast.success(`💰 Sold ${qty} ${selectedStock.symbol} for ৳${revenue.toLocaleString()}`);
      setStockQty(""); setSelectedStock(null); setStockStep("portfolio"); setError(""); setProcessing(false);
    }, 1200);
  };

  const totalStockValue = stockHoldings.reduce((s, h) => s + h.qty * h.currentPrice, 0);
  const totalStockCost = stockHoldings.reduce((s, h) => s + h.qty * h.avgPrice, 0);
  const totalStockProfit = totalStockValue - totalStockCost;
  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0);

  // ─── Header gradient per tab ────────
  const headerGradient = mainTab === "savings"
    ? "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))"
    : mainTab === "gold"
    ? "linear-gradient(135deg, hsl(43 90% 48%), hsl(35 85% 38%))"
    : "linear-gradient(135deg, hsl(217 80% 45%), hsl(230 70% 35%))";

  const headerTitle = mainTab === "savings" ? "Savings & Goals" : mainTab === "gold" ? "Gold Investment" : "Stock Market";
  const headerSub = mainTab === "savings"
    ? `Total Saved: ৳${totalSaved.toLocaleString()}`
    : mainTab === "gold"
    ? `Gold Price: ৳${MOCK_GOLD_PRICE.toLocaleString()}/g`
    : `Portfolio: ৳${Math.round(totalStockValue).toLocaleString()}`;

  const handleBack = () => {
    setError("");
    if (mainTab === "savings") {
      if (step === "home") onClose();
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
      <motion.div
        className="px-4 pt-3 pb-3 text-white relative overflow-hidden"
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{ background: headerGradient }}
      >
        {/* bokeh accents */}
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

        {/* Main tab switcher */}
        <div className="flex gap-1.5 mt-3 relative z-10">
          {([
            { key: "savings" as MainTab, icon: PiggyBank, label: "Savings" },
            { key: "gold" as MainTab, icon: Coins, label: "Gold" },
            { key: "stocks" as MainTab, icon: LineChart, label: "Stocks" },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setMainTab(tab.key); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all ${
                mainTab === tab.key ? "bg-white/25 text-white shadow-sm" : "bg-white/8 text-white/60 hover:bg-white/12"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ═══════ BODY ═══════ */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4">
        <AnimatePresence mode="wait">

          {/* ═══════════════════ SAVINGS TAB ═══════════════════ */}
          {mainTab === "savings" && step === "home" && (
            <motion.div key="s-home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Total savings card */}
              <div className="rounded-[20px] p-4 border border-primary/20 bg-gradient-to-br from-primary/8 to-primary/3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-primary/15">
                    <TrendingUp size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Saved</p>
                    <p className="text-[24px] font-black text-foreground leading-tight">৳{totalSaved.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Auto-save badge */}
              {autoSaves.filter(a => a.is_active).length > 0 && (
                <button onClick={() => setStep("autosave")} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/8 border border-primary/20 text-primary text-[12px] font-semibold">
                  <CalendarClock size={14} />
                  {autoSaves.filter(a => a.is_active).length} active auto-save schedule(s)
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                </button>
              )}

              {/* Investment overview cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setMainTab("gold")} className="text-left p-3.5 rounded-[18px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <Coins size={16} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gold</p>
                  <p className="text-[16px] font-black text-foreground">{goldHolding.grams > 0 ? `${goldHolding.grams}g` : "—"}</p>
                  {goldHolding.grams > 0 && (
                    <p className={`text-[10px] font-bold flex items-center gap-0.5 ${goldProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {goldProfit >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {goldProfit >= 0 ? "+" : ""}৳{goldProfit.toLocaleString()}
                    </p>
                  )}
                </button>
                <button onClick={() => setMainTab("stocks")} className="text-left p-3.5 rounded-[18px] border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 space-y-1.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <LineChart size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stocks</p>
                  <p className="text-[16px] font-black text-foreground">{stockHoldings.length > 0 ? `${stockHoldings.length} held` : "—"}</p>
                  {totalStockProfit !== 0 && (
                    <p className={`text-[10px] font-bold flex items-center gap-0.5 ${totalStockProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {totalStockProfit >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {totalStockProfit >= 0 ? "+" : ""}৳{Math.round(totalStockProfit).toLocaleString()}
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
                            <button onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500"
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                        </div>
                        <p className="text-[11px] font-bold text-primary">{pct.toFixed(0)}% complete</p>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* SAVINGS: ADD MONEY */}
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
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={processing}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                {processing ? "Processing…" : "Save Now"}
              </motion.button>
            </motion.div>
          )}

          {/* SAVINGS: CREATE GOAL */}
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

          {/* SAVINGS: AUTO-SAVE */}
          {mainTab === "savings" && step === "autosave" && (
            <motion.div key="s-auto" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <p className="text-[13px] font-bold text-foreground">New Auto-Save Schedule</p>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Frequency</p>
                  <Select value={autoFreq} onValueChange={setAutoFreq}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount</p>
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
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Duration</p>
                  <Select value={autoDuration} onValueChange={setAutoDuration}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATION_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Ends on: {new Date(calcEndsAt(autoDuration)).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Link to Goal</p>
                  <Select value={autoGoalId} onValueChange={setAutoGoalId}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="general">General Savings</SelectItem>{goals.filter(g => g.status === "active").map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreateAutoSave} disabled={processing}
                  className="w-full h-12 rounded-2xl text-white font-bold text-[14px] shadow-lg disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, hsl(162 72% 32%), hsl(178 62% 22%))" }}>
                  {processing ? "Creating…" : "Create Schedule"}
                </motion.button>
              </div>
              {autoSaves.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Active Schedules</p>
                  {autoSaves.map(schedule => {
                    const linkedGoal = goals.find(g => g.id === schedule.goal_id);
                    const durationLabel = DURATION_OPTIONS.find(d => d.value === schedule.duration)?.label;
                    return (
                      <div key={schedule.id} className={`bg-card rounded-[16px] border p-3.5 flex items-center gap-3 ${schedule.settled ? "border-primary/40 bg-primary/5" : "border-border/60"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-semibold text-foreground">৳{Number(schedule.amount).toLocaleString()} / {schedule.frequency}</p>
                            {schedule.settled && <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[9px] font-bold uppercase">Completed</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{linkedGoal ? `${linkedGoal.emoji} ${linkedGoal.name}` : "General Savings"}{durationLabel && ` • ${durationLabel}`}</p>
                          {schedule.ends_at && !schedule.settled && <p className="text-[10px] text-muted-foreground mt-0.5"><Clock size={10} className="inline mr-0.5 -mt-0.5" />{remainingTime(schedule.ends_at)}</p>}
                        </div>
                        {!schedule.settled && <Switch checked={schedule.is_active} onCheckedChange={() => toggleAutoSave(schedule.id, schedule.is_active)} />}
                        <button onClick={() => deleteAutoSave(schedule.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════ GOLD TAB ═══════════════════ */}
          {mainTab === "gold" && goldStep === "portfolio" && (
            <motion.div key="g-port" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Sharia badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <ShieldCheck size={14} className="text-amber-600 dark:text-amber-400" />
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Sharia Compliant • Physical Gold Backed</p>
              </div>

              {/* Gold portfolio */}
              <div className="rounded-[20px] p-5 border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                    <Coins size={22} className="text-white" />
                  </div>
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
                        {goldProfit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        ৳{Math.abs(goldProfit).toLocaleString()}
                      </p>
                      <p className={`text-[10px] font-bold ${goldProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        ({goldProfitPct >= 0 ? "+" : ""}{goldProfitPct.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Live price */}
              <div className="bg-card rounded-[18px] border border-border/60 shadow-[var(--shadow-card)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-bold text-foreground">Live Gold Price</p>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </div>
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

              {/* Buy/Sell buttons */}
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

              {/* Benefits */}
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

          {/* GOLD: BUY / SELL */}
          {mainTab === "gold" && (goldStep === "buy" || goldStep === "sell") && (
            <motion.div key={`g-${goldStep}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${goldStep === "buy" ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                    {goldStep === "buy" ? <ArrowDownRight size={18} className="text-emerald-600" /> : <ArrowUpRight size={18} className="text-amber-600" />}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-foreground">{goldStep === "buy" ? "Buy Gold" : "Sell Gold"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {goldStep === "sell" ? `Available: ${goldHolding.grams}g` : `Wallet: ৳${balance.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                {/* Karat select */}
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

                {/* Grams input */}
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

                {/* Cost preview */}
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

              <motion.button whileTap={{ scale: 0.96 }}
                onClick={goldStep === "buy" ? handleBuyGold : handleSellGold} disabled={processing}
                className={`w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-60 ${goldStep === "buy" ? "bg-gradient-to-r from-amber-500 to-amber-600" : "bg-gradient-to-r from-amber-600 to-amber-700"}`}>
                {processing ? <RefreshCw size={18} className="animate-spin mx-auto" /> : goldStep === "buy" ? "Confirm Purchase" : "Confirm Sale"}
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════ STOCKS TAB ═══════════════════ */}
          {mainTab === "stocks" && stockStep === "market" && (
            <motion.div key="st-market" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Sharia badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">Sharia Screened Stocks • Halal Trading</p>
              </div>

              {/* Portfolio summary */}
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

              {/* Market list */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">DSE Market — Top Halal Stocks</p>
                {MOCK_STOCKS.map((stock, i) => {
                  const holding = stockHoldings.find(h => h.symbol === stock.symbol);
                  return (
                    <motion.button key={stock.symbol} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => { setSelectedStock(stock); setStockAction("buy"); setStockQty(""); setStockStep("trade"); setError(""); }}
                      className="w-full bg-card rounded-[16px] border border-border/60 shadow-[var(--shadow-xs)] p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[12px] font-black text-blue-600 dark:text-blue-400">
                        {stock.symbol.slice(0, 2)}
                      </div>
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
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[12px] font-black text-blue-600 dark:text-blue-400">
                          {h.symbol.slice(0, 2)}
                        </div>
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
              {/* Stock header */}
              <div className="bg-card rounded-[20px] border border-border/60 shadow-[var(--shadow-card)] p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-[14px] font-black text-blue-600 dark:text-blue-400">
                    {selectedStock.symbol.slice(0, 2)}
                  </div>
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

                {/* Buy/Sell toggle */}
                <div className="flex gap-2 bg-muted rounded-xl p-1">
                  <button onClick={() => setStockAction("buy")}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${stockAction === "buy" ? "bg-emerald-500 text-white shadow-md" : "text-muted-foreground"}`}>
                    Buy
                  </button>
                  <button onClick={() => setStockAction("sell")}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${stockAction === "sell" ? "bg-destructive text-white shadow-md" : "text-muted-foreground"}`}>
                    Sell
                  </button>
                </div>

                {/* Quantity */}
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

                {/* Order summary */}
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

              <motion.button whileTap={{ scale: 0.96 }}
                onClick={stockAction === "buy" ? handleBuyStock : handleSellStock} disabled={processing}
                className={`w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-60 ${stockAction === "buy" ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-gradient-to-r from-red-500 to-red-600"}`}>
                {processing ? <RefreshCw size={18} className="animate-spin mx-auto" /> : stockAction === "buy" ? "Place Buy Order" : "Place Sell Order"}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const SavingsFlowGuarded = (props: SavingsFlowProps) => (
  <FeatureGuard featureKey="savings" onClose={props.onClose}>
    <SavingsFlow {...props} />
  </FeatureGuard>
);

export default SavingsFlowGuarded;
