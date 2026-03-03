import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, TrendingUp, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getBalance, onBalanceChange } from "@/lib/balanceStore";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";

interface SavingsGoal {
  id: string;
  nameKey: string;
  target: number;
  saved: number;
  emoji: string;
}

const DEFAULT_GOALS: SavingsGoal[] = [
  { id: "g1", nameKey: "emergencyFund", target: 50000, saved: 18500, emoji: "🛡️" },
  { id: "g2", nameKey: "newPhone",      target: 30000, saved: 12000, emoji: "📱" },
  { id: "g3", nameKey: "vacation",       target: 80000, saved: 5000,  emoji: "✈️" },
];

interface SavingsFlowProps { onClose: () => void; }

const SavingsFlow = ({ onClose }: SavingsFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]         = useState<"home" | "add">("home");
  const [goals, setGoals]       = useState<SavingsGoal[]>(DEFAULT_GOALS);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [amount, setAmount]     = useState("");
  const [balance, setBalance]   = useState(getBalance);
  const [error, setError]       = useState("");

  useEffect(() => {
    const unsub = onBalanceChange(setBalance);
    return () => { unsub(); };
  }, []);

  const goalName = (g: SavingsGoal) => t(g.nameKey as any);

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError(t("enterValidAmountSavings")); return; }
    if (amt > balance)    { setError(t("insufficientBalance")); return; }
    if (!selectedGoal)    { setError(t("selectSavingsGoal")); return; }

    // Savings is local-only (Coming Soon for real deductions)
    let goalCompleted = false;
    setGoals(prev =>
      prev.map(g => {
        if (g.id === selectedGoal.id) {
          const newSaved = Math.min(g.saved + amt, g.target);
          if (newSaved >= g.target) goalCompleted = true;
          return { ...g, saved: newSaved };
        }
        return g;
      })
    );

    if (goalCompleted) {
      fireSuccessConfetti();
      toast.success(`🎉 "${goalName(selectedGoal)}" ${t("goalCompleted")}`);
    } else {
      toast.success(`৳${amt.toLocaleString()} ${t("savedToGoal")} "${goalName(selectedGoal)}"`);
    }
    toast.info("Savings feature coming soon — no balance deducted", { duration: 4000 });
    setStep("home");
    setAmount("");
    setSelectedGoal(null);
    setError("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
    >
      {/* Header */}
      <motion.div
        className="bg-gradient-to-br from-teal-500 to-teal-700 px-4 pt-3 pb-3 text-primary-foreground"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{ background: "linear-gradient(135deg,#009688,#00695C)" }}
      >
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-3">
          <motion.div
            className="h-full rounded-full bg-white/60"
            initial={{ width: 0 }}
            animate={{ width: step === "home" ? "50%" : "100%" }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => step === "add" ? setStep("home") : onClose()}
            className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target shrink-0"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold leading-tight">
              {step === "home" ? t("mySavings") : t("addToGoal")}
            </p>
            <p className="text-[11px] opacity-60">
              {step === "home" ? t("trackGrowMoney") : `${t("wallet")}: ৳${balance.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          {step === "home" && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setStep("add")}
              className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target shrink-0"
            >
              <Plus size={18} strokeWidth={2.5} />
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32 space-y-4">
        <AnimatePresence mode="wait">
          {step === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-4"
            >
              {/* Total savings pill */}
              <div className="rounded-3xl p-4" style={{ background: "rgba(0,150,136,0.1)", outline: "1px solid rgba(0,150,136,0.2)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,150,136,0.2)" }}>
                    <TrendingUp size={18} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">{t("totalSaved")}</p>
                    <p className="text-[22px] font-bold text-foreground leading-tight">
                      ৳{goals.reduce((s, g) => s + g.saved, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Goal cards */}
              {goals.map((goal, i) => {
                const pct = Math.min(100, (goal.saved / goal.target) * 100);
                return (
                  <motion.button
                    key={goal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, ease: [0.23, 1, 0.32, 1] }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedGoal(goal); setStep("add"); }}
                    className="w-full text-left bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{goal.emoji}</span>
                        <div>
                          <p className="text-[14px] font-bold text-foreground">{goalName(goal)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            ৳{goal.saved.toLocaleString()} / ৳{goal.target.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {pct >= 100
                        ? <CheckCircle2 size={20} className="text-teal-500 shrink-0" />
                        : <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
                      }
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg,#009688,#4CAF50)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">{pct.toFixed(0)}% {t("pctComplete")}</p>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {step === "add" && (
            <motion.div
              key="add"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-4"
            >
              {/* Select goal */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1">{t("selectGoal")}</p>
                {goals.map((goal) => (
                  <motion.button
                    key={goal.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedGoal(goal)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                      selectedGoal?.id === goal.id
                        ? "border-teal-500/60 bg-teal-500/10"
                        : "border-border/60 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-2xl">{goal.emoji}</span>
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-semibold text-foreground">{goalName(goal)}</p>
                      <p className="text-[11px] text-muted-foreground">৳{(goal.target - goal.saved).toLocaleString()} {t("remaining")}</p>
                    </div>
                    {selectedGoal?.id === goal.id && (
                      <CheckCircle2 size={16} className="text-teal-500 shrink-0" />
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Amount input */}
              <div className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("amountToSave")}</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">৳</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(""); }}
                    className="w-full pl-10 pr-4 py-3 text-[22px] font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                {/* Quick amounts */}
                <div className="flex gap-2">
                  {[500, 1000, 2000, 5000].map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(String(q))}
                      className="flex-1 py-1.5 rounded-xl bg-muted text-[11px] font-semibold text-muted-foreground hover:bg-muted/70 transition-colors"
                    >
                      ৳{q >= 1000 ? `${q / 1000}k` : q}
                    </button>
                  ))}
                </div>
                {error && <p className="text-[12px] text-destructive font-medium">{error}</p>}
              </div>

              {/* Save button */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleSave}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg"
                style={{ background: "linear-gradient(135deg,#009688,#00695C)" }}
              >
                {t("saveNow")}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SavingsFlow;
