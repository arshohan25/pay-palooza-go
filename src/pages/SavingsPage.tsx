import Seo from "@/components/Seo";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Target, Plus, Calendar, TrendingUp, Coins, LineChart,
  AlertCircle, CheckCircle2, Loader2, Lock, RefreshCw, ChevronRight, Info,
  Wallet, Sparkles, X,
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

type Tab = "goals" | "dps" | "gold" | "stocks";

const EMOJIS = ["🎯","🏠","🚗","✈️","🎓","💍","📱","🎁","💼","🕌"];
const FREQS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
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
      <p className="text-center text-xs text-muted-foreground">Enter your 4-digit PIN</p>
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
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [terms, setTerms] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) { setPin(""); setPinError(""); setTerms(false); setProcessing(false); }
  }, [open]);

  const handleSlide = async () => {
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    if (requireTerms && !terms) { toast.error("Please accept the terms"); return; }
    setProcessing(true);
    const valid = await verifyPin(pin);
    if (!valid) { setPinError("Incorrect PIN"); setPin(""); setProcessing(false); haptics.error(); return; }
    try {
      await onConfirm();
      haptics.success();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Operation failed");
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
                <span>{termsText ?? "I accept the Islamic Savings terms — Mudarabah model, no guaranteed return, profit subject to market conditions."}</span>
              </label>
            )}
            <PinPad pin={pin} setPin={(v) => { setPin(v); setPinError(""); }} error={pinError} />
            <SlideToConfirm
              onConfirm={handleSlide}
              disabled={pin.length < 4 || processing || (!!requireTerms && !terms)}
              pinComplete={pin.length === 4}
              gradient={gradient}
              label={processing ? "Processing…" : "Slide to confirm"}
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
    if (!name.trim() || !(tg > 0)) throw new Error("Enter a valid name and target");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data: goal, error } = await supabase.from("savings_goals")
      .insert({ user_id: user.id, name: name.trim(), emoji, target_amount: tg, saved_amount: 0 })
      .select().single();
    if (error) throw error;
    if (od > 0) {
      const { error: depErr } = await supabase.rpc("savings_deposit", { p_goal_id: goal.id, p_amount: od, p_source: "manual" });
      if (depErr) throw depErr;
    }
    toast.success("Goal created");
    setName(""); setTarget(""); setOpeningDeposit(""); setEmoji(EMOJIS[0]); setCreateOpen(false);
    reload();
  };

  const handleDeposit = async () => {
    if (!depositGoal) return;
    const amt = parseFloat(depositAmt);
    if (!(amt > 0)) throw new Error("Enter an amount");
    const { error } = await supabase.rpc("savings_deposit", { p_goal_id: depositGoal.id, p_amount: amt, p_source: "manual" });
    if (error) throw error;
    toast.success(`৳${amt.toLocaleString()} deposited`);
    setDepositAmt(""); reload();
  };

  const handleCancel = async () => {
    if (!cancelGoal) return;
    const { error } = await supabase.rpc("cancel_goal", { p_goal_id: cancelGoal.id });
    if (error) throw error;
    toast.success("Goal cancelled");
    reload();
  };

  const handleWithdraw = async () => {
    if (!withdrawGoal) return;
    const { error } = await supabase.rpc("withdraw_completed_goal", { p_goal_id: withdrawGoal.id });
    if (error) throw error;
    toast.success("Withdrawn to wallet");
    reload();
  };

  const goalHasDps = (goalId: string) => plans.some(p => p.goal_id === goalId);

  return (
    <div className="space-y-3">
      <Button onClick={() => setCreateOpen(true)} className="w-full h-12 rounded-[19px]">
        <Plus className="w-4 h-4 mr-2" />Create New Goal
      </Button>

      {activeGoals.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-40" />
          No savings goals yet. Create your first goal.
        </div>
      )}

      {activeGoals.map(g => {
        const pct = Math.min(100, (Number(g.saved_amount) / Math.max(1, Number(g.target_amount))) * 100);
        const lockDays = goalLockDaysLeft(g.created_at);
        const dpsLink = goalHasDps(g.id);
        const dpsDays = dpsLink ? dpsLockDaysLeft(plans.find(p => p.goal_id === g.id)!.created_at) : 0;
        const totalLock = Math.max(lockDays, dpsDays);
        return (
          <motion.div key={g.id} layout
            className="rounded-[19px] bg-card border border-border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="text-3xl">{g.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{g.name}</h3>
                  {g.status === "completed" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  ৳{Number(g.saved_amount).toLocaleString()} / ৳{Number(g.target_amount).toLocaleString()}
                </div>
              </div>
              <span className="text-sm font-semibold">{pct.toFixed(0)}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
            <div className="flex flex-wrap gap-2">
              {g.status === "active" && (
                <Button size="sm" variant="secondary" className="rounded-full"
                  onClick={() => { setDepositGoal(g); setDepositAmt(""); }}>
                  <Plus className="w-3 h-3 mr-1" />Deposit
                </Button>
              )}
              {g.status === "completed" && (
                <Button size="sm" className="rounded-full" onClick={() => setWithdrawGoal(g)}>
                  Withdraw
                </Button>
              )}
              {g.status === "active" && (
                <Button size="sm" variant="ghost" className="rounded-full text-destructive"
                  onClick={() => setCancelGoal(g)} disabled={totalLock > 0}>
                  {totalLock > 0 ? <><Lock className="w-3 h-3 mr-1" />{totalLock}d</> : "Cancel"}
                </Button>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Create goal sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="rounded-t-[19px]">
          <SheetHeader><SheetTitle>New Savings Goal</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-2xl w-12 h-12 rounded-full shrink-0 ${emoji === e ? "bg-primary/15 ring-2 ring-primary" : "bg-muted"}`}>{e}</button>
              ))}
            </div>
            <Input placeholder="Goal name (e.g. Hajj Fund)" value={name} onChange={e => setName(e.target.value)} maxLength={40} className="rounded-[14px]" />
            <Input type="number" inputMode="numeric" placeholder="Target amount (৳)" value={target} onChange={e => setTarget(e.target.value)} className="rounded-[14px]" />
            <Input type="number" inputMode="numeric" placeholder="Opening deposit (optional)" value={openingDeposit} onChange={e => setOpeningDeposit(e.target.value)} className="rounded-[14px]" />
            <Button className="w-full rounded-[14px]"
              disabled={!name.trim() || !(parseFloat(target) > 0)}
              onClick={() => { setCreateOpen(false); setConfirmCreate(true); }}>
              Continue
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmSheet open={confirmCreate} onClose={() => setConfirmCreate(false)}
        title="Confirm new goal"
        summary={
          <>
            <div className="flex justify-between"><span>{emoji} {name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span>৳{parseFloat(target || "0").toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Opening deposit</span><span>৳{parseFloat(openingDeposit || "0").toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lock-in</span><span>60 days</span></div>
          </>
        }
        requireTerms onConfirm={handleCreate} />

      <ConfirmSheet open={!!depositGoal} onClose={() => setDepositGoal(null)}
        title={`Deposit to ${depositGoal?.name ?? ""}`}
        summary={
          <div className="space-y-3">
            <Input type="number" inputMode="numeric" placeholder="Amount (৳)" value={depositAmt}
              onChange={e => setDepositAmt(e.target.value)} className="rounded-[14px]" />
          </div>
        }
        onConfirm={handleDeposit} />

      <ConfirmSheet open={!!cancelGoal} onClose={() => setCancelGoal(null)}
        title="Cancel goal"
        warning="Your saved amount will be refunded to your wallet. This cannot be undone."
        summary={
          <>
            <div className="flex justify-between"><span>{cancelGoal?.emoji} {cancelGoal?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Refund</span><span>৳{Number(cancelGoal?.saved_amount ?? 0).toLocaleString()}</span></div>
          </>
        }
        onConfirm={handleCancel} />

      <ConfirmSheet open={!!withdrawGoal} onClose={() => setWithdrawGoal(null)}
        title="Withdraw completed goal"
        summary={
          <>
            <div className="flex justify-between"><span>{withdrawGoal?.emoji} {withdrawGoal?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Withdraw to wallet</span><span>৳{Number(withdrawGoal?.saved_amount ?? 0).toLocaleString()}</span></div>
          </>
        }
        onConfirm={handleWithdraw} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DPS tab
// ─────────────────────────────────────────────────────────────────────────────
function DpsTab() {
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
    if (!goalId) throw new Error("Pick a goal");
    if (!(amt > 0) || !(tot > 0)) throw new Error("Enter valid amount and installments");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");

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
    toast.success("DPS plan created");
    setCreateOpen(false); setGoalId(""); setAmount("500"); setInstallments("12");
    reload();
  };

  const handleCollect = async () => {
    if (!collectPlan) return;
    const { error } = await supabase.functions.invoke("process-auto-save", { body: { schedule_id: collectPlan.id, force: false } });
    if (error) throw error;
    toast.success("Installment processed");
    reload();
  };

  const handleRepay = async () => {
    if (!repayMissed) return;
    const { error } = await supabase.rpc("repay_missed_dps", { p_missed_id: repayMissed.id });
    if (error) throw error;
    toast.success("Missed payment repaid");
    reload();
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => { setCreateOpen(true); if (eligibleGoals.length && !goalId) setGoalId(eligibleGoals[0].id); }} className="w-full h-12 rounded-[19px]">
        <Plus className="w-4 h-4 mr-2" />New DPS Plan
      </Button>

      {missed.length > 0 && (
        <div className="rounded-[19px] bg-amber-500/10 border border-amber-500/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />Missed installments ({missed.length})
          </div>
          {missed.map(m => (
            <div key={m.id} className="flex items-center justify-between text-sm bg-card/60 rounded-[14px] p-2.5">
              <div>
                <div className="font-medium">৳{Number(m.amount).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Due {new Date(m.due_date).toLocaleDateString()}</div>
              </div>
              <Button size="sm" onClick={() => setRepayMissed(m)} className="rounded-full">Repay</Button>
            </div>
          ))}
        </div>
      )}

      {activePlans.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
          No DPS plans yet.
        </div>
      )}

      {activePlans.map(p => {
        const goal = goals.find(g => g.id === p.goal_id);
        const pctPlan = p.total_installments ? ((p.total_paid ?? 0) / p.total_installments) * 100 : 0;
        return (
          <motion.div key={p.id} layout className="rounded-[19px] bg-card border border-border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{goal?.emoji} {goal?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground capitalize">{p.frequency} · ৳{Number(p.amount).toLocaleString()}/cycle</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{p.total_paid ?? 0}/{p.total_installments ?? "∞"}</div>
                <div className="text-[10px] text-muted-foreground">{p.strategy ?? "—"}</div>
              </div>
            </div>
            <Progress value={pctPlan} className="h-1" />
            <div className="flex gap-2 text-xs">
              <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setCollectPlan(p)}>
                <RefreshCw className="w-3 h-3 mr-1" />Collect now
              </Button>
              <span className="ml-auto text-muted-foreground self-center">Next {new Date(p.next_run_at).toLocaleDateString()}</span>
            </div>
          </motion.div>
        );
      })}

      {/* Create DPS sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="rounded-t-[19px] max-h-[90vh] overflow-hidden p-0">
          <ScrollArea className="max-h-[90vh]"><div className="p-5 space-y-4">
            <SheetHeader><SheetTitle>New DPS Plan</SheetTitle></SheetHeader>

            {eligibleGoals.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/40 rounded-[14px] p-3">
                Create an active goal first to attach a DPS plan.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Goal</label>
                  <Select value={goalId} onValueChange={setGoalId}>
                    <SelectTrigger className="rounded-[14px]"><SelectValue placeholder="Pick a goal" /></SelectTrigger>
                    <SelectContent>
                      {eligibleGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Amount (৳)</label>
                    <Input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} className="rounded-[14px]" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Installments</label>
                    <Input type="number" inputMode="numeric" value={installments} onChange={e => setInstallments(e.target.value)} className="rounded-[14px]" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Frequency</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {FREQS.map(f => (
                      <button key={f.value} onClick={() => setFreq(f.value)}
                        className={`h-10 rounded-[14px] text-sm ${freq === f.value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Strategy</label>
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
                    <TrendingUp className="w-3 h-3" />Estimated (indicative)
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">You deposit</span><span>৳{est.totalDeposited.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Est. profit</span><span className="text-emerald-500">+৳{est.profit.toLocaleString()}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total value</span><span>৳{est.totalValue.toLocaleString()}</span></div>
                  <div className="text-[10px] text-muted-foreground">{(est.annualRate * 100).toFixed(2)}% annualised, capped at 6%. Not guaranteed.</div>
                </div>

                <div className="text-[11px] text-muted-foreground flex gap-1.5">
                  <Info className="w-3 h-3 shrink-0 mt-0.5"/>
                  First installment deducted now. DPS plan locked for 90 days.
                </div>

                <Button className="w-full rounded-[14px]" disabled={!goalId || !(parseFloat(amount) > 0)}
                  onClick={() => { setCreateOpen(false); setConfirmCreate(true); }}>
                  Continue
                </Button>
              </>
            )}
          </div></ScrollArea>
        </SheetContent>
      </Sheet>

      <ConfirmSheet open={confirmCreate} onClose={() => setConfirmCreate(false)}
        title="Confirm DPS plan"
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Goal</span><span>{goals.find(g => g.id === goalId)?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>৳{parseFloat(amount || "0").toLocaleString()} · {freq} · {installments}x</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">First installment now</span><span>৳{parseFloat(amount || "0").toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Est. total value</span><span className="text-emerald-500">৳{est.totalValue.toLocaleString()}</span></div>
          </>
        }
        warning="DPS plans are locked for 90 days. Missing installments increases your missed counter."
        requireTerms onConfirm={handleCreatePlan} />

      <ConfirmSheet open={!!collectPlan} onClose={() => setCollectPlan(null)}
        title="Collect installment now"
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>৳{Number(collectPlan?.amount ?? 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Goal</span><span>{goals.find(g => g.id === collectPlan?.goal_id)?.name}</span></div>
          </>
        }
        warning="If your wallet balance is insufficient, this run will be marked as missed."
        onConfirm={handleCollect} />

      <ConfirmSheet open={!!repayMissed} onClose={() => setRepayMissed(null)}
        title="Repay missed installment"
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>৳{Number(repayMissed?.amount ?? 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Due date</span><span>{repayMissed && new Date(repayMissed.due_date).toLocaleDateString()}</span></div>
          </>
        }
        onConfirm={handleRepay} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gold tab
// ─────────────────────────────────────────────────────────────────────────────
function GoldTab() {
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
    if (!(g > 0)) throw new Error("Enter grams");
    const rpc = mode === "buy" ? "buy_gold" : "sell_gold";
    const { error } = await supabase.rpc(rpc, { p_grams: g, p_price_per_gram: price, p_karat: karat });
    if (error) throw error;
    toast.success(mode === "buy" ? `Bought ${g}g ${karat}` : `Sold ${g}g ${karat}`);
    setGrams(""); reload();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[19px] bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /><span className="text-sm font-semibold">Live Gold Price</span></div>
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
          <div className="text-xs text-muted-foreground mb-1">Your {holding.karat} holdings</div>
          <div className="flex justify-between"><span>Grams</span><span className="font-semibold">{Number(holding.grams).toFixed(3)}g</span></div>
          <div className="flex justify-between"><span>Avg buy</span><span>৳{Number(holding.avg_buy_price).toLocaleString()}/g</span></div>
          <div className="flex justify-between"><span>Current value</span><span className="font-semibold text-amber-500">৳{(Number(holding.grams) * price).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
        </div>
      )}

      <div className="rounded-[19px] bg-card border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["buy","sell"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`h-10 rounded-[14px] text-sm font-semibold capitalize ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m}
            </button>
          ))}
        </div>
        <Input type="number" inputMode="decimal" placeholder="Grams" value={grams} onChange={e => setGrams(e.target.value)} className="rounded-[14px]" />
        <div className="text-xs space-y-1 bg-muted/40 rounded-[14px] p-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>৳{subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Fee (1.5%)</span><span>৳{fee.toLocaleString()}</span></div>
          <div className="flex justify-between font-semibold pt-1 border-t border-border/60"><span>{mode === "buy" ? "You pay" : "You receive"}</span><span>৳{Math.round(total).toLocaleString()}</span></div>
        </div>
        <Button className="w-full rounded-[14px]" disabled={!(parseFloat(grams) > 0)} onClick={() => setConfirmOpen(true)}>
          {mode === "buy" ? "Buy gold" : "Sell gold"}
        </Button>
      </div>

      <ConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)}
        title={`${mode === "buy" ? "Buy" : "Sell"} ${grams}g ${karat}`}
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Price/g</span><span>৳{price.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fee 1.5%</span><span>৳{fee.toLocaleString()}</span></div>
            <div className="flex justify-between font-semibold"><span>{mode === "buy" ? "You pay" : "You receive"}</span><span>৳{Math.round(total).toLocaleString()}</span></div>
          </>
        }
        requireTerms termsText="I accept that gold trades follow Sharia (Bai-as-Salam) and prices fluctuate. No guaranteed return."
        onConfirm={handleSubmit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stocks tab
// ─────────────────────────────────────────────────────────────────────────────
function StocksTab() {
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
    if (!selected) throw new Error("Pick a stock");
    if (!(quantity > 0)) throw new Error("Enter quantity");
    if (mode === "buy") {
      const { error } = await supabase.rpc("buy_stock", { p_symbol: selected.symbol, p_name: selected.name, p_quantity: quantity, p_price: price });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc("sell_stock", { p_symbol: selected.symbol, p_quantity: quantity, p_price: price });
      if (error) throw error;
    }
    toast.success(`${mode === "buy" ? "Bought" : "Sold"} ${quantity} ${selected.symbol}`);
    setQty(""); reload();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[19px] bg-gradient-to-br from-blue-500/15 to-indigo-600/10 border border-blue-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><LineChart className="w-4 h-4 text-blue-500" /><span className="text-sm font-semibold">Halal Equities (DSE)</span></div>
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
          <div className="text-xs text-muted-foreground mb-1">Your {holding.symbol} holdings</div>
          <div className="flex justify-between"><span>Quantity</span><span className="font-semibold">{holding.quantity}</span></div>
          <div className="flex justify-between"><span>Avg buy</span><span>৳{Number(holding.avg_buy_price).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Current value</span><span className="font-semibold text-blue-500">৳{(Number(holding.quantity) * price).toLocaleString()}</span></div>
        </div>
      )}

      <div className="rounded-[19px] bg-card border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["buy","sell"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`h-10 rounded-[14px] text-sm font-semibold capitalize ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m}
            </button>
          ))}
        </div>
        <Input type="number" inputMode="numeric" placeholder={`Quantity (${selected?.symbol ?? "—"})`} value={qty} onChange={e => setQty(e.target.value)} className="rounded-[14px]" />
        <div className="text-xs space-y-1 bg-muted/40 rounded-[14px] p-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>৳{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Brokerage</span><span>৳{brok}</span></div>
          <div className="flex justify-between font-semibold pt-1 border-t border-border/60"><span>{mode === "buy" ? "You pay" : "You receive"}</span><span>৳{total.toLocaleString()}</span></div>
        </div>
        <Button className="w-full rounded-[14px]" disabled={!(quantity > 0) || !selected} onClick={() => setConfirmOpen(true)}>
          {mode === "buy" ? "Buy stock" : "Sell stock"}
        </Button>
      </div>

      <ConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)}
        title={`${mode === "buy" ? "Buy" : "Sell"} ${quantity} ${selected?.symbol}`}
        summary={
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>৳{price.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Brokerage</span><span>৳{brok}</span></div>
            <div className="flex justify-between font-semibold"><span>{mode === "buy" ? "You pay" : "You receive"}</span><span>৳{total.toLocaleString()}</span></div>
          </>
        }
        requireTerms termsText="I confirm this is a Sharia-compliant DSE listing and accept that stock prices fluctuate."
        onConfirm={handleSubmit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────
const SavingsPage = () => {
  const navigate = useNavigate();
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
  if (kyc !== "approved") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
        <Lock className="w-10 h-10 text-muted-foreground" />
        <div className="font-semibold">KYC required</div>
        <p className="text-sm text-muted-foreground max-w-xs">Complete identity verification to unlock Islamic Savings, DPS, Gold, and Stocks.</p>
        <Button onClick={() => navigate("/account")} className="rounded-[14px]">Go to KYC</Button>
        <Button variant="ghost" onClick={() => navigate("/")}>Back</Button>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "goals", label: "Goals", icon: Target },
    { id: "dps",   label: "DPS",   icon: Calendar },
    { id: "gold",  label: "Gold",  icon: Coins },
    { id: "stocks",label: "Stocks",icon: LineChart },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo title="Islamic Savings & DPS" description="Sharia-compliant savings, DPS, gold, and stocks." />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold">Islamic Savings</h1>
            <p className="text-[11px] text-muted-foreground">Sharia-compliant · Mudarabah</p>
          </div>
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Portfolio summary */}
        <div className="rounded-[19px] p-5 bg-gradient-to-br from-emerald-500/20 via-primary/10 to-blue-500/10 border border-primary/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Wallet className="w-3 h-3" />Portfolio value</div>
          <div className="text-3xl font-bold">৳{Math.round(portfolioValue).toLocaleString()}</div>
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <div><div className="text-xs text-muted-foreground">Goals</div><div className="text-sm font-semibold">{goals.filter(g => g.status === "active").length}</div></div>
            <div><div className="text-xs text-muted-foreground">DPS</div><div className="text-sm font-semibold">{plans.filter(p => !p.settled).length}</div></div>
            <div><div className="text-xs text-muted-foreground">Gold</div><div className="text-sm font-semibold">{gold.reduce((s,g) => s + Number(g.grams), 0).toFixed(1)}g</div></div>
            <div><div className="text-xs text-muted-foreground">Stocks</div><div className="text-sm font-semibold">{stocks.length}</div></div>
          </div>
          <div className="text-[10px] text-muted-foreground mt-3">Wallet balance: ৳{Number(profile?.balance ?? 0).toLocaleString()}</div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-2">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`h-14 rounded-[14px] flex flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
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
