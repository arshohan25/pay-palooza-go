import { useMemo, useState } from "react";
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
  X,
  Landmark,
  PiggyBank,
  Coins,
  Home,
  Car,
  GraduationCap,
  Plane,
  Sparkles,
  TrendingUp,
  Calendar,
  Filter,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

/* ---------- Types & mock data ---------- */

type Status = "paid" | "upcoming" | "due" | "overdue" | "goal" | "completed";

interface Installment {
  n: number;
  amount: number;
  remaining: number;
  dueDate: string;
  paidDate?: string;
  status: Status;
}

type Category = "all" | "savings" | "dps" | "loan" | "goal";

const PRODUCTS = [
  {
    id: "hajj",
    category: "goal" as Category,
    name: "Hajj Fund 2028",
    icon: Sparkles,
    tint: "from-[#009688] to-[#2ECC71]",
    balance: 128000,
    target: 450000,
    outstanding: 322000,
    nextAmount: 8000,
    nextDate: "12 Aug",
    monthly: 8000,
    health: 86,
  },
  {
    id: "dps",
    category: "dps" as Category,
    name: "DPS · Sonali 5yr",
    icon: Landmark,
    tint: "from-[#0EA5E9] to-[#009688]",
    balance: 96000,
    target: 300000,
    outstanding: 204000,
    nextAmount: 5000,
    nextDate: "05 Aug",
    monthly: 5000,
    health: 92,
  },
  {
    id: "car",
    category: "loan" as Category,
    name: "Car EMI · Toyota",
    icon: Car,
    tint: "from-[#F59E0B] to-[#F4C542]",
    balance: 640000,
    target: 1200000,
    outstanding: 560000,
    nextAmount: 22500,
    nextDate: "28 Jul",
    monthly: 22500,
    health: 74,
  },
];

const FILTERS: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "savings", label: "Savings" },
  { id: "dps", label: "DPS" },
  { id: "loan", label: "Loan" },
  { id: "goal", label: "Goals" },
];

function buildInstallments(product: typeof PRODUCTS[number]): Installment[] {
  const total = 12;
  const paidCount = Math.floor((product.balance / product.target) * total);
  const arr: Installment[] = [];
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  let running = 0;
  for (let i = 0; i < total; i++) {
    running += product.monthly;
    let status: Status = "upcoming";
    if (i < paidCount) status = "paid";
    else if (i === paidCount) status = "due";
    else if (i === paidCount + 1) status = "upcoming";
    if (i === total - 1) status = i < paidCount ? "completed" : status;
    arr.push({
      n: i + 1,
      amount: product.monthly,
      remaining: Math.max(product.target - running, 0),
      dueDate: `${5 + i} ${months[i % months.length]}`,
      paidDate: i < paidCount ? `${3 + i} ${months[i % months.length]}` : undefined,
      status,
    });
  }
  // Sprinkle an overdue node for realism
  if (paidCount > 2) arr[paidCount - 1].status = "paid";
  return arr;
}

/* ---------- Small UI pieces ---------- */

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
  goal: {
    label: "Goal Reached",
    ring: "border-[#F4C542]/50 bg-[#F4C542]/10 text-[#F4C542]",
    dot: "bg-gradient-to-br from-[#F4C542] to-amber-600 shadow-[0_0_28px_rgba(244,197,66,0.7)]",
    glow: "",
    icon: Target,
  },
  completed: {
    label: "Completed",
    ring: "border-[#F4C542]/50 bg-[#F4C542]/10 text-[#F4C542]",
    dot: "bg-gradient-to-br from-[#F4C542] to-orange-500 shadow-[0_0_32px_rgba(244,197,66,0.85)]",
    glow: "",
    icon: Trophy,
  },
};

const bdt = (n: number) => `৳${n.toLocaleString("en-BD")}`;

/* ---------- Circular progress ---------- */

function Ring({ value, size = 120, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
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
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white tabular-nums">{value}%</span>
        <span className="text-[10px] uppercase tracking-widest text-white/60">complete</span>
      </div>
    </div>
  );
}

/* ---------- Milestone row ---------- */

function MilestoneRow({ item, side, isLast }: { item: Installment; side: "left" | "right"; isLast: boolean }) {
  const meta = STATUS_META[item.status];
  const Icon = meta.icon;
  const amountCard = (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)]"
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
      {item.paidDate && (
        <div className="mt-1 text-[10px] text-emerald-300/80">Paid · {item.paidDate}</div>
      )}
      <div className={cn("mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.ring)}>
        <Icon size={10} />
        {meta.label}
      </div>
    </motion.div>
  );

  return (
    <div className="relative grid grid-cols-[1fr_44px_1fr] items-center gap-2">
      <div className={side === "left" ? "block" : "invisible"}>{side === "left" ? amountCard : dateCard}</div>

      {/* Center node + connector */}
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={cn(
            "z-10 flex h-10 w-10 items-center justify-center rounded-full ring-4 ring-background/80",
            meta.dot,
            meta.glow,
          )}
        >
          <Icon size={16} className="text-white" strokeWidth={2.5} />
        </motion.div>
        {!isLast && (
          <div className="absolute left-1/2 top-10 h-[calc(100%+0.5rem)] w-[2px] -translate-x-1/2 overflow-hidden">
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

      <div className={side === "right" ? "block" : "invisible"}>{side === "right" ? amountCard : dateCard}</div>

      {/* Actual opposite card rendered under the invisible placeholder */}
      <div className="pointer-events-none absolute inset-0 grid grid-cols-[1fr_44px_1fr] gap-2">
        <div className="pointer-events-auto">{side === "right" && amountCard}</div>
        <div />
        <div className="pointer-events-auto">{side === "left" && dateCard}</div>
      </div>
    </div>
  );
}

/* ---------- Floating action ---------- */

function FabMenu() {
  const [open, setOpen] = useState(false);
  const items = [
    { icon: PiggyBank, label: "Add Savings" },
    { icon: Landmark, label: "Add DPS" },
    { icon: Coins, label: "Add Loan" },
    { icon: Target, label: "Add Goal" },
    { icon: Plus, label: "Add Installment" },
  ];
  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 md:bottom-8">
      <AnimatePresence>
        {open &&
          items.map((it, i) => (
            <motion.button
              key={it.label}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3"
            >
              <span className="rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                {it.label}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#009688] to-[#2ECC71] text-white shadow-lg">
                <it.icon size={18} />
              </span>
            </motion.button>
          ))}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#009688] via-[#2ECC71] to-[#F4C542] text-white shadow-[0_10px_30px_-6px_rgba(46,204,113,0.6)]"
        aria-label="Add"
      >
        <motion.div animate={{ rotate: open ? 135 : 0 }} transition={{ type: "spring", stiffness: 300 }}>
          {open ? <X size={22} /> : <Plus size={22} />}
        </motion.div>
      </motion.button>
    </div>
  );
}

/* ---------- Page ---------- */

export default function InstallmentJourneyPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = params.get("type"); // 'goal' | 'dps' | 'loan' | null
  const initialId = params.get("id");
  const initial =
    PRODUCTS.find((p) => p.id === initialId) ||
    PRODUCTS.find((p) => p.category === initialType) ||
    PRODUCTS[0];
  const [productId, setProductId] = useState(initial.id);
  const [filter, setFilter] = useState<Category>("all");
  const [actionSheet, setActionSheet] = useState<null | "deposit" | "repay" | "installment">(null);
  const [amt, setAmt] = useState("");

  const product = PRODUCTS.find((p) => p.id === productId)!;
  const installments = useMemo(() => buildInstallments(product), [product]);
  const pct = Math.round((product.balance / product.target) * 100);
  const paidCount = installments.filter((i) => i.status === "paid").length;

  const primaryAction =
    product.category === "loan"
      ? { key: "repay" as const, label: "Repay Now", icon: Coins }
      : product.category === "dps"
        ? { key: "installment" as const, label: "Pay Installment", icon: Plus }
        : { key: "deposit" as const, label: "Deposit", icon: PiggyBank };

  const Icon = product.icon;

  return (
    <div className="min-h-dvh bg-[#0B1220] text-white pb-32">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#009688]/25 blur-3xl" />
        <div className="absolute top-40 -right-20 h-[280px] w-[280px] rounded-full bg-[#F4C542]/15 blur-3xl" />
        <div className="absolute top-[60vh] -left-20 h-[280px] w-[280px] rounded-full bg-[#2ECC71]/15 blur-3xl" />
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
          <button
            aria-label="Filter"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur"
          >
            <Filter size={16} />
          </button>
        </div>

        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-5 shadow-[0_20px_60px_-20px_rgba(0,150,136,0.5)]"
        >
          <div className={cn("absolute inset-0 opacity-30 bg-gradient-to-br", product.tint)} />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/60">{product.category}</div>
                    <div className="text-base font-semibold">{product.name}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-[11px] text-white/60">Current Balance</div>
                  <div className="text-3xl font-bold tabular-nums">{bdt(product.balance)}</div>
                  <div className="mt-1 text-[11px] text-white/60">
                    of <span className="tabular-nums text-white/80">{bdt(product.target)}</span> target
                  </div>
                </div>
              </div>
              <Ring value={pct} />
            </div>

            {/* Sub-stats */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Outstanding", value: bdt(product.outstanding) },
                { label: "Next Amount", value: bdt(product.nextAmount) },
                { label: "Due", value: product.nextDate },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-white/50">{s.label}</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Health + badge */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50">Health Score</div>
                  <div className="text-sm font-semibold">{product.health} / 100 · Excellent</div>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F4C542] to-amber-500 px-2.5 py-1 text-[10px] font-bold text-black">
                <Trophy size={11} /> Streak {paidCount}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Product switcher */}
        <div className="mt-5 flex gap-2 overflow-x-auto scrollbar-none">
          {PRODUCTS.map((p) => {
            const active = p.id === productId;
            return (
              <button
                key={p.id}
                onClick={() => setProductId(p.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-transparent bg-gradient-to-r from-[#009688] to-[#2ECC71] text-white shadow-lg"
                    : "border-white/10 bg-white/5 text-white/70",
                )}
              >
                <p.icon size={12} /> {p.name}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all",
                  active ? "bg-white text-[#0B1220]" : "border border-white/10 bg-white/5 text-white/60",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Section title */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Journey</div>
            <div className="text-lg font-bold">Milestone Timeline</div>
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
        </div>

        {/* Smart insight */}
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
            Increase your monthly contribution by <span className="font-bold text-[#F4C542]">৳1,500</span> to reach{" "}
            <span className="font-semibold">{product.name}</span> 3 months earlier.
          </p>
          <button className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">
            Apply suggestion <ChevronRight size={12} />
          </button>
        </motion.div>

        {/* Categories chip row (visual) */}
        <div className="mt-8">
          <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-white/50">Goal Categories</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Home, label: "House" },
              { icon: Car, label: "Car" },
              { icon: GraduationCap, label: "Edu" },
              { icon: Plane, label: "Travel" },
            ].map((c) => (
              <button
                key={c.label}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#009688]/40 to-[#2ECC71]/40">
                  <c.icon size={16} />
                </span>
                <span className="text-[11px] font-medium">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0B1220]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <button
            onClick={() => { setAmt(""); setActionSheet(primaryAction.key); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#009688] via-[#2ECC71] to-[#F4C542] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-6px_rgba(46,204,113,0.5)] active:scale-[0.98]"
          >
            <primaryAction.icon size={16} />
            {primaryAction.label}
          </button>
          {product.category !== "loan" && (
            <button
              onClick={() => { setAmt(""); setActionSheet("installment"); }}
              aria-label="Add installment"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white active:scale-95"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Action sheet */}
      <AnimatePresence>
        {actionSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
            onClick={() => setActionSheet(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-md rounded-t-[24px] border-t border-white/10 bg-[#111827] p-5 pb-8"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
                {product.name}
              </div>
              <div className="mb-4 text-lg font-bold">
                {actionSheet === "deposit" && "Add Deposit"}
                {actionSheet === "repay" && "Loan Repayment"}
                {actionSheet === "installment" && "Pay Installment"}
              </div>
              <label className="text-[11px] text-white/60">Amount (৳)</label>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder={String(product.nextAmount)}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold tabular-nums text-white outline-none focus:border-emerald-400/50"
              />
              <div className="mt-3 flex gap-2">
                {[product.nextAmount, product.nextAmount * 2, product.nextAmount * 3].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmt(String(v))}
                    className="flex-1 rounded-full border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-white/80"
                  >
                    {bdt(v)}
                  </button>
                ))}
              </div>
              <button
                disabled={!(parseFloat(amt) > 0)}
                onClick={() => setActionSheet(null)}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#009688] to-[#2ECC71] py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Confirm {actionSheet === "repay" ? "Repayment" : actionSheet === "installment" ? "Installment" : "Deposit"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
