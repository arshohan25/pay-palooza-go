import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, TrendingUp, CheckCircle2, ChevronRight, Trash2, Clock, CalendarClock, Power } from "lucide-react";
import { toast } from "sonner";
import { getBalance, onBalanceChange, fetchBalance } from "@/lib/balanceStore";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  target_amount: number;
  saved_amount: number;
  status: string;
}

interface AutoSaveSchedule {
  id: string;
  goal_id: string | null;
  frequency: string;
  amount: number;
  is_active: boolean;
  next_run_at: string;
  duration: string | null;
  ends_at: string | null;
  settled: boolean;
}

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

interface SavingsFlowProps { onClose: () => void; }

const SavingsFlow = ({ onClose }: SavingsFlowProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [step, setStep] = useState<"home" | "add" | "create" | "autosave">("home");
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(getBalance);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create goal state
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🎯");
  const [newTarget, setNewTarget] = useState("");

  // Auto-save state
  const [autoSaves, setAutoSaves] = useState<AutoSaveSchedule[]>([]);
  const [autoFreq, setAutoFreq] = useState("monthly");
  const [autoAmount, setAutoAmount] = useState("");
  const [autoGoalId, setAutoGoalId] = useState<string>("general");
  const [autoCustom, setAutoCustom] = useState(false);

  useEffect(() => {
    const unsub = onBalanceChange(setBalance);
    return () => { unsub(); };
  }, []);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setGoals((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  const loadAutoSaves = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("savings_auto_save")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setAutoSaves((data as any[]) ?? []);
  }, [user]);

  useEffect(() => {
    loadGoals();
    loadAutoSaves();
  }, [loadGoals, loadAutoSaves]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("savings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_goals", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_deposits", filter: `user_id=eq.${user.id}` }, () => loadGoals())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadGoals]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > balance) { setError("Insufficient balance"); return; }
    if (!selectedGoal) { setError("Select a savings goal"); return; }

    setProcessing(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("savings_deposit", {
        p_goal_id: selectedGoal.id,
        p_amount: amt,
        p_source: "manual",
      });
      if (rpcError) throw rpcError;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      
      await fetchBalance();

      if (result.goal_completed) {
        fireSuccessConfetti();
        toast.success(`🎉 "${selectedGoal.name}" goal completed!`);
      } else {
        toast.success(`৳${amt.toLocaleString()} saved to "${selectedGoal.name}"`);
      }
      setStep("home");
      setAmount("");
      setSelectedGoal(null);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateGoal = async () => {
    if (!newName.trim()) { setError("Enter a goal name"); return; }
    const target = parseFloat(newTarget);
    if (!target || target <= 0) { setError("Enter a valid target amount"); return; }
    if (!user) return;

    setProcessing(true);
    setError("");
    try {
      const { error: insertErr } = await supabase.from("savings_goals").insert({
        user_id: user.id,
        name: newName.trim(),
        emoji: newEmoji,
        target_amount: target,
      } as any);
      if (insertErr) throw insertErr;
      toast.success(`Goal "${newName}" created!`);
      setStep("home");
      setNewName("");
      setNewEmoji("🎯");
      setNewTarget("");
      loadGoals();
    } catch (err: any) {
      setError(err.message || "Failed to create goal");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    const { error } = await supabase.from("savings_goals").delete().eq("id", goalId);
    if (error) { toast.error("Failed to delete goal"); return; }
    toast.success("Goal deleted");
    loadGoals();
  };

  const handleCreateAutoSave = async () => {
    const amt = autoCustom ? parseFloat(autoAmount) : parseFloat(autoAmount);
    if (!amt || amt <= 0) { setError("Select or enter an amount"); return; }
    if (!user) return;

    setProcessing(true);
    setError("");
    try {
      const nextRun = new Date();
      if (autoFreq === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (autoFreq === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setMonth(nextRun.getMonth() + 1);

      const { error: insertErr } = await supabase.from("savings_auto_save").insert({
        user_id: user.id,
        goal_id: autoGoalId === "general" ? null : autoGoalId,
        frequency: autoFreq,
        amount: amt,
        next_run_at: nextRun.toISOString(),
      } as any);
      if (insertErr) throw insertErr;
      toast.success("Auto-save schedule created!");
      setAutoAmount("");
      setAutoCustom(false);
      loadAutoSaves();
    } catch (err: any) {
      setError(err.message || "Failed to create schedule");
    } finally {
      setProcessing(false);
    }
  };

  const toggleAutoSave = async (id: string, current: boolean) => {
    await supabase.from("savings_auto_save").update({ is_active: !current } as any).eq("id", id);
    loadAutoSaves();
  };

  const deleteAutoSave = async (id: string) => {
    await supabase.from("savings_auto_save").delete().eq("id", id);
    loadAutoSaves();
    toast.success("Schedule removed");
  };

  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        className="px-4 pt-3 pb-3 text-primary-foreground"
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{ background: "linear-gradient(135deg,#009688,#00695C)" }}
      >
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-3">
          <motion.div className="h-full rounded-full bg-white/60" initial={{ width: 0 }}
            animate={{ width: step === "home" ? "25%" : step === "add" ? "50%" : step === "create" ? "75%" : "100%" }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => {
              if (step === "home") onClose();
              else setStep("home");
              setError("");
            }}
            className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors shrink-0"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold leading-tight">
              {step === "home" ? t("mySavings") : step === "add" ? t("addToGoal") : step === "create" ? "Create Goal" : "Auto-Save"}
            </p>
            <p className="text-[11px] opacity-60">
              {step === "home" ? t("trackGrowMoney") : `Wallet: ৳${balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`}
            </p>
          </div>
          {step === "home" && (
            <div className="flex gap-1.5">
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setStep("autosave")}
                className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors shrink-0">
                <CalendarClock size={16} strokeWidth={2.5} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setStep("create")}
                className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors shrink-0">
                <Plus size={18} strokeWidth={2.5} />
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32 space-y-4">
        <AnimatePresence mode="wait">
          {/* HOME */}
          {step === "home" && (
            <motion.div key="home" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {/* Total savings pill */}
              <div className="rounded-3xl p-4" style={{ background: "rgba(0,150,136,0.1)", outline: "1px solid rgba(0,150,136,0.2)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,150,136,0.2)" }}>
                    <TrendingUp size={18} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">{t("totalSaved")}</p>
                    <p className="text-[22px] font-bold text-foreground leading-tight">৳{totalSaved.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Auto-save badge */}
              {autoSaves.filter(a => a.is_active).length > 0 && (
                <button onClick={() => setStep("autosave")} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 text-[12px] font-semibold">
                  <CalendarClock size={14} />
                  {autoSaves.filter(a => a.is_active).length} active auto-save schedule(s)
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                </button>
              )}

              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : goals.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-4xl">🎯</p>
                  <p className="text-sm text-muted-foreground">No savings goals yet</p>
                  <button onClick={() => setStep("create")} className="text-sm font-semibold text-teal-600 dark:text-teal-400">Create your first goal →</button>
                </div>
              ) : (
                goals.map((goal, i) => {
                  const pct = goal.target_amount > 0 ? Math.min(100, (Number(goal.saved_amount) / Number(goal.target_amount)) * 100) : 0;
                  return (
                    <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="w-full text-left bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <button onClick={() => { setSelectedGoal(goal); setStep("add"); }} className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="text-2xl">{goal.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-foreground truncate">{goal.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              ৳{Number(goal.saved_amount).toLocaleString()} / ৳{Number(goal.target_amount).toLocaleString()}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-1">
                          {goal.status === "completed" ? (
                            <CheckCircle2 size={20} className="text-teal-500 shrink-0" />
                          ) : (
                            <button onClick={() => { setSelectedGoal(goal); setStep("add"); }}>
                              <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#009688,#4CAF50)" }}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                        />
                      </div>
                      <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">{pct.toFixed(0)}% complete</p>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ADD TO GOAL */}
          {step === "add" && (
            <motion.div key="add" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Select Goal</p>
                {goals.filter(g => g.status === "active").map((goal) => (
                  <motion.button key={goal.id} whileTap={{ scale: 0.98 }} onClick={() => setSelectedGoal(goal)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                      selectedGoal?.id === goal.id ? "border-teal-500/60 bg-teal-500/10" : "border-border/60 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-2xl">{goal.emoji}</span>
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-semibold text-foreground">{goal.name}</p>
                      <p className="text-[11px] text-muted-foreground">৳{(Number(goal.target_amount) - Number(goal.saved_amount)).toLocaleString()} remaining</p>
                    </div>
                    {selectedGoal?.id === goal.id && <CheckCircle2 size={16} className="text-teal-500 shrink-0" />}
                  </motion.button>
                ))}
              </div>

              <div className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">৳</span>
                  <input type="number" inputMode="decimal" placeholder="0.00" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 text-[22px] font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_AMOUNTS.map((q) => (
                    <button key={q} onClick={() => setAmount(String(q))}
                      className={`flex-1 min-w-[60px] py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                        amount === String(q) ? "bg-teal-500/20 text-teal-700 dark:text-teal-300" : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      ৳{q >= 1000 ? `${q / 1000}k` : q}
                    </button>
                  ))}
                </div>
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
              </div>

              <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={processing}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#009688,#00695C)" }}
              >
                {processing ? "Processing…" : "Save Now"}
              </motion.button>
            </motion.div>
          )}

          {/* CREATE GOAL */}
          {step === "create" && (
            <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <div className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pick an Emoji</p>
                  <div className="flex gap-2 flex-wrap">
                    {EMOJI_LIST.map(e => (
                      <button key={e} onClick={() => setNewEmoji(e)}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                          newEmoji === e ? "bg-teal-500/20 ring-2 ring-teal-500/40 scale-110" : "bg-muted hover:bg-muted/70"
                        }`}
                      >{e}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Goal Name</p>
                  <input placeholder="e.g. New Phone, Vacation" value={newName} onChange={e => { setNewName(e.target.value); setError(""); }}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-[14px] font-medium outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Target Amount</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-bold text-muted-foreground">৳</span>
                    <input type="number" inputMode="decimal" placeholder="0" value={newTarget}
                      onChange={e => { setNewTarget(e.target.value); setError(""); }}
                      className="w-full pl-10 pr-4 py-3 text-[18px] font-bold bg-muted rounded-xl outline-none text-foreground placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
              </div>

              <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreateGoal} disabled={processing}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#009688,#00695C)" }}
              >
                {processing ? "Creating…" : "Create Goal"}
              </motion.button>
            </motion.div>
          )}

          {/* AUTO-SAVE */}
          {step === "autosave" && (
            <motion.div key="autosave" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              {/* Create new schedule */}
              <div className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-4">
                <p className="text-[13px] font-bold text-foreground">New Auto-Save Schedule</p>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Frequency</p>
                  <Select value={autoFreq} onValueChange={setAutoFreq}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount</p>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_AMOUNTS.map(q => (
                      <button key={q} onClick={() => { setAutoAmount(String(q)); setAutoCustom(false); }}
                        className={`flex-1 min-w-[55px] py-2 rounded-xl text-[12px] font-semibold transition-colors ${
                          !autoCustom && autoAmount === String(q) ? "bg-teal-500/20 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/30" : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >৳{q >= 1000 ? `${q / 1000}k` : q}</button>
                    ))}
                    <button onClick={() => { setAutoCustom(true); setAutoAmount(""); }}
                      className={`flex-1 min-w-[55px] py-2 rounded-xl text-[12px] font-semibold transition-colors ${
                        autoCustom ? "bg-teal-500/20 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/30" : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >Custom</button>
                  </div>
                  {autoCustom && (
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-bold text-muted-foreground">৳</span>
                      <input type="number" inputMode="decimal" placeholder="Enter amount" value={autoAmount}
                        onChange={e => setAutoAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-[16px] font-bold bg-muted rounded-xl outline-none text-foreground placeholder:text-muted-foreground/40"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Link to Goal</p>
                  <Select value={autoGoalId} onValueChange={setAutoGoalId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Savings</SelectItem>
                      {goals.filter(g => g.status === "active").map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}

                <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreateAutoSave} disabled={processing}
                  className="w-full h-12 rounded-2xl text-white font-bold text-[14px] shadow-lg disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#009688,#00695C)" }}
                >
                  {processing ? "Creating…" : "Create Schedule"}
                </motion.button>
              </div>

              {/* Existing schedules */}
              {autoSaves.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">Active Schedules</p>
                  {autoSaves.map(schedule => {
                    const linkedGoal = goals.find(g => g.id === schedule.goal_id);
                    return (
                      <div key={schedule.id} className="bg-card rounded-2xl border border-border/60 p-3.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground">
                            ৳{Number(schedule.amount).toLocaleString()} / {schedule.frequency}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {linkedGoal ? `${linkedGoal.emoji} ${linkedGoal.name}` : "General Savings"}
                            {schedule.next_run_at && ` • Next: ${new Date(schedule.next_run_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Switch checked={schedule.is_active} onCheckedChange={() => toggleAutoSave(schedule.id, schedule.is_active)} />
                        <button onClick={() => deleteAutoSave(schedule.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SavingsFlow;
