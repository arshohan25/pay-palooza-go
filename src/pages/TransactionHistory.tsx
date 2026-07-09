import { useState, useMemo } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, isBefore } from "date-fns";
import {
  Search, X, CalendarIcon, SlidersHorizontal,
  CheckCircle2, Copy, Hash, Tag, Clock, User, FileText, RefreshCw, Share2, Coins, TrendingUp, BadgeDollarSign, ChevronDown, AlertCircle, Phone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import { useTransactions, DbTransaction } from "@/hooks/use-transactions";
import {
  TxSendIcon, TxReceiveIcon, TxCashOutIcon,
  TxRechargeIcon, TxBillIcon, TxBankIcon, TxPaymentIcon, TxBankTransferIcon,
  TxCashbackIcon,
} from "@/components/QuickActionIcons";

// ─── Types ───────────────────────────────────────────────────────────────────
type TxCategory = "all" | "send" | "receive" | "cashout" | "cashin" | "banktransfer" | "payment" | "recharge" | "paybill" | "addmoney";

const AGENT_COMMISSION_RATES: Record<string, number> = {
  cashin: 0.49,
  cashout: 0.49,
  paybill: 0.019,
};

interface Transaction {
  id: string;
  short_id: string;
  category: Exclude<TxCategory, "all">;
  name: string;
  detail: string;
  date: string;
  amount: number;
  fee: number;
  commission: number;
  _isCashback?: boolean;
  _isInvestment?: boolean;
  status: string;
  recipient_phone?: string | null;
}

const CATEGORY_KEYS: { id: TxCategory; key: string }[] = [
  { id: "all",          key: "thAll" },
  { id: "send",         key: "thSend" },
  { id: "receive",      key: "thReceived" },
  { id: "cashout",      key: "thCashOut" },
  { id: "cashin",       key: "thCashIn" },
  { id: "payment",      key: "thPayment" },
  { id: "banktransfer", key: "thBankTransfer" },
  { id: "recharge",     key: "thRecharge" },
  { id: "paybill",      key: "thBillPay" },
  { id: "addmoney",     key: "thAddMoney" },
];

// Illustrated icon config for each transaction category
const TX_ICON_MAP: Record<Exclude<TxCategory, "all">, {
  Icon: () => JSX.Element;
  ReceiveIcon: () => JSX.Element;
  bg: string;
  ring: string;
  receiveBg: string;
  receiveRing: string;
}> = {
  send:     { Icon: TxSendIcon,    ReceiveIcon: TxReceiveIcon, bg: "rgba(233,30,140,0.12)", ring: "1px solid rgba(233,30,140,0.2)",  receiveBg: "rgba(76,175,80,0.12)",  receiveRing: "1px solid rgba(76,175,80,0.2)"  },
  receive:  { Icon: TxReceiveIcon, ReceiveIcon: TxReceiveIcon, bg: "rgba(76,175,80,0.12)",  ring: "1px solid rgba(76,175,80,0.2)",   receiveBg: "rgba(76,175,80,0.12)",  receiveRing: "1px solid rgba(76,175,80,0.2)"  },
  cashout:  { Icon: TxCashOutIcon, ReceiveIcon: TxCashOutIcon, bg: "rgba(255,152,0,0.12)",  ring: "1px solid rgba(255,152,0,0.2)",   receiveBg: "rgba(255,152,0,0.12)",  receiveRing: "1px solid rgba(255,152,0,0.2)"  },
  cashin:   { Icon: TxCashOutIcon, ReceiveIcon: TxCashOutIcon, bg: "rgba(76,175,80,0.12)",  ring: "1px solid rgba(76,175,80,0.2)",   receiveBg: "rgba(76,175,80,0.12)",  receiveRing: "1px solid rgba(76,175,80,0.2)"  },
  payment:  { Icon: TxPaymentIcon, ReceiveIcon: TxReceiveIcon, bg: "rgba(156,39,176,0.12)", ring: "1px solid rgba(156,39,176,0.2)", receiveBg: "rgba(76,175,80,0.12)",  receiveRing: "1px solid rgba(76,175,80,0.2)"  },
  recharge: { Icon: TxRechargeIcon,ReceiveIcon: TxReceiveIcon, bg: "rgba(0,188,212,0.12)",  ring: "1px solid rgba(0,188,212,0.2)",  receiveBg: "rgba(76,175,80,0.12)",  receiveRing: "1px solid rgba(76,175,80,0.2)"  },
  paybill:  { Icon: TxBillIcon,    ReceiveIcon: TxReceiveIcon, bg: "rgba(255,193,7,0.12)",  ring: "1px solid rgba(255,193,7,0.2)",  receiveBg: "rgba(76,175,80,0.12)",  receiveRing: "1px solid rgba(76,175,80,0.2)"  },
  addmoney: { Icon: TxBankIcon,    ReceiveIcon: TxReceiveIcon, bg: "rgba(25,118,210,0.12)", ring: "1px solid rgba(25,118,210,0.2)", receiveBg: "rgba(76,175,80,0.12)",  receiveRing: "1px solid rgba(76,175,80,0.2)"  },
  banktransfer: { Icon: TxBankTransferIcon, ReceiveIcon: TxBankTransferIcon, bg: "rgba(63,81,181,0.12)", ring: "1px solid rgba(63,81,181,0.2)", receiveBg: "rgba(63,81,181,0.12)", receiveRing: "1px solid rgba(63,81,181,0.2)" },
};

const relativeDate = (iso: string, t: (k: string) => string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return `${t("thToday")} · ${format(d, "h:mm a")}`;
  if (d.toDateString() === yesterday.toDateString()) return `${t("thYesterday")} · ${format(d, "h:mm a")}`;
  return format(d, "dd MMM yyyy · h:mm a");
};

interface TransactionHistoryProps { onClose?: () => void; onRefresh?: () => void; filterTypes?: TxCategory[]; agentView?: boolean; customLabels?: Record<string, string>; }

const TransactionHistory = ({ onClose, onRefresh, filterTypes, agentView, customLabels }: TransactionHistoryProps) => {
  const { t } = useI18n();
  const CATEGORIES = useMemo(() => CATEGORY_KEYS.map((c) => ({ id: c.id, label: t(c.key as any) })), [t]);
  const runningMonthStart = useMemo(() => startOfMonth(new Date()), []);
  const runningMonthEnd = useMemo(() => endOfDay(new Date()), []);
  const { transactions: dbTxns, loading: txLoading, refetch } = useTransactions(100, undefined);
  const [activeTab, setActiveTab] = useState<TxCategory>("all");
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo]       = useState<Date | undefined>(undefined);
  const [fromOpen, setFromOpen]   = useState(false);
  const [toOpen, setToOpen]       = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTx, setSelectedTx]   = useState<Transaction | null>(null);
  const [copied, setCopied]           = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showShare, setShowShare]       = useState(false);

  // Map DB transactions to local Transaction shape
  const allTransactions: Transaction[] = useMemo(() =>
    dbTxns
      .filter((tx) => !filterTypes || filterTypes.includes(tx.type as TxCategory))
      .map((tx) => {
        const cfg = TX_ICON_MAP[tx.type as Exclude<TxCategory, "all">];
        const isCashback = tx.type === "addmoney" && (tx.description?.startsWith("Drive Cashback:") || tx.reference?.startsWith("CB-") || false);
        const isInvestment =
          (tx.description?.startsWith("Gold Purchase:") ||
            tx.description?.startsWith("Gold Sale:") ||
            tx.description?.startsWith("Stock Purchase:") ||
            tx.description?.startsWith("Stock Sale:") ||
            tx.reference?.startsWith("GOLD-BUY-") ||
            tx.reference?.startsWith("GOLD-SELL-") ||
            tx.reference?.startsWith("STOCK-BUY-") ||
            tx.reference?.startsWith("STOCK-SELL-")) ?? false;
        const label = isCashback ? t("thDriveCashback") : (CATEGORIES.find((c) => c.id === tx.type)?.label ?? tx.type);
        const isCredit = agentView
          ? tx.type === "cashout"
          : tx.type === "addmoney" || tx.type === "receive" || tx.type === "cashin";
        const agentName = agentView
          ? (tx.type === "cashout" ? t("thCashOutReceived") : tx.type === "cashin" ? t("thCashInSent") : undefined)
          : undefined;
        const agentDetail = agentView
          ? (tx.type === "cashout" ? t("thCashOutReceived") : tx.type === "cashin" ? t("thCashInSent") : undefined)
          : undefined;
        return {
          id: tx.id,
          short_id: tx.short_id || tx.id.slice(0, 12).toUpperCase(),
          category: tx.type as Exclude<TxCategory, "all">,
          name: agentName || (isCashback
            ? (tx.description?.replace("Drive Cashback: ", "") || t("thCashback"))
            : (tx.recipient_name || tx.description || label)),
          detail: agentDetail || (isCashback ? t("thDriveCashback") : (tx.description || label)),
          date: tx.created_at,
          amount: isCredit ? tx.amount : -tx.amount,
          fee: tx.fee,
          commission: tx.commission || 0,
          _isCashback: isCashback,
          _isInvestment: isInvestment,
          status: tx.status,
          recipient_phone: tx.recipient_phone,
        };
      }), [dbTxns, filterTypes, t, agentView, CATEGORIES]);

  const triggerRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    refetch().finally(() => setIsRefreshing(false));
    onRefresh?.();
  };

  usePullToRefresh({ onRefresh: triggerRefresh });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return allTransactions.filter((tx) => {
      if (activeTab !== "all" && tx.category !== activeTab) return false;
      if (q) {
        const matchesName = tx.name.toUpperCase().includes(q);
        const matchesDetail = tx.detail.toUpperCase().includes(q);
        const matchesId = tx.short_id.toUpperCase().includes(q);
        if (!matchesName && !matchesDetail && !matchesId) return false;
      }
      if (dateFrom || dateTo) {
        const txDate = new Date(tx.date);
        const from = dateFrom ? startOfDay(dateFrom) : new Date(0);
        const to   = dateTo  ? endOfDay(dateTo)     : new Date(8640000000000000);
        if (!isWithinInterval(txDate, { start: from, end: to })) return false;
      }
      return true;
    });
  }, [activeTab, search, dateFrom, dateTo, allTransactions]);

  const clearFilters    = () => { setDateFrom(runningMonthStart); setDateTo(runningMonthEnd); setSearch(""); setActiveTab("all"); };
  const dateScopeChanged = Boolean(
    (dateFrom && isBefore(startOfDay(runningMonthStart), startOfDay(dateFrom))) ||
    (dateTo && isBefore(endOfDay(dateTo), runningMonthEnd)) ||
    !dateFrom ||
    !dateTo
  );
  const hasActiveFilters = search || activeTab !== "all" || dateScopeChanged;

  // DB-backed running-month totals for summary chips (ignores search/category filters)
  const { monthIn, monthOut, monthFees, monthCommission } = useMemo(() => {
    return {
      monthIn: allTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      monthOut: allTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
      monthFees: allTransactions.reduce((s, t) => s + (t.fee || 0), 0),
      monthCommission: allTransactions.reduce((s, t) => s + (t.commission || 0), 0),
    };
  }, [allTransactions]);

  const totalFees = filtered.reduce((s, t) => s + (t.fee || 0), 0);
  const totalCommission = filtered.reduce((s, t) => s + (t.commission || 0), 0);

  return (
    <div className="flex flex-col w-full">

      {/* ── Pull-to-refresh indicator ────────────────────────────────────── */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            key="ptr"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 40 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-2 text-primary text-sm font-semibold mb-2"
          >
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
              <RefreshCw size={16} />
            </motion.div>
            {t("refreshing")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="gradient-hero px-4 pt-5 pb-5 text-primary-foreground rounded-2xl mb-3 w-full box-border">
        {/* Top row */}
        <div className="flex items-center gap-2 mb-4 w-full min-w-0">
          <h1 className="text-[16px] font-bold flex-1 min-w-0 truncate">{t("transactionHistory")}</h1>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={triggerRefresh}
            className="glass-hero w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0"
            aria-label={t("thRefresh")}
          >
            <motion.div animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }} transition={{ repeat: isRefreshing ? Infinity : 0, duration: 0.8, ease: "linear" }}>
              <RefreshCw size={15} />
            </motion.div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowFilters((v) => !v)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              showFilters || dateScopeChanged || search || activeTab !== "all"
                ? "bg-white text-primary"
                : "glass-hero"
            }`}
            aria-label={t("thToggleFilters")}
          >
            <SlidersHorizontal size={15} />
          </motion.button>
        </div>

        {/* Summary chips — strict 3-col grid */}
        <div className="grid grid-cols-3 gap-2 w-full mb-3">
          {[
            { label: t("moneyIn"),  value: `+৳${monthIn.toLocaleString("en-IN")}`,  color: "text-green-300" },
            { label: t("moneyOut"), value: `-৳${monthOut.toLocaleString("en-IN")}`, color: "text-rose-300"  },
            agentView
              ? { label: t("thCommission"), value: `৳${monthCommission.toLocaleString("en-IN")}`, color: "text-emerald-300" }
              : { label: t("thFees"),       value: `৳${monthFees.toLocaleString("en-IN")}`,       color: "text-amber-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-hero rounded-2xl px-2 py-2.5 text-center min-w-0 overflow-hidden">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/60 mb-0.5 truncate">{label}</p>
              <p className={`text-[12px] font-bold leading-tight truncate ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search bar inside hero */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
          <Input
            placeholder={`${t("searchTransactions")} ${t("thOrTxnId")}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10 bg-white/10 border-white/15 rounded-2xl text-[13px] text-white placeholder:text-white/40 focus-visible:ring-white/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white tap-target"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Fee breakdown summary (non-agent only) ────────────────────── */}
      {!agentView && totalFees > 0 && (() => {
        const feeByType: Record<string, number> = {};
        filtered.forEach((tx) => {
          if (tx.fee > 0) {
            const label = tx._isInvestment
              ? t("thBrokerageFee")
              : (CATEGORIES.find((c) => c.id === tx.category)?.label ?? tx.category);
            feeByType[label] = (feeByType[label] || 0) + tx.fee;
          }
        });
        const entries = Object.entries(feeByType).sort((a, b) => b[1] - a[1]);
        return (
          <FeeBreakdownSummary entries={entries} totalFees={totalFees} />
        );
      })()}

      {/* ── Commission breakdown summary (agent view only) ─────────────── */}
      {agentView && totalCommission > 0 && (() => {
        const commByType: Record<string, number> = {};
        filtered.forEach((tx) => {
          if (tx.commission > 0) {
            const label = CATEGORIES.find((c) => c.id === tx.category)?.label ?? tx.category;
            commByType[label] = (commByType[label] || 0) + tx.commission;
          }
        });
        const entries = Object.entries(commByType).sort((a, b) => b[1] - a[1]);
        return (
          <CommissionBreakdownSummary entries={entries} totalCommission={totalCommission} />
        );
      })()}


      {/* ── Date filters (collapsible) ───────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden mb-2"
          >
            <div className="flex gap-2 items-center">
              {/* From */}
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 h-10 text-[12px] justify-start border-border/60 bg-card rounded-2xl font-normal shadow-xs min-w-0",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon size={13} className="mr-1.5 shrink-0" />
                    <span className="truncate">{dateFrom ? format(dateFrom, "dd MMM yy") : t("from")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]" align="start">
                  <Calendar mode="single" selected={dateFrom}
                    onSelect={(d) => { setDateFrom(d); setFromOpen(false); }}
                    disabled={(d) => d > new Date()} initialFocus
                    className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>

              {/* To */}
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 h-10 text-[12px] justify-start border-border/60 bg-card rounded-2xl font-normal shadow-xs min-w-0",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon size={13} className="mr-1.5 shrink-0" />
                    <span className="truncate">{dateTo ? format(dateTo, "dd MMM yy") : t("to")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]" align="start">
                  <Calendar mode="single" selected={dateTo}
                    onSelect={(d) => { setDateTo(d); setToOpen(false); }}
                    disabled={(d) => d > new Date() || (dateFrom ? d < dateFrom : false)} initialFocus
                    className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>

              {(dateFrom || dateTo) && (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                  className="w-10 h-10 rounded-2xl bg-muted border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X size={14} />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category tabs ─────────────────────────────────────────────────── */}
      <div className="mb-2">
        <div
          className="flex gap-1.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {CATEGORIES.filter((cat) => !filterTypes || cat.id === "all" || filterTypes.includes(cat.id)).map((cat) => {
            const active = activeTab === cat.id;
            const label = customLabels?.[cat.id] ?? cat.label;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => setActiveTab(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                  active
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "bg-card border border-border/60 text-muted-foreground hover:text-foreground shadow-xs"
                }`}
              >
                {label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Active filters row ────────────────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11.5px] text-muted-foreground font-medium">
            {filtered.length} {filtered.length !== 1 ? t("results") : t("result")}
          </p>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={clearFilters}
            className="text-[11.5px] font-semibold text-primary flex items-center gap-1"
          >
            <X size={11} /> {t("clearAll")}
          </motion.button>
        </div>
      )}

      {/* ── Transaction list ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center justify-center py-16 gap-3"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"
            >
              <Search size={26} className="text-muted-foreground" />
            </motion.div>
            <p className="text-[14px] font-bold text-foreground">{t("noTransactionsFound")}</p>
            <p className="text-[12px] text-muted-foreground text-center max-w-[220px] leading-relaxed">
              {t("adjustFilters")}
            </p>
            <button onClick={clearFilters} className="text-[12px] font-semibold text-primary mt-1">
              {t("clearFilters")}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={`${activeTab}-${search}-${dateFrom?.toISOString()}-${dateTo?.toISOString()}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden w-full"
          >
            {filtered.map((tx, i) => {
              const cfg      = TX_ICON_MAP[tx.category];
              const isCredit = tx.amount > 0;
              const isCB     = tx._isCashback;
              const IconComp = isCB ? TxCashbackIcon : (isCredit ? cfg.ReceiveIcon : cfg.Icon);
              const bgStyle  = isCB ? "rgba(245,158,11,0.15)" : (isCredit ? cfg.receiveBg : cfg.bg);
              const ringStyle = isCB ? "1px solid rgba(245,158,11,0.3)" : (isCredit ? cfg.receiveRing : cfg.ring);

              return (
                <motion.button
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.035, ease: [0.23, 1, 0.32, 1] }}
                  onClick={() => setSelectedTx(tx)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors border-b border-border/50 last:border-0 text-left ${
                    isCB ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                  }`}
                >
                  {/* Illustrated icon circle */}
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: bgStyle, outline: ringStyle }}
                  >
                    <IconComp />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13.5px] font-semibold text-foreground truncate">{tx.name}</p>
                      {isCB && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Coins size={9} /> CASHBACK
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{tx.detail}</p>
                    {agentView && tx.commission > 0 && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{t("thCommission")}: ৳{tx.commission.toLocaleString("en-IN")}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10.5px] text-muted-foreground/60">{relativeDate(tx.date, t)}</p>
                      {tx.status === "pending" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Clock size={9} /> PENDING
                        </span>
                      )}
                      {tx.status === "failed" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive">
                          <AlertCircle size={9} /> REJECTED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right max-w-[90px]">
                    <div className="flex items-center justify-end gap-1">
                      {agentView ? (
                        tx.commission > 0 && (
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TrendingUp size={12} className="text-emerald-500/70 dark:text-emerald-400/70 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">
                                {t("thCommission")}: ৳{tx.commission.toLocaleString("en-IN")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      ) : (
                        tx.fee > 0 && (
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <BadgeDollarSign size={12} className="text-amber-500/70 dark:text-amber-400/70 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">
                                {t("thFee")}: ৳{tx.fee.toLocaleString("en-IN")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      )}
                      <span className={`text-[13px] font-bold ${isCB ? "text-amber-600 dark:text-amber-400" : isCredit ? "text-primary" : "text-foreground"}`}>
                        {isCredit ? "+" : "−"}৳{Math.abs(tx.amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for bottom nav */}
      <div className="h-4" />

      {/* ── Transaction Detail Sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTx && (() => {
          const cfg       = TX_ICON_MAP[selectedTx.category];
          const isCredit  = selectedTx.amount > 0;
          const IconComp  = isCredit ? cfg.ReceiveIcon : cfg.Icon;
          const bgStyle   = isCredit ? cfg.receiveBg : cfg.bg;
          const ringStyle = isCredit ? cfg.receiveRing : cfg.ring;
          const txDate    = new Date(selectedTx.date);
          const txId      = selectedTx.short_id;
          const baseAmount = Math.abs(selectedTx.amount);
          const summaryBaseLabel = isCredit ? t("thGrossAmount") : t("thPrincipal");
          const summaryFeeLabel = isCredit ? t("thFeeDeducted") : t("thFeeFromBalance");
          const summaryTotalLabel = isCredit ? t("thNetCredited") : t("thTotalDeducted");
          const summaryTotalAmount = isCredit ? Math.max(0, baseAmount - selectedTx.fee) : baseAmount + selectedTx.fee;
          const catLabel  = CATEGORIES.find((c) => c.id === selectedTx.category)?.label ?? selectedTx.category;

          return (
            <>
              {/* Backdrop */}
              <motion.div
                key="detail-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
                onClick={() => setSelectedTx(null)}
              />

              {/* Sheet */}
              <motion.div
                key="detail-sheet"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 34 }}
                className="fixed bottom-0 left-0 right-0 z-[71] bg-card rounded-t-3xl shadow-float
                           md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                           md:w-[90vw] md:max-w-md md:rounded-3xl"
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
                </div>
                <div className="hidden md:block pt-5" />

                {/* Close */}
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setSelectedTx(null)}
                  className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground tap-target"
                >
                  <X size={15} />
                </motion.button>

                <div className="px-5 pt-2 pb-8 max-h-[85vh] overflow-y-auto">
                  {/* Icon + amount */}
                  <div className="flex flex-col items-center mb-5">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: bgStyle, outline: ringStyle }}
                    >
                      <IconComp />
                    </div>
                    <p className="text-[26px] font-bold text-foreground">
                      {isCredit ? "+" : "−"}৳{Math.abs(selectedTx.amount).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">{selectedTx.detail}</p>
                    {selectedTx.status === "pending" ? (
                      <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <Clock size={12} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{t("thPending")}</span>
                      </div>
                    ) : selectedTx.status === "failed" ? (
                      <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-destructive/10">
                        <AlertCircle size={12} className="text-destructive" />
                        <span className="text-[11px] font-bold text-destructive">{t("thRejected")}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-primary/10">
                        <CheckCircle2 size={12} className="text-primary" />
                        <span className="text-[11px] font-bold text-primary">{t("thSuccessful")}</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-border/60 mb-3" />

                  {/* Detail rows */}
                  {[
                    { icon: Hash,     label: t("thTransactionId"), value: txId,                                   copy: true  },
                    { icon: User,     label: t("thNameParty"),   value: selectedTx.name,                        copy: false },
                    ...(selectedTx.recipient_phone ? [{ icon: Phone, label: t("thReceiverNumber"), value: selectedTx.recipient_phone, copy: true }] : []),
                    { icon: Tag,      label: t("thCategory"),       value: catLabel,                               copy: false },
                    ...(selectedTx.detail && !selectedTx.detail.includes("[Wallet:") && !selectedTx.detail.includes("Wallet:") && selectedTx.detail !== catLabel
                      ? [{ icon: FileText, label: t("thDescription"), value: selectedTx.detail, copy: false }] : []),
                    ...(agentView
                      ? (selectedTx.commission > 0 ? [{ icon: TrendingUp, label: t("thCommissionEarned"), value: `+৳${selectedTx.commission.toLocaleString("en-IN")}`, copy: false }] : [])
                      : (selectedTx.fee > 0 ? [{ icon: Coins, label: t("thChargeFee"), value: `৳${selectedTx.fee.toLocaleString("en-IN")}`, copy: false }] : [])
                    ),
                    { icon: Clock,    label: t("thDateTime"),    value: format(txDate, "dd MMM yyyy, h:mm a"), copy: false },
                  ].map(({ icon: RowIcon, label, value, copy }) => (
                    <div key={label} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
                      <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <RowIcon size={14} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-semibold">{label}</p>
                        <p className="text-[13px] font-semibold text-foreground mt-0.5 break-all leading-snug">{value}</p>
                      </div>
                      {copy && (
                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={() => handleCopy(value)}
                          className="shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground tap-target"
                        >
                          {copied ? <CheckCircle2 size={13} className="text-primary" /> : <Copy size={13} />}
                        </motion.button>
                      )}
                    </div>
                  ))}

                  {/* Amount highlight + fee/commission breakdown */}
                  {agentView && selectedTx.commission > 0 ? (
                    <div className="mt-4 rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-muted-foreground font-medium">{t("thTransactionAmount")}</span>
                        <span className="font-semibold text-foreground">৳{Math.abs(selectedTx.amount).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12.5px] mt-1.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {t("thCommissionEarned")}
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">+৳{selectedTx.commission.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-px bg-emerald-200/60 dark:bg-emerald-800/40 my-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-foreground">{t("thNetEarned")}</span>
                        <span className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400">+৳{selectedTx.commission.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  ) : agentView ? (
                    <div className={`mt-4 rounded-2xl p-4 ${isCredit ? "bg-primary/10" : "bg-muted/60"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-muted-foreground">{t("thTotalAmount")}</span>
                        <span className={`text-[20px] font-bold ${isCredit ? "text-primary" : "text-foreground"}`}>
                          {isCredit ? "+" : "−"}৳{Math.abs(selectedTx.amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 text-right font-medium">{t("thNoCommission")}</p>
                    </div>
                  ) : selectedTx.fee > 0 ? (
                    <div className="mt-4 rounded-2xl p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-muted-foreground font-medium">{summaryBaseLabel}</span>
                        <span className="font-semibold text-foreground">৳{baseAmount.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12.5px] mt-1.5">
                        <span className="text-amber-600 dark:text-amber-400 font-medium">{summaryFeeLabel}</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">৳{selectedTx.fee.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-px bg-amber-200/60 dark:bg-amber-800/40 my-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-foreground">{summaryTotalLabel}</span>
                        <span className="text-[18px] font-bold text-foreground">৳{summaryTotalAmount.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`mt-4 rounded-2xl p-4 ${isCredit ? "bg-primary/10" : "bg-muted/60"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-muted-foreground">{t("thTotalAmount")}</span>
                        <span className={`text-[20px] font-bold ${isCredit ? "text-primary" : "text-foreground"}`}>
                          {isCredit ? "+" : "−"}৳{Math.abs(selectedTx.amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-[11px] text-primary mt-1 text-right font-medium">{t("thNoFeeCharged")}</p>
                    </div>
                  )}

                  {/* Share button */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowShare(true)}
                    className="w-full mt-2 h-11 rounded-2xl border border-border bg-muted/40 flex items-center justify-center gap-2 text-sm font-semibold text-foreground hover:bg-muted/70 transition-colors"
                  >
                    <Share2 size={15} /> {t("thShareReceipt")}
                  </motion.button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* Share Receipt Sheet (from history detail) */}
      {selectedTx && (() => {
        const txDate = new Date(selectedTx.date);
        const txId   = selectedTx.short_id;
        const catLabel = CATEGORIES.find((c) => c.id === selectedTx.category)?.label ?? selectedTx.category;
        const baseAmount = Math.abs(selectedTx.amount);
        const summaryBaseLabel = selectedTx.amount > 0 ? t("thGrossAmount") : t("thPrincipal");
        const summaryFeeLabel = selectedTx.amount > 0 ? t("thFeeDeducted") : t("thFeeFromBalance");
        const summaryTotalLabel = selectedTx.amount > 0 ? t("thNetCredited") : t("thTotalDeducted");
        const summaryTotalAmount = selectedTx.amount > 0
          ? Math.max(0, baseAmount - selectedTx.fee)
          : baseAmount + selectedTx.fee;
        const gradMap: Record<string, string> = {
          send: "gradient-send", cashout: "gradient-cashout",
          payment: "gradient-payment", recharge: "gradient-accent",
          bill: "gradient-primary",
        };
        return (
          <ShareReceiptSheet
            open={showShare}
            onClose={() => setShowShare(false)}
            receipt={{
              title: catLabel,
              amount: `${selectedTx.amount > 0 ? "+" : "−"}৳${Math.abs(selectedTx.amount).toLocaleString("en-IN")}`,
              gradient: gradMap[selectedTx.category] ?? "gradient-primary",
              txnId: txId,
              rows: [
                { label: t("thParty"), value: selectedTx.name },
                ...(selectedTx.recipient_phone ? [{ label: t("thReceiver"), value: selectedTx.recipient_phone }] : []),
                { label: t("thCategory"), value: catLabel },
                ...(selectedTx.detail && !selectedTx.detail.includes("[Wallet:") && !selectedTx.detail.includes("Wallet:") && selectedTx.detail !== catLabel
                  ? [{ label: t("thNote"), value: selectedTx.detail }] : []),
                ...(agentView
                   ? (selectedTx.commission > 0 ? [{ label: t("thCommission"), value: `+৳${selectedTx.commission.toLocaleString("en-IN")}` }] : [])
                    : (selectedTx.fee > 0
                      ? [
                          { label: summaryBaseLabel, value: `৳${baseAmount.toLocaleString("en-IN")}` },
                          { label: summaryFeeLabel, value: `৳${selectedTx.fee.toLocaleString("en-IN")}` },
                          { label: summaryTotalLabel, value: `৳${summaryTotalAmount.toLocaleString("en-IN")}` },
                        ]
                     : [{ label: t("thFee"), value: t("thFree") }])
                ),
                { label: t("thDateTime"), value: format(txDate, "dd MMM yyyy, h:mm a") },
              ],
            }}
          />
        );
      })()}
    </div>
  );
};

// ─── Fee Breakdown Summary (collapsible) ──────────────────────────────────
const FeeBreakdownSummary = ({ entries, totalFees }: { entries: [string, number][]; totalFees: number }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-left"
      >
        <div className="flex items-center gap-2">
          <Coins size={14} className="text-amber-600 dark:text-amber-400" />
          <span className="text-[12px] font-semibold text-foreground">{t("thFeeBreakdown")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">৳{totalFees.toLocaleString("en-IN")}</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-muted-foreground" />
          </motion.div>
        </div>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-2 pb-1 space-y-1">
              {entries.map(([label, amount]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">৳{amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Commission Breakdown Summary (collapsible, agent view) ───────────────
const CommissionBreakdownSummary = ({ entries, totalCommission }: { entries: [string, number][]; totalCommission: number }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-[12px] font-semibold text-foreground">{t("thCommissionBreakdown")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">৳{totalCommission.toLocaleString("en-IN")}</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-muted-foreground" />
          </motion.div>
        </div>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-2 pb-1 space-y-1">
              {entries.map(([label, amount]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">+৳{amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionHistory;

