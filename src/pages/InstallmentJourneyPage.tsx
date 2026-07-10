import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  Bell,
  AlertTriangle,
  Trophy,
  Target,
  Plus,
  Landmark,
  Wallet,
  Coins,
  Sparkles,
  TrendingUp,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSavings, type SavingsGoal, type AutoSavePlan } from "@/hooks/use-savings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Status = "paid" | "upcoming" | "due" | "overdue" | "completed";

interface Installment {
  n: number;
  amount: number;
  remaining: number;
  dueDate: string;
  paidDate?: string;
  status: Status;
}

const bdt = (n: number) => `৳${Math.round(n).toLocaleString("en-BD")}`;

const STATUS_META: Record<Status, { label: string; ring: string; dot: string; glow: string; icon: typeof Check }> = {
  paid: {
    label: "Paid",
    ring: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    dot: "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_20px_rgba(34,197,94,0.55)]",
    glow: "",
    icon: Check,
  },
  upcoming: {
    label: "Upcoming",
    ring: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    dot: "bg-gradient-to-br from-sky-400 to-sky-600",
    glow: "animate-pulse",
    icon: Clock,
  },
  due: {
    label: "Due Today",
    ring: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    dot: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_28px_rgba(245,158,11,0.75)]",
    glow: "animate-pulse",
    icon: Bell,
  },
  overdue: {
    label: "Overdue",
    ring: "border-red-500/40 bg-red-500/10 text-red-300",
    dot: "bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_24px_rgba(239,68,68,0.7)]",
    glow: "",
    icon: AlertTriangle,
  },
  completed: {
    label: "Completed",
    ring: "border-[#F4C542]/50 bg-[#F4C542]/10 text-[#F4C542]",
    dot: "bg-gradient-to-br from-[#F4C542] to-orange-500 shadow-[0_0_32px_rgba(244,197,66,0.85)]",
    glow: "",
    icon: Trophy,
  },
};

function Ring({ value, size = 120, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#009688" />
            <stop offset="60%" stopColor="#2ECC71" />
            <stop offset="100%" stopColor="#F4C542" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white tabular-nums">{Math.round(value)}%</span>
        <span className="text-[10px] uppercase tracking-widest text-white/60">complete</span>
      </div>
    </div>
  );
}

function MilestoneRow({ item, side, isLast }: { item: Installment; side: "left" | "right"; isLast: boolean }) {
  const meta = STATUS_META[item.status];
  const Icon = meta.icon;

  const amountCard = (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/50">Installment</span>
        <span className="text-[10px] font-semibold text-white/70">#{item.n}</span>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-white">{bdt(item.amount)}</div>
      <div className="mt-1 text-[10px] text-white/50">
        Remaining <span className="tabular-nums text-white/80">{bdt(item.remaining)}</span>
      </div>
    </motion.div>
  );

  const dateCard = (
    <motion.div
      initial={{ opacity: 0, x: side === "right" ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
        <Calendar size={10} />
        Due {item.dueDate}
      </div>
      {item.paidDate && <div className="mt-1 text-[10px] text-emerald-300/80">Paid · {item.paidDate}</div>}
      <div className={cn("mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.ring)}>
        <Icon size={10} />
        {meta.label}
      </div>
    </motion.div>
  );

  return (
    <div className="relative grid grid-cols-[1fr_44px_1fr] items-center gap-2">
      <div>{side === "left" ? amountCard : dateCard}</div>

      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={cn(
            "z-10 flex h-10 w-10 items-center justify-center rounded-full ring-4 ring-[#0B1220]",
            meta.dot,
            meta.glow,
          )}
        >
          <Icon size={16} className="text-white" strokeWidth={2.5} />
        </motion.div>
        {!isLast && (
          <div className="absolute left-1/2 top-10 h-[calc(100%+1.25rem)] w-[2px] -translate-x-1/2 overflow-hidden">
            <div className="h-full w-full bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
            {item.status === "paid" && (
              <motion.div
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                style={{ transformOrigin: "top" }}
                className="absolute inset-0 bg-gradient-to-b from-emerald-400 via-emerald-500/60 to-transparent"
              />
            )}
          </div>
        )}
      </div>

      <div>{side === "right" ? amountCard : dateCard}</div>
    </div>
  );
}

function formatShort(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function buildFromPlan(plan: AutoSavePlan, goalTarget?: number): Installment[] {
  const amount = Number(plan.amount) || 0;
  let total = Number(plan.total_installments) || 0;
  const paid = Number(plan.total_paid) || 0;
  if (!total && goalTarget && amount > 0) total = Math.max(paid, Math.ceil(goalTarget / amount));
  if (!total) total = Math.max(paid + 4, 12);
  const cycleMs =
    plan.frequency === "daily" ? 86400000 : plan.frequency === "weekly" ? 7 * 86400000 : 30 * 86400000;
  const anchor = new Date(plan.next_run_at || plan.created_at).getTime();
  const list: Installment[] = [];
  for (let i = 0; i < total; i++) {
    const idx = i;
    // due date estimation: anchor is next unpaid; back-fill paid, forward for upcoming
    const offset = (idx - paid) * cycleMs;
    const due = new Date(anchor + offset);
    let status: Status = "upcoming";
    if (idx < paid) status = "paid";
    else if (idx === paid) status = due.getTime() <= Date.now() ? "due" : "upcoming";
    if (idx === total - 1 && idx < paid) status = "completed";
    const remaining = Math.max(0, (total - idx - 1) * Number(plan.amount));
    list.push({
      n: idx + 1,
      amount: Number(plan.amount),
      remaining,
      dueDate: formatShort(due),
      paidDate: idx < paid ? formatShort(new Date(anchor + offset)) : undefined,
      status,
    });
  }
  return list;
}

function buildFromGoal(goal: SavingsGoal, plan?: AutoSavePlan): Installment[] {
  if (plan) return buildFromPlan(plan);
  // No plan: synthesize milestones as 5 target checkpoints
  const total = 5;
  const step = Number(goal.target_amount) / total;
  const saved = Number(goal.saved_amount);
  const now = Date.now();
  const list: Installment[] = [];
  for (let i = 0; i < total; i++) {
    const cumulative = step * (i + 1);
    const status: Status = saved >= cumulative ? "paid" : i === Math.floor(saved / step) ? "due" : "upcoming";
    list.push({
      n: i + 1,
      amount: step,
      remaining: Math.max(0, Number(goal.target_amount) - cumulative),
      dueDate: formatShort(new Date(now + i * 30 * 86400000)),
      paidDate: saved >= cumulative ? formatShort(new Date(now)) : undefined,
      status: i === total - 1 && saved >= cumulative ? "completed" : status,
    });
  }
  return list;
}

export default function InstallmentJourneyPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { goals, plans, loading, reload } = useSavings();

  const type = params.get("type"); // 'goal' | 'dps'
  const id = params.get("id");

  const plan = type === "dps" ? plans.find((p) => p.id === id) : undefined;
  const goal =
    type === "goal"
      ? goals.find((g) => g.id === id)
      : plan
        ? goals.find((g) => g.id === plan.goal_id)
        : undefined;
  const linkedPlan = plan ?? (goal ? plans.find((p) => p.goal_id === goal.id) : undefined);

  const [actionSheet, setActionSheet] = useState<null | "deposit" | "installment">(null);
  const [amt, setAmt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deposits, setDeposits] = useState<{ id: string; amount: number; created_at: string }[]>([]);

  useEffect(() => {
    if (!goal || plan) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("savings_deposits")
        .select("id, amount, created_at")
        .eq("goal_id", goal.id)
        .order("created_at", { ascending: true });
      if (!cancelled) setDeposits((data ?? []).map((d) => ({ ...d, amount: Number(d.amount) })));
    })();
    return () => { cancelled = true; };
  }, [goal, plan]);

  const installments = useMemo<Installment[]>(() => {
    if (plan) return buildFromPlan(plan, goal ? Number(goal.target_amount) : undefined);
    if (goal) {
      if (deposits.length > 0) {
        const target = Number(goal.target_amount);
        let running = 0;
        const rows: Installment[] = deposits.map((d, i) => {
          running += d.amount;
          const isLast = i === deposits.length - 1 && running >= target;
          return {
            n: i + 1,
            amount: d.amount,
            remaining: Math.max(0, target - running),
            dueDate: formatShort(new Date(d.created_at)),
            paidDate: formatShort(new Date(d.created_at)),
            status: isLast ? "completed" : "paid",
          };
        });
        if (running < target) {
          rows.push({
            n: rows.length + 1,
            amount: Math.max(0, target - running),
            remaining: 0,
            dueDate: formatShort(new Date()),
            status: "upcoming",
          });
        }
        return rows;
      }
      return buildFromGoal(goal, linkedPlan);
    }
    return [];
  }, [plan, goal, linkedPlan, deposits]);

  const loadingState = loading && !goal && !plan;
  const notFound = !loadingState && !goal && !plan;

  const displayName = goal?.name ?? (plan ? "DPS Plan" : "");
  const emoji = goal?.emoji ?? "💼";
  const planTotalInst = Number(plan?.total_installments) || 0;
  const target = Number(
    goal?.target_amount ??
      (plan ? Number(plan.amount) * (planTotalInst || 12) : 0),
  );
  const balance = Number(
    goal?.saved_amount ??
      (plan ? Number(plan.amount) * (Number(plan.total_paid) || 0) : 0),
  );
  const pct = target > 0 ? (balance / target) * 100 : 0;
  const outstanding = Math.max(0, target - balance);
  const nextAmount = Number(plan?.amount ?? (linkedPlan?.amount ?? 0));
  const nextDate = linkedPlan?.next_run_at ? formatShort(new Date(linkedPlan.next_run_at)) : "—";
  const paidCount = installments.filter((i) => i.status === "paid").length;
  const kind = plan ? "DPS" : "GOAL";
  const tint = plan ? "from-[#0EA5E9] to-[#009688]" : "from-[#009688] to-[#2ECC71]";
  const HeaderIcon = plan ? Landmark : Target;

  const primaryLabel = plan ? "Pay Installment" : "Add Deposit";
  const primaryKey: "deposit" | "installment" = plan ? "installment" : "deposit";

  async function confirmAction() {
    const value = parseFloat(amt);
    if (!(value > 0) || !user) return;
    setSubmitting(true);
    try {
      if (goal) {
        const { error } = await supabase
          .from("savings_goals")
          .update({ saved_amount: Number(goal.saved_amount) + value })
          .eq("id", goal.id);
        if (error) throw error;
        const { data: dep } = await supabase
          .from("savings_deposits")
          .insert({ goal_id: goal.id, user_id: user.id, amount: value, source: actionSheet === "installment" ? "installment" : "manual" })
          .select("id, amount, created_at")
          .single();
        if (dep) setDeposits((prev) => [...prev, { ...dep, amount: Number(dep.amount) }]);
      }
      if (plan && actionSheet === "installment") {
        const { error } = await supabase
          .from("savings_auto_save")
          .update({
            total_paid: (plan.total_paid ?? 0) + 1,
            last_run_at: new Date().toISOString(),
          })
          .eq("id", plan.id);
        if (error) throw error;
      }
      toast.success(actionSheet === "installment" ? "Installment recorded" : "Deposit added");
      setActionSheet(null);
      setAmt("");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (actionSheet && !amt && nextAmount > 0) setAmt(String(nextAmount));
  }, [actionSheet, nextAmount, amt]);

  return (
    <div className="min-h-dvh bg-[#0B1220] text-white pb-32">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#009688]/25 blur-3xl" />
        <div className="absolute top-40 -right-20 h-[280px] w-[280px] rounded-full bg-[#F4C542]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-md px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Journey</div>
            <div className="text-sm font-semibold">Installment Timeline</div>
          </div>
          <div className="h-10 w-10" aria-hidden />
        </div>

        {loadingState && (
          <div className="mt-16 flex flex-col items-center gap-3 text-white/60">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <div className="text-sm">Loading timeline…</div>
          </div>
        )}

        {notFound && (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <AlertTriangle size={22} className="mx-auto text-amber-400" />
            <div className="mt-2 text-base font-semibold">Not found</div>
            <p className="mt-1 text-sm text-white/60">
              This {type === "dps" ? "DPS plan" : "goal"} could not be located.
            </p>
            <button
              onClick={() => navigate("/savings")}
              className="mt-4 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold"
            >
              Back to Savings
            </button>
          </div>
        )}

        {!loadingState && !notFound && (
          <>
            {/* Summary card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-5"
            >
              <div className={cn("absolute inset-0 opacity-30 bg-gradient-to-br", tint)} />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg backdrop-blur">
                        {plan ? <HeaderIcon size={18} /> : <span>{emoji}</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-white/60">{kind}</div>
                        <div className="truncate text-base font-semibold">{displayName}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-[11px] text-white/60">Current Balance</div>
                      <div className="text-3xl font-bold tabular-nums">{bdt(balance)}</div>
                      <div className="mt-1 text-[11px] text-white/60">
                        of <span className="tabular-nums text-white/80">{bdt(target)}</span> target
                      </div>
                    </div>
                  </div>
                  <Ring value={pct} />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: "Outstanding", value: bdt(outstanding) },
                    { label: "Next Amt", value: nextAmount > 0 ? bdt(nextAmount) : "—" },
                    { label: "Due", value: nextDate },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-2.5">
                      <div className="text-[9px] uppercase tracking-wider text-white/50">{s.label}</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums">{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-white/50">Progress</div>
                      <div className="text-sm font-semibold">{Math.round(pct)}% complete</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F4C542] to-amber-500 px-2.5 py-1 text-[10px] font-bold text-black">
                    <Trophy size={11} /> Streak {paidCount}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Section title */}
            <div className="mt-6 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Timeline</div>
                <div className="text-lg font-bold">Milestones</div>
              </div>
              <div className="text-[11px] text-white/60">
                {paidCount}/{installments.length} paid
              </div>
            </div>

            {/* Timeline */}
            <div className="mt-4 space-y-5">
              {installments.map((it, idx) => (
                <MilestoneRow
                  key={it.n}
                  item={it}
                  side={idx % 2 === 0 ? "left" : "right"}
                  isLast={idx === installments.length - 1}
                />
              ))}
              {installments.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/60">
                  No installments yet.
                </div>
              )}
            </div>

            {/* AI Insight */}
            {nextAmount > 0 && outstanding > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-8 rounded-[22px] border border-[#F4C542]/30 bg-gradient-to-br from-[#F4C542]/10 to-transparent p-4 backdrop-blur"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#F4C542]">
                  <Sparkles size={12} /> AI Insight
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                  Add <span className="font-bold text-[#F4C542]">{bdt(Math.round(nextAmount * 0.2))}</span> extra per
                  cycle to finish <span className="font-semibold">{displayName}</span> faster.
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Sticky action bar */}
      {!loadingState && !notFound && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0B1220]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
            <button
              onClick={() => { setAmt(""); setActionSheet(primaryKey); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#009688] via-[#2ECC71] to-[#F4C542] px-4 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              {plan ? <Coins size={16} /> : <Wallet size={16} />} {primaryLabel}
            </button>
            {plan && (
              <button
                onClick={() => { setAmt(""); setActionSheet("deposit"); }}
                aria-label="Extra deposit"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white active:scale-95"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action sheet */}
      <AnimatePresence>
        {actionSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
            onClick={() => !submitting && setActionSheet(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-md rounded-t-[24px] border-t border-white/10 bg-[#111827] p-5 pb-8"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/50">{displayName}</div>
              <div className="mb-4 text-lg font-bold">
                {actionSheet === "installment" ? "Pay Installment" : "Add Deposit"}
              </div>
              <label className="text-[11px] text-white/60">Amount (৳)</label>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder={String(nextAmount || 500)}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold tabular-nums text-white outline-none focus:border-emerald-400/50"
              />
              {nextAmount > 0 && (
                <div className="mt-3 flex gap-2">
                  {[nextAmount, nextAmount * 2, nextAmount * 3].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmt(String(v))}
                      className="flex-1 rounded-full border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-white/80"
                    >
                      {bdt(v)}
                    </button>
                  ))}
                </div>
              )}
              <button
                disabled={!(parseFloat(amt) > 0) || submitting}
                onClick={confirmAction}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#009688] to-[#2ECC71] py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {submitting ? "Processing…" : `Confirm ${actionSheet === "installment" ? "Installment" : "Deposit"}`}
              </button>
              <button
                disabled={submitting}
                onClick={() => setActionSheet(null)}
                className="mt-2 w-full py-2 text-xs font-medium text-white/50"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
