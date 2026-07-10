import Seo from "@/components/Seo";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Target, Plus, Calendar, TrendingUp, Coins, LineChart,
  AlertCircle, CheckCircle2, Loader2, Lock, RefreshCw, ChevronRight, Info,
  Wallet, Sparkles, X, Pause, Play, History, CalendarClock, XCircle, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchBalance, onBalanceChange, getBalance } from "@/lib/balanceStore";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { useSavings } from "@/hooks/use-savings";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useStockPrices } from "@/hooks/use-stock-prices";
import { verifyPin } from "@/lib/verifyPin";
import { haptics } from "@/lib/haptics";
import SlideToConfirm from "@/components/SlideToConfirm";
import {
  STRATEGY_RETURNS, type Strategy, type Frequency,
  getEstReturn, calcDpsEstimate, goalLockDaysLeft, dpsLockDaysLeft,
} from "@/lib/savingsReturns";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type Tab = "goals" | "dps" | "gold" | "stocks";

const EMOJIS = ["🎯","🏠","🚗","✈️","🎓","💍","📱","🎁","💼","🕌"];
const FREQS: { value: Frequency; labelKey: TranslationKey }[] = [
  { value: "daily", labelKey: "savDailyLabel" },
  { value: "weekly", labelKey: "savWeeklyLabel" },
  { value: "monthly", labelKey: "savMonthlyLabel" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PIN entry — shared
// ─────────────────────────────────────────────────────────────────────────────
function PinDots({ pin, error }: { pin: string; error?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-3">
        {[0,1,2,3].map(i => (
          <motion.div key={i}
            animate={{ scale: pin.length > i ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={`w-4 h-4 rounded-full border-2 ${pin.length > i ? "bg-primary border-transparent" : "border-muted-foreground/40"}`} />
        ))}
      </div>
      {error && <p className="text-xs text-destructive flex items-center justify-center gap-1"><AlertCircle size={12}/>{error}</p>}
    </div>
  );
}

function PinPad({ pin, setPin, error }: { pin: string; setPin: (v: string) => void; error?: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <PinDots pin={pin} error={error} />
      <input
        type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
        value={pin} autoFocus
        onChange={e => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          if (v.length > pin.length) haptics.light();
          setPin(v);
        }}
        className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-[19px] focus:outline-none focus:border-primary"
        placeholder="••••" />
      <p className="text-center text-xs text-muted-foreground">{t("savEnterPin")}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm sheet (PIN + slide + optional terms)
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  summary: React.ReactNode;
  warning?: string;
  requireTerms?: boolean;
  termsText?: string;
  onConfirm: () => Promise<void>;
  gradient?: string;
}
function ConfirmSheet({ open, onClose, title, summary, warning, requireTerms, termsText, onConfirm, gradient = "gradient-primary" }: ConfirmSheetProps) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [terms, setTerms] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) { setPin(""); setPinError(""); setTerms(false); setProcessing(false); }
  }, [open]);

  const handleSlide = async () => {
    if (pin.length < 4) { setPinError(t("savEnterPinRequired")); return; }
    if (requireTerms && !terms) { toast.error(t("savAcceptTerms")); return; }
    setProcessing(true);
    const valid = await verifyPin(pin);
    if (!valid) { setPinError(t("savIncorrectPin")); setPin(""); setProcessing(false); haptics.error(); return; }
    try {
      await onConfirm();
      haptics.success();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? t("savOperationFailed"));
      setProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !processing && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[19px] max-h-[90vh] overflow-hidden p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-5 space-y-5">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="bg-muted/40 rounded-[19px] p-4 text-sm space-y-2">{summary}</div>
            {warning && (
              <div className="flex gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-[14px] p-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            )}
            {requireTerms && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5" />
                <span>{termsText ?? t("savIslamicTerms")}</span>
              </label>
            )}
            <PinPad pin={pin} setPin={(v) => { setPin(v); setPinError(""); }} error={pinError} />
            <SlideToConfirm
              onConfirm={handleSlide}
              disabled={pin.length < 4 || processing || (!!requireTerms && !terms)}
              pinComplete={pin.length === 4}
              gradient={gradient}
              label={processing ? t("savProcessing") : t("savSlideToConfirm")}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goals tab
// ─────────────────────────────────────────────────────────────────────────────
function GoalsTab() {
  const { t } = useI18n();
  const { goals, plans, reload } = useSavings();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [target, setTarget] = useState("");
  const [openingDeposit, setOpeningDeposit] = useState("");
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [depositGoal, setDepositGoal] = useState<typeof goals[number] | null>(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [cancelGoal, setCancelGoal] = useState<typeof goals[number] | null>(null);
  const [withdrawGoal, setWithdrawGoal] = useState<typeof goals[number] | null>(null);

  const activeGoals = goals.filter(g => g.status === "active" || g.status === "completed");

  const handleCreate = async () => {
    const tg = parseFloat(target);
    const od = parseFloat(openingDeposit || "0");
    if (!name.trim() || !(tg > 0)) throw new Error(t("savEnterValidName"));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error(t("savNotSignedIn"));
    const { data: goal, error } = await supabase.from("savings_goals")
      .insert({ user_id: user.id, name: name.trim(), emoji, target_amount: tg, saved_amount: 0 })
      .select().single();
    if (error) throw error;
    if (od > 0) {
      const { error: depErr } = await supabase.rpc("savings_deposit", { p_goal_id: goal.id, p_amount: od, p_source: "manual" });
      if (depErr) throw depErr;
    }
    toast.success(t("savGoalCreated"));
    setName(""); setTarget(""); setOpeningDeposit(""); setEmoji(EMOJIS[0]); setCreateOpen(false);
    reload();
  };

  const handleDeposit = async () => {
    if (!depositGoal) return;
    const amt = parseFloat(depositAmt);
    if (!(amt > 0)) throw new Error(t("savEnterAmount"));
    const { error } = await supabase.rpc("savings_deposit", { p_goal_id: depositGoal.id, p_amount: amt, p_source: "manual" });
    if (error) throw error;
    toast.success(`৳${amt.toLocaleString()} ${t("savDeposited")}`);
    setDepositAmt(""); reload();
  };

  const handleCancel = async () => {
    if (!cancelGoal) return;
    const { error } = await supabase.rpc("cancel_goal", { p_goal_id: cancelGoal.id });
    if (error) throw error;
    toast.success(t("savGoalCancelled"));
    reload();
  };

  const handleWithdraw = async () => {
    if (!withdrawGoal) return;
    const { error } = await supabase.rpc("withdraw_completed_goal", { p_goal_id: withdrawGoal.id });
    if (error) throw error;
    toast.success(t("savWithdrawnToWallet"));
    reload();
  };

  const goalHasDps = (goalId: string) => plans.some(p => p.goal_id === goalId);

  return (
    <div className="space-y-3">
      <button onClick={() => setCreateOpen(true)}
        className="group w-full h-14 rounded-[18px] bg-gradient-to-r from-primary to-emerald-600 text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.6)] active:scale-[0.99] transition-transform">
        <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><Plus className="w-4 h-4"/></span>
        {t("savCreateNewGoal")}
      </button>

      {activeGoals.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground rounded-[19px] bg-muted/40 border border-dashed border-border">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t("savNoGoalsYet")}
        </div>
      )}

      {activeGoals.map(g => {
        const pct = Math.min(100, (Number(g.saved_amount) / Math.max(1, Number(g.target_amount))) * 100);
        const lockDays = goalLockDaysLeft(g.created_at);
        const dpsLink = goalHasDps(g.id);
        const dpsDays = dpsLink ? dpsLockDaysLeft(plans.find(p => p.goal_id === g.id)!.created_at) : 0;
        const totalLock = Math.max(lockDays, dpsDays);
        const isDone = g.status === "completed";
        return (
          <motion.div key={g.id} layout
            className="relative overflow-hidden rounded-[22px] bg-card border border-border/70 p-4 shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.08)]">
            {/* accent stripe */}
            <div className={`absolute inset-y-0 left-0 w-1 ${isDone ? "bg-emerald-500" : "bg-gradient-to-b from-primary to-emerald-600"}`} />
            <div className="pointer-events-none absolute -top-14 -right-10 w-40 h-40 rounded-full bg-primary/5 blur-2xl" />

            <div className="relative flex items-start gap-3">
              <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-primary/15 to-emerald-500/10 border border-primary/15 flex items-center justify-center text-3xl shrink-0">
                {g.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-[15px] truncate">{g.name}</h3>
                  {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {dpsLink && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase tracking-wide">DPS</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  ৳{Number(g.saved_amount).toLocaleString()} <span className="opacity-60">of</span> ৳{Number(g.target_amount).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold tabular-nums leading-none">{pct.toFixed(0)}<span className="text-sm text-muted-foreground">%</span></div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {isDone ? t("savCurrentValue") : `৳${Math.max(0, Number(g.target_amount) - Number(g.saved_amount)).toLocaleString()} left`}
                </div>
              </div>
            </div>

            {/* Custom progress */}
            <div className="relative mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
                className={`h-full rounded-full ${isDone ? "bg-emerald-500" : "bg-gradient-to-r from-primary to-emerald-400"}`} />
            </div>

            <div className="relative mt-3 flex items-center gap-2">
              {g.status === "active" && (
                <Button size="sm" className="rounded-full h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => { setDepositGoal(g); setDepositAmt(""); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{t("savDeposit")}
                </Button>
              )}
              {isDone && (
                <Button size="sm" className="rounded-full h-9 px-4 bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => setWithdrawGoal(g)}>
                  {t("savWithdraw")} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
              {g.status === "active" && (
                totalLock > 0 ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                    <Lock className="w-3 h-3" />{totalLock}d lock
                  </span>
                ) : (
                  <button
                    onClick={() => setCancelGoal(g)}
                    className="ml-auto text-[11px] text-destructive/80 hover:text-destructive font-medium">
                    {t("savCancel")}
                  </button>
                )
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Create goal sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="rounded-t-[19px]">
          <SheetHeader><SheetTitle>{t("savNewSavingsGoal")}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-2xl w-12 h-12 rounded-full shrink-0 ${emoji === e ? "bg-primary/15 ring-2 ring-primary" : "bg-muted"}`}>{e}</button>
              ))}
            </div>
            <Input placeholder={t("savGoalNamePlaceholder")} value={name} onChange={e => setName(e.target.value)} maxLength={40} className="rounded-[14px]" />
            <Input type="number" inputMode="numeric" placeholder={t("savTargetAmount")} value={target} onChange={e => setTarget(e.target.value)} className="rounded-[14px]" />
            <Input type="number" inputMode="numeric" placeholder={t("savOpeningDeposit")} value={openingDeposit} onChange={e => setOpeningDeposit(e.target.value)} className="rounded-[14px]" />
            <Button className="w-full rounded-[14px]"
              disabled={!name.trim() || !(parseFloat(target) > 0)}
              onClick={() => { setCreateOpen(false); setConfirmCreate(true); }}>
              {t("savContinue")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmSheet open={confirmCreate} onClose={() => setConfirmCreate(false)}
        title={t("savConfirmNewGoal")}
        summary={
          <>
            <div className="flex justify-between"><span>{emoji} {name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savTarget")}</span><span>৳{parseFloat(target || "0").toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savOpeningDepositShort")}</span><span>৳{parseFloat(openingDeposit || "0").toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savLockIn")}</span><span>60 {t("savDays")}</span></div>
          </>
        }
        requireTerms onConfirm={handleCreate} />

      <ConfirmSheet open={!!depositGoal} onClose={() => setDepositGoal(null)}
        title={`${t("savDepositTo")} ${depositGoal?.name ?? ""}`}
        summary={
          <div className="space-y-3">
            <Input type="number" inputMode="numeric" placeholder={t("savAmountField")} value={depositAmt}
              onChange={e => setDepositAmt(e.target.value)} className="rounded-[14px]" />
          </div>
        }
        onConfirm={handleDeposit} />

      <ConfirmSheet open={!!cancelGoal} onClose={() => setCancelGoal(null)}
        title={t("savCancelGoal")}
        warning={t("savCancelWarning")}
        summary={
          <>
            <div className="flex justify-between"><span>{cancelGoal?.emoji} {cancelGoal?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savRefund")}</span><span>৳{Number(cancelGoal?.saved_amount ?? 0).toLocaleString()}</span></div>
          </>
        }
        onConfirm={handleCancel} />

      <ConfirmSheet open={!!withdrawGoal} onClose={() => setWithdrawGoal(null)}
        title={t("savWithdrawCompleted")}
        summary={
          <>
            <div className="flex justify-between"><span>{withdrawGoal?.emoji} {withdrawGoal?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savWithdrawToWallet")}</span><span>৳{Number(withdrawGoal?.saved_amount ?? 0).toLocaleString()}</span></div>
          </>
        }
        onConfirm={handleWithdraw} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DPS Plan Details Sheet — full history, upcoming schedule, pause/resume
// ─────────────────────────────────────────────────────────────────────────────
interface RunLogEntry {
  id: string;
  outcome: string;
  reason: string | null;
  amount: number;
  created_at: string;
  tx_reference: string | null;
  triggered_by: string | null;
}

function DpsPlanDetailsSheet({
  plan, goal, open, onClose, onChanged,
}: {
  plan: any | null;
  goal: any | undefined;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<RunLogEntry[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !plan?.id) return;
    setLoadingHist(true);
    supabase.from("dps_run_log")
      .select("id,outcome,reason,amount,created_at,tx_reference,triggered_by")
      .eq("schedule_id", plan.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { setHistory((data ?? []) as RunLogEntry[]); setLoadingHist(false); });
  }, [open, plan?.id]);

  if (!plan) return null;

  const freqLabel = plan.frequency === "daily" ? "Daily" : plan.frequency === "weekly" ? "Weekly" : "Monthly";
  const stepMs = plan.frequency === "daily" ? 86400000 : plan.frequency === "weekly" ? 7 * 86400000 : 30 * 86400000;
  const paid = Number(plan.total_paid ?? 0);
  const total = Number(plan.total_installments ?? 0);
  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? (paid / total) * 100 : 0;
  const totalDeposited = paid * Number(plan.amount);
  const totalPlanned = total * Number(plan.amount);
  const outstanding = Math.max(0, totalPlanned - totalDeposited);
  const nextRun = new Date(plan.next_run_at);
  const endsAt = plan.ends_at ? new Date(plan.ends_at) : null;
  const created = new Date(plan.created_at);
  const lastRun = plan.last_run_at ? new Date(plan.last_run_at) : null;

  // Upcoming schedule (next up to 6 or remaining)
  const upcomingCount = Math.min(6, remaining);
  const upcoming = Array.from({ length: upcomingCount }, (_, i) => {
    const d = new Date(nextRun.getTime());
    if (plan.frequency === "monthly") d.setMonth(d.getMonth() + i);
    else d.setTime(d.getTime() + i * stepMs);
    return d;
  });

  const togglePause = async () => {
    setBusy(true);
    const { error } = await supabase.from("savings_auto_save")
      .update({ is_active: !plan.is_active, updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(plan.is_active ? "Plan paused" : "Plan resumed");
    onChanged();
  };

  const outcomeBadge = (o: string) => {
    if (o === "collected") return { color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", Icon: CheckCircle2, label: "Collected" };
    if (o === "missed") return { color: "text-amber-600 bg-amber-500/10 border-amber-500/20", Icon: AlertCircle, label: "Missed" };
    if (o === "settled") return { color: "text-blue-600 bg-blue-500/10 border-blue-500/20", Icon: CheckCircle2, label: "Settled" };
    if (o === "dedup_skipped") return { color: "text-muted-foreground bg-muted border-border", Icon: CircleDot, label: "Skipped" };
    return { color: "text-muted-foreground bg-muted border-border", Icon: XCircle, label: o };
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[24px] max-h-[92vh] overflow-hidden p-0">
        <ScrollArea className="max-h-[92vh]">
          <div className="p-5 pb-8 space-y-5">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-[20px] p-5 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.85)_50%,#0b3d2e_100%)] text-primary-foreground">
              <div className="pointer-events-none absolute -top-16 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-start gap-3">
                <div className="w-14 h-14 rounded-[16px] bg-white/15 border border-white/25 flex items-center justify-center text-2xl shrink-0">
                  {goal?.emoji ?? "💼"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-primary-foreground/70">DPS Plan</div>
                  <div className="text-lg font-bold truncate leading-tight">{goal?.name ?? "—"}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20 font-semibold uppercase tracking-wide">{freqLabel}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20 font-medium">৳{Number(plan.amount).toLocaleString()}/cycle</span>
                    {plan.strategy && <span className="px-2 py-0.5 rounded-full bg-amber-300/25 border border-amber-200/40 text-amber-50 font-medium capitalize">{plan.strategy}</span>}
                    <span className={`px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide border ${plan.is_active ? "bg-emerald-400/25 border-emerald-200/40 text-emerald-50" : "bg-white/15 border-white/20 text-primary-foreground/80"}`}>
                      {plan.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Progress */}
              <div className="relative mt-4">
                <div className="flex items-baseline justify-between text-sm">
                  <div className="text-primary-foreground/80">Progress</div>
                  <div className="tabular-nums font-semibold">{paid}<span className="opacity-70">/{total || "∞"}</span> · {pct.toFixed(0)}%</div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/15 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }}
                    className="h-full rounded-full bg-gradient-to-r from-amber-200 to-emerald-200" />
                </div>
              </div>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Deposited", value: `৳${totalDeposited.toLocaleString()}`, tone: "text-foreground" },
                { label: "Outstanding", value: `৳${outstanding.toLocaleString()}`, tone: "text-primary" },
                { label: "Remaining installments", value: `${remaining}`, tone: "text-foreground" },
                { label: "Missed", value: `${plan.missed_count ?? 0}`, tone: (plan.missed_count ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground" },
              ].map((s) => (
                <div key={s.label} className="rounded-[14px] bg-card border border-border/70 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className={`text-base font-bold tabular-nums mt-0.5 ${s.tone}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Plan meta */}
            <div className="rounded-[16px] bg-muted/40 border border-border/60 divide-y divide-border/60 text-sm">
              <div className="flex justify-between p-3"><span className="text-muted-foreground">Started</span><span className="font-medium">{created.toLocaleDateString()}</span></div>
              <div className="flex justify-between p-3"><span className="text-muted-foreground">Last collection</span><span className="font-medium">{lastRun ? lastRun.toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between p-3"><span className="text-muted-foreground">Next collection</span><span className="font-semibold text-primary">{nextRun.toLocaleDateString()}</span></div>
              <div className="flex justify-between p-3"><span className="text-muted-foreground">Ends</span><span className="font-medium">{endsAt ? endsAt.toLocaleDateString() : "—"}</span></div>
            </div>

            {/* Upcoming schedule */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Upcoming schedule</h3>
                <span className="text-[10px] text-muted-foreground ml-auto">{remaining} left</span>
              </div>
              {upcoming.length === 0 ? (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-[12px] p-3 text-center">No upcoming installments — plan is complete.</div>
              ) : (
                <div className="rounded-[16px] border border-border/70 bg-card overflow-hidden">
                  {upcoming.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/60 last:border-b-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        #{paid + i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {i === 0 ? "Next up" : `+${Math.ceil((d.getTime() - Date.now()) / 86400000)} days`}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">৳{Number(plan.amount).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment history */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Payment history</h3>
                <span className="text-[10px] text-muted-foreground ml-auto">{history.length} entries</span>
              </div>
              {loadingHist ? (
                <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : history.length === 0 ? (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-[12px] p-4 text-center">No activity yet.</div>
              ) : (
                <div className="rounded-[16px] border border-border/70 bg-card overflow-hidden">
                  {history.map((h) => {
                    const b = outcomeBadge(h.outcome);
                    const B = b.Icon;
                    const d = new Date(h.created_at);
                    return (
                      <div key={h.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/60 last:border-b-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${b.color}`}>
                          <B className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {b.label}
                            {h.triggered_by && <span className="ml-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">· {h.triggered_by}</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            {h.tx_reference && ` · ${h.tx_reference}`}
                          </div>
                        </div>
                        {h.amount > 0 && (
                          <div className={`text-sm font-semibold tabular-nums ${h.outcome === "missed" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                            ৳{Number(h.amount).toLocaleString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" className="rounded-[14px] h-11" disabled={busy} onClick={togglePause}>
                {plan.is_active ? <><Pause className="w-4 h-4 mr-1.5" />Pause plan</> : <><Play className="w-4 h-4 mr-1.5" />Resume plan</>}
              </Button>
              <Button className="rounded-[14px] h-11 bg-primary text-primary-foreground" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DPS tab
// ─────────────────────────────────────────────────────────────────────────────
function DpsTab() {
  const { t } = useI18n();
  const { goals, plans, missed, reload } = useSavings();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [goalId, setGoalId] = useState<string>("");
  const [amount, setAmount] = useState("500");
  const [freq, setFreq] = useState<Frequency>("monthly");
  const [installments, setInstallments] = useState("12");
  const [strategy, setStrategy] = useState<Strategy>("balanced");
  const [collectPlan, setCollectPlan] = useState<typeof plans[number] | null>(null);
  const [repayMissed, setRepayMissed] = useState<typeof missed[number] | null>(null);
  const [detailsPlan, setDetailsPlan] = useState<typeof plans[number] | null>(null);

  const activePlans = plans.filter(p => !p.settled);
  const eligibleGoals = goals.filter(g => g.status === "active");

  const est = useMemo(() => calcDpsEstimate({
    amount: parseFloat(amount || "0"),
    frequency: freq,
    totalInstallments: parseInt(installments || "0", 10),
    strategy,
  }), [amount, freq, installments, strategy]);

  const handleCreatePlan = async () => {
    const amt = parseFloat(amount);
    const tot = parseInt(installments, 10);
    if (!goalId) throw new Error(t("savPickGoalErr"));
    if (!(amt > 0) || !(tot > 0)) throw new Error(t("savValidAmountInst"));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error(t("savNotSignedIn"));

    // First installment deducted now
    const { error: depErr } = await supabase.rpc("savings_deposit", { p_goal_id: goalId, p_amount: amt, p_source: "manual" });
    if (depErr) throw depErr;

    const nextRun = new Date();
    if (freq === "daily") nextRun.setDate(nextRun.getDate() + 1);
    else if (freq === "weekly") nextRun.setDate(nextRun.getDate() + 7);
    else nextRun.setMonth(nextRun.getMonth() + 1);

    const endsAt = new Date();
    if (freq === "daily") endsAt.setDate(endsAt.getDate() + tot);
    else if (freq === "weekly") endsAt.setDate(endsAt.getDate() + tot * 7);
    else endsAt.setMonth(endsAt.getMonth() + tot);

    const { error: planErr } = await supabase.from("savings_auto_save").insert({
      user_id: user.id, goal_id: goalId, frequency: freq, amount: amt,
      is_active: true, settled: false,
      next_run_at: nextRun.toISOString(),
      ends_at: endsAt.toISOString(),
      total_installments: tot,
      total_paid: 1, // first installment already paid
      strategy,
    });
    if (planErr) throw planErr;
    toast.success(t("savDpsCreated"));
    setCreateOpen(false); setGoalId(""); setAmount("500"); setInstallments("12");
    reload();
  };

  const handleCollect = async () => {
    if (!collectPlan) return;
    const { error } = await supabase.functions.invoke("process-auto-save", { body: { schedule_id: collectPlan.id, force: false } });
    if (error) throw error;
    toast.success(t("savInstallmentProcessed"));
    reload();
  };

  const handleRepay = async () => {
    if (!repayMissed) return;
    const { error } = await supabase.rpc("repay_missed_dps", { p_missed_id: repayMissed.id });
    if (error) throw error;
    toast.success(t("savMissedRepaid"));
    reload();
  };

  return (
    <div className="space-y-3">
      <button onClick={() => { setCreateOpen(true); if (eligibleGoals.length && !goalId) setGoalId(eligibleGoals[0].id); }}
        className="group w-full h-14 rounded-[18px] bg-gradient-to-r from-primary to-emerald-600 text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.6)] active:scale-[0.99] transition-transform">
        <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><Plus className="w-4 h-4"/></span>
        {t("savNewDpsPlan")}
      </button>

      {missed.length > 0 && (
        <div className="rounded-[20px] bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />{t("savMissedInstallments")} <span className="ml-auto text-[10px] font-normal opacity-80">{missed.length} pending</span>
          </div>
          {missed.map(m => (
            <div key={m.id} className="flex items-center justify-between text-sm bg-card/80 rounded-[14px] p-3 border border-border/50">
              <div>
                <div className="font-semibold">৳{Number(m.amount).toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground">{t("savDue")} {new Date(m.due_date).toLocaleDateString()}</div>
              </div>
              <Button size="sm" onClick={() => setRepayMissed(m)} className="rounded-full h-8 bg-amber-500 hover:bg-amber-600 text-white">{t("savRepay")}</Button>
            </div>
          ))}
        </div>
      )}

      {activePlans.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground rounded-[19px] bg-muted/40 border border-dashed border-border">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {t("savNoDpsPlans")}
        </div>
      )}

      {activePlans.map(p => {
        const goal = goals.find(g => g.id === p.goal_id);
        const pctPlan = p.total_installments ? ((p.total_paid ?? 0) / p.total_installments) * 100 : 0;
        const freqLabel = p.frequency === "daily" ? t("savDailyLabel") : p.frequency === "weekly" ? t("savWeeklyLabel") : t("savMonthlyLabel");
        const nextDate = new Date(p.next_run_at);
        const daysToNext = Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 86400000));
        return (
          <motion.div key={p.id} layout
            onClick={() => setDetailsPlan(p)}
            className="group relative overflow-hidden rounded-[22px] bg-card border border-border/70 p-4 shadow-[0_2px_10px_-4px_hsl(var(--foreground)/0.08)] cursor-pointer active:scale-[0.995] transition-transform">
            <div className={`absolute inset-y-0 left-0 w-1 ${p.is_active ? "bg-gradient-to-b from-primary to-emerald-600" : "bg-muted-foreground/40"}`} />
            <div className="pointer-events-none absolute -top-16 -right-12 w-40 h-40 rounded-full bg-emerald-500/5 blur-2xl" />

            <div className="relative flex items-start gap-3">
              <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-primary/15 to-emerald-500/10 border border-primary/15 flex items-center justify-center text-2xl shrink-0">
                {goal?.emoji ?? "💼"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-[15px] font-semibold truncate">{goal?.name ?? "—"}</div>
                  {!p.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold uppercase tracking-wide">Paused</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase tracking-wide">{freqLabel}</span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">৳{Number(p.amount).toLocaleString()}{t("savPerCycle")}</span>
                  {p.strategy && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium capitalize">{p.strategy}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums leading-none">
                  {p.total_paid ?? 0}<span className="text-sm text-muted-foreground">/{p.total_installments ?? "∞"}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">installments</div>
              </div>
            </div>

            <div className="relative mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pctPlan}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" />
            </div>

            <div className="relative mt-3 flex items-center gap-2">
              <Button size="sm" className="rounded-full h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={(e) => { e.stopPropagation(); setCollectPlan(p); }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />{t("savCollectNow")}
              </Button>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                <Calendar className="w-3 h-3" />
                {daysToNext === 0 ? "Today" : `in ${daysToNext}d`}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11px] text-primary font-semibold">
                Details <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </motion.div>
        );
      })}

      {/* Create DPS sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="rounded-t-[19px] max-h-[90vh] overflow-hidden p-0">
          <ScrollArea className="max-h-[90vh]"><div className="p-5 space-y-4">
            <SheetHeader><SheetTitle>{t("savNewDpsPlan")}</SheetTitle></SheetHeader>

            {eligibleGoals.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/40 rounded-[14px] p-3">
                {t("savCreateActiveGoalFirst")}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t("savGoal")}</label>
                  <Select value={goalId} onValueChange={setGoalId}>
                    <SelectTrigger className="rounded-[14px]"><SelectValue placeholder={t("savPickGoal")} /></SelectTrigger>
                    <SelectContent>
                      {eligibleGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">{t("savAmountField")}</label>
                    <Input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} className="rounded-[14px]" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t("savInstallments")}</label>
                    <Input type="number" inputMode="numeric" value={installments} onChange={e => setInstallments(e.target.value)} className="rounded-[14px]" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">{t("savFrequencyLabel")}</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {FREQS.map(f => (
                      <button key={f.value} onClick={() => setFreq(f.value)}
                        className={`h-10 rounded-[14px] text-sm ${freq === f.value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {t(f.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">{t("savStrategy")}</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(Object.keys(STRATEGY_RETURNS) as Strategy[]).map(s => (
                      <button key={s} onClick={() => setStrategy(s)}
                        className={`text-left p-3 rounded-[14px] ${strategy === s ? "bg-primary/15 ring-2 ring-primary" : "bg-muted"}`}>
                        <div className="text-sm font-semibold">{STRATEGY_RETURNS[s].label}</div>
                        <div className="text-[10px] text-muted-foreground">{(getEstReturn(s, freq) * 100).toFixed(1)}% p.a.</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[14px] bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-1 text-emerald-500 font-semibold text-xs">
                    <TrendingUp className="w-3 h-3" />{t("savEstimatedIndicative")}
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("savYouDeposit")}</span><span>৳{est.totalDeposited.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("savEstProfit")}</span><span className="text-emerald-500">+৳{est.profit.toLocaleString()}</span></div>
                  <div className="flex justify-between font-semibold"><span>{t("savTotalValue")}</span><span>৳{est.totalValue.toLocaleString()}</span></div>
                  <div className="text-[10px] text-muted-foreground">{(est.annualRate * 100).toFixed(2)}% {t("savAnnualisedNote")}</div>
                </div>

                <div className="text-[11px] text-muted-foreground flex gap-1.5">
                  <Info className="w-3 h-3 shrink-0 mt-0.5"/>
                  {t("savFirstInstallmentNote")}
                </div>

                <Button className="w-full rounded-[14px]" disabled={!goalId || !(parseFloat(amount) > 0)}
                  onClick={() => { setCreateOpen(false); setConfirmCreate(true); }}>
                  {t("savContinue")}
                </Button>
              </>
            )}
          </div></ScrollArea>
        </SheetContent>
      </Sheet>

      <ConfirmSheet open={confirmCreate} onClose={() => setConfirmCreate(false)}
        title={t("savConfirmDpsPlan")}
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savGoal")}</span><span>{goals.find(g => g.id === goalId)?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savPlanShort")}</span><span>৳{parseFloat(amount || "0").toLocaleString()} · {freq === "daily" ? t("savDailyLabel") : freq === "weekly" ? t("savWeeklyLabel") : t("savMonthlyLabel")} · {installments}x</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savFirstInstNow")}</span><span>৳{parseFloat(amount || "0").toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savEstTotalValue")}</span><span className="text-emerald-500">৳{est.totalValue.toLocaleString()}</span></div>
          </>
        }
        warning={t("savDpsLockWarning")}
        requireTerms onConfirm={handleCreatePlan} />

      <ConfirmSheet open={!!collectPlan} onClose={() => setCollectPlan(null)}
        title={t("savCollectInstallmentNow")}
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savAmountField")}</span><span>৳{Number(collectPlan?.amount ?? 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savGoal")}</span><span>{goals.find(g => g.id === collectPlan?.goal_id)?.name}</span></div>
          </>
        }
        warning={t("savCollectWarning")}
        onConfirm={handleCollect} />

      <ConfirmSheet open={!!repayMissed} onClose={() => setRepayMissed(null)}
        title={t("savRepayMissedInst")}
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savAmountField")}</span><span>৳{Number(repayMissed?.amount ?? 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savDueDate")}</span><span>{repayMissed && new Date(repayMissed.due_date).toLocaleDateString()}</span></div>
          </>
        }
        onConfirm={handleRepay} />

      <DpsPlanDetailsSheet
        plan={detailsPlan}
        goal={detailsPlan ? goals.find(g => g.id === detailsPlan.goal_id) : undefined}
        open={!!detailsPlan}
        onClose={() => setDetailsPlan(null)}
        onChanged={() => { reload(); setDetailsPlan(null); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gold tab
// ─────────────────────────────────────────────────────────────────────────────
function GoldTab() {
  const { t } = useI18n();
  const { gold, reload } = useSavings();
  const { price22k, price24k, updatedAt, loading: priceLoading, refresh } = useGoldPrice();
  const [karat, setKarat] = useState<"22k" | "24k">(22 === 22 ? "22k" : "24k");
  const [grams, setGrams] = useState("");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const price = karat === "22k" ? price22k : price24k;
  const subtotal = (parseFloat(grams) || 0) * price;
  const fee = Math.round(subtotal * 0.015);
  const total = mode === "buy" ? subtotal + fee : subtotal - fee;

  const holding = gold.find(g => g.karat === karat);

  const handleSubmit = async () => {
    const g = parseFloat(grams);
    if (!(g > 0)) throw new Error(t("savEnterGrams"));
    const rpc = mode === "buy" ? "buy_gold" : "sell_gold";
    const { error } = await supabase.rpc(rpc, { p_grams: g, p_price_per_gram: price, p_karat: karat });
    if (error) throw error;
    toast.success(mode === "buy" ? `${t("savBoughtPrefix")} ${g}g ${karat}` : `${t("savSoldPrefix")} ${g}g ${karat}`);
    setGrams(""); reload();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[19px] bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /><span className="text-sm font-semibold">{t("savLiveGoldPrice")}</span></div>
          <button onClick={refresh} className="text-xs text-muted-foreground flex items-center gap-1">
            {priceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["22k","24k"] as const).map(k => (
            <button key={k} onClick={() => setKarat(k)}
              className={`p-3 rounded-[14px] text-left ${karat === k ? "bg-card ring-2 ring-amber-500" : "bg-card/50"}`}>
              <div className="text-xs text-muted-foreground">{k.toUpperCase()}</div>
              <div className="text-base font-bold">৳{(k === "22k" ? price22k : price24k).toLocaleString()}/g</div>
            </button>
          ))}
        </div>
      </div>

      {holding && (
        <div className="rounded-[19px] bg-card border border-border p-4 text-sm">
          <div className="text-xs text-muted-foreground mb-1">{t("savYourHoldings")} {holding.karat} {t("savHoldingsSuffix")}</div>
          <div className="flex justify-between"><span>{t("savGramsLabel")}</span><span className="font-semibold">{Number(holding.grams).toFixed(3)}g</span></div>
          <div className="flex justify-between"><span>{t("savAvgBuy")}</span><span>৳{Number(holding.avg_buy_price).toLocaleString()}/g</span></div>
          <div className="flex justify-between"><span>{t("savCurrentValue")}</span><span className="font-semibold text-amber-500">৳{(Number(holding.grams) * price).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
        </div>
      )}

      <div className="rounded-[19px] bg-card border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["buy","sell"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`h-10 rounded-[14px] text-sm font-semibold ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m === "buy" ? t("savBuyAction") : t("savSellAction")}
            </button>
          ))}
        </div>
        <Input type="number" inputMode="decimal" placeholder={t("savGramsPlaceholder")} value={grams} onChange={e => setGrams(e.target.value)} className="rounded-[14px]" />
        <div className="text-xs space-y-1 bg-muted/40 rounded-[14px] p-3">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("savSubtotal")}</span><span>৳{subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("savFeeLabel")}</span><span>৳{fee.toLocaleString()}</span></div>
          <div className="flex justify-between font-semibold pt-1 border-t border-border/60"><span>{mode === "buy" ? t("savYouPay") : t("savYouReceive")}</span><span>৳{Math.round(total).toLocaleString()}</span></div>
        </div>
        <Button className="w-full rounded-[14px]" disabled={!(parseFloat(grams) > 0)} onClick={() => setConfirmOpen(true)}>
          {mode === "buy" ? t("savBuyGold") : t("savSellGold")}
        </Button>
      </div>

      <ConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)}
        title={`${mode === "buy" ? t("savBuyAction") : t("savSellAction")} ${grams}g ${karat}`}
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savPriceLabel")}</span><span>৳{price.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savFee15")}</span><span>৳{fee.toLocaleString()}</span></div>
            <div className="flex justify-between font-semibold"><span>{mode === "buy" ? t("savYouPay") : t("savYouReceive")}</span><span>৳{Math.round(total).toLocaleString()}</span></div>
          </>
        }
        requireTerms termsText={t("savGoldTerms")}
        onConfirm={handleSubmit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stocks tab
// ─────────────────────────────────────────────────────────────────────────────
function StocksTab() {
  const { t } = useI18n();
  const { stocks: held, reload } = useSavings();
  const { stocks: live, refresh, updatedAt, loading: priceLoading } = useStockPrices();
  const [symbol, setSymbol] = useState<string>("");
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = live.find(s => s.symbol === symbol) ?? live[0];
  useEffect(() => { if (!symbol && live.length) setSymbol(live[0].symbol); }, [live, symbol]);

  const quantity = parseInt(qty || "0", 10);
  const price = selected?.price ?? 0;
  const subtotal = quantity * price;
  const brok = 15;
  const total = mode === "buy" ? subtotal + brok : subtotal - brok;
  const holding = held.find(h => h.symbol === symbol);

  const handleSubmit = async () => {
    if (!selected) throw new Error(t("savPickStock"));
    if (!(quantity > 0)) throw new Error(t("savEnterQuantity"));
    if (mode === "buy") {
      const { error } = await supabase.rpc("buy_stock", { p_symbol: selected.symbol, p_name: selected.name, p_quantity: quantity, p_price: price });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc("sell_stock", { p_symbol: selected.symbol, p_quantity: quantity, p_price: price });
      if (error) throw error;
    }
    toast.success(`${mode === "buy" ? t("savBoughtPrefix") : t("savSoldPrefix")} ${quantity} ${selected.symbol}`);
    setQty(""); reload();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[19px] bg-gradient-to-br from-blue-500/15 to-indigo-600/10 border border-blue-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><LineChart className="w-4 h-4 text-blue-500" /><span className="text-sm font-semibold">{t("savHalalEquities")}</span></div>
          <button onClick={refresh} className="text-xs text-muted-foreground flex items-center gap-1">
            {priceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
          {live.map(s => (
            <button key={s.symbol} onClick={() => setSymbol(s.symbol)}
              className={`p-2.5 rounded-[14px] text-left ${symbol === s.symbol ? "bg-card ring-2 ring-blue-500" : "bg-card/50"}`}>
              <div className="text-[10px] text-muted-foreground">{s.sector}</div>
              <div className="text-sm font-bold">{s.symbol}</div>
              <div className="text-xs">৳{s.price.toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>

      {holding && (
        <div className="rounded-[19px] bg-card border border-border p-4 text-sm">
          <div className="text-xs text-muted-foreground mb-1">{t("savYourHoldings")} {holding.symbol} {t("savHoldingsSuffix")}</div>
          <div className="flex justify-between"><span>{t("savQuantity")}</span><span className="font-semibold">{holding.quantity}</span></div>
          <div className="flex justify-between"><span>{t("savAvgBuy")}</span><span>৳{Number(holding.avg_buy_price).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>{t("savCurrentValue")}</span><span className="font-semibold text-blue-500">৳{(Number(holding.quantity) * price).toLocaleString()}</span></div>
        </div>
      )}

      <div className="rounded-[19px] bg-card border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["buy","sell"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`h-10 rounded-[14px] text-sm font-semibold ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m === "buy" ? t("savBuyAction") : t("savSellAction")}
            </button>
          ))}
        </div>
        <Input type="number" inputMode="numeric" placeholder={`${t("savQuantity")} (${selected?.symbol ?? "—"})`} value={qty} onChange={e => setQty(e.target.value)} className="rounded-[14px]" />
        <div className="text-xs space-y-1 bg-muted/40 rounded-[14px] p-3">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("savSubtotal")}</span><span>৳{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("savBrokerage")}</span><span>৳{brok}</span></div>
          <div className="flex justify-between font-semibold pt-1 border-t border-border/60"><span>{mode === "buy" ? t("savYouPay") : t("savYouReceive")}</span><span>৳{total.toLocaleString()}</span></div>
        </div>
        <Button className="w-full rounded-[14px]" disabled={!(quantity > 0) || !selected} onClick={() => setConfirmOpen(true)}>
          {mode === "buy" ? t("savBuyStock") : t("savSellStock")}
        </Button>
      </div>

      <ConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)}
        title={`${mode === "buy" ? t("savBuyAction") : t("savSellAction")} ${quantity} ${selected?.symbol}`}
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savPriceShort")}</span><span>৳{price.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("savBrokerage")}</span><span>৳{brok}</span></div>
            <div className="flex justify-between font-semibold"><span>{mode === "buy" ? t("savYouPay") : t("savYouReceive")}</span><span>৳{total.toLocaleString()}</span></div>
          </>
        }
        requireTerms termsText={t("savStockTerms")}
        onConfirm={handleSubmit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────
const SavingsPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { status: kyc, loading: kycLoading } = useKycStatus();
  const [walletBal, setWalletBal] = useState<number>(getBalance());
  useEffect(() => {
    if (user?.id) { fetchBalance(user.id).then(setWalletBal); }
    const unsub = onBalanceChange(setWalletBal);
    return () => { unsub(); };
  }, [user?.id]);
  const { goals, plans, gold, stocks } = useSavings();
  const [tab, setTab] = useState<Tab>("goals");
  const { price22k } = useGoldPrice();
  const { stocks: liveStocks } = useStockPrices();

  useEffect(() => {
    if (!authLoading && !user) navigate("/", { replace: true });
  }, [authLoading, user, navigate]);

  const portfolioValue = useMemo(() => {
    const goalSum = goals.filter(g => g.status === "active" || g.status === "completed").reduce((s, g) => s + Number(g.saved_amount), 0);
    const goldSum = gold.reduce((s, g) => s + Number(g.grams) * price22k, 0); // crude (22k price for both)
    const stockSum = stocks.reduce((s, h) => {
      const live = liveStocks.find(l => l.symbol === h.symbol);
      return s + Number(h.quantity) * (live?.price ?? Number(h.avg_buy_price));
    }, 0);
    return goalSum + goldSum + stockSum;
  }, [goals, gold, stocks, liveStocks, price22k]);

  if (kycLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (kyc !== "verified") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
        <Lock className="w-10 h-10 text-muted-foreground" />
        <div className="font-semibold">{t("savKycRequired")}</div>
        <p className="text-sm text-muted-foreground max-w-xs">{t("savKycDescription")}</p>
        <Button onClick={() => navigate("/account")} className="rounded-[14px]">{t("savGoToKyc")}</Button>
        <Button variant="ghost" onClick={() => navigate("/")}>{t("savBack")}</Button>
      </div>
    );
  }

  const TABS: { id: Tab; labelKey: TranslationKey; icon: any }[] = [
    { id: "goals", labelKey: "savGoalsLabel", icon: Target },
    { id: "dps",   labelKey: "savDpsLabel",   icon: Calendar },
    { id: "gold",  labelKey: "savGoldLabel",  icon: Coins },
    { id: "stocks",labelKey: "savStocksLabel",icon: LineChart },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo title="Islamic Savings & DPS" description="Sharia-compliant savings, DPS, gold, and stocks." path="/savings" />

      {/* Header */}
      <div className="sticky top-0 z-10 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow">
        <div className="flex items-center gap-3 px-4 pt-4 pb-4">
          <button
            onClick={() => navigate(-1)}
            aria-label={t("savBack")}
            className="w-10 h-10 -ml-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-tight">{t("savIslamicSavings")}</h1>
            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20">
              <Sparkles className="w-3 h-3 fill-primary-foreground/40" />
              <span className="text-[10px] font-medium tracking-wide text-primary-foreground/95">{t("savShariaMudarabah")}</span>
            </div>
          </div>
        </div>
      </div>


      <div className="p-4 space-y-5">
        {/* Portfolio hero */}
        <div className="relative overflow-hidden rounded-[24px] p-5 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.85)_45%,#0b3d2e_100%)] text-primary-foreground shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.55)]">
          {/* decorative rings */}
          <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 w-48 h-48 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/75">
                <Wallet className="w-3.5 h-3.5" />{t("savPortfolioValue")}
              </div>
              <div className="text-[10px] px-2 py-0.5 rounded-full bg-amber-300/20 border border-amber-200/30 text-amber-100 font-medium">
                Halal · Mudarabah
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[34px] font-bold tracking-tight leading-none">৳{Math.round(portfolioValue).toLocaleString()}</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { k: "savGoalsLabel", v: goals.filter(g => g.status === "active").length, Icon: Target },
                { k: "savDpsLabel", v: plans.filter(p => !p.settled).length, Icon: Calendar },
                { k: "savGoldLabel", v: `${gold.reduce((s,g) => s + Number(g.grams), 0).toFixed(1)}g`, Icon: Coins },
                { k: "savStocksLabel", v: stocks.length, Icon: LineChart },
              ].map(({ k, v, Icon }) => (
                <div key={k} className="rounded-[14px] bg-white/10 backdrop-blur-md border border-white/15 px-2 py-2 text-center">
                  <Icon className="w-3.5 h-3.5 mx-auto opacity-80" />
                  <div className="text-[10px] uppercase tracking-wide text-primary-foreground/70 mt-1">{t(k as TranslationKey)}</div>
                  <div className="text-sm font-semibold leading-tight">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-primary-foreground/70">
              <span>{t("savWalletBalance")}</span>
              <span className="font-medium text-primary-foreground/90">৳{Number(walletBal ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Segmented tabs */}
        <div className="relative bg-muted/60 backdrop-blur-md rounded-[16px] p-1 grid grid-cols-4 gap-1 border border-border/60">
          {TABS.map(tb => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`relative h-12 rounded-[12px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {active && (
                  <motion.div layoutId="tab-pill" transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    className="absolute inset-0 rounded-[12px] bg-primary shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.6)]" />
                )}
                <Icon className="w-4 h-4 relative" />
                <span className="relative">{t(tb.labelKey)}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}>
            {tab === "goals" && <GoalsTab />}
            {tab === "dps" && <DpsTab />}
            {tab === "gold" && <GoldTab />}
            {tab === "stocks" && <StocksTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SavingsPage;
