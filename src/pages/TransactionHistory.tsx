import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Zap,
  Wallet,
  CreditCard,
  X,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type TxCategory = "all" | "send" | "cashout" | "payment" | "recharge" | "bill";

interface Transaction {
  id: string;
  category: Exclude<TxCategory, "all">;
  name: string;
  detail: string;
  date: string; // ISO
  amount: number; // positive = credit, negative = debit
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const ALL_TRANSACTIONS: Transaction[] = [
  { id: "t01", category: "send",     name: "Rahim Uddin",          detail: "Send Money",              date: "2026-02-18T14:30:00", amount: -500 },
  { id: "t02", category: "send",     name: "Salary - XYZ Corp",    detail: "Money Received",           date: "2026-02-18T10:00:00", amount: 25000 },
  { id: "t03", category: "recharge", name: "Grameenphone",         detail: "Mobile Recharge · 3GB Pack",date: "2026-02-17T20:15:00", amount: -199 },
  { id: "t04", category: "bill",     name: "DESCO Electricity",    detail: "Pay Bill · Feb 2026",      date: "2026-02-17T15:45:00", amount: -1850 },
  { id: "t05", category: "send",     name: "Karim Ahmed",          detail: "Money Received",           date: "2026-02-14T11:20:00", amount: 1200 },
  { id: "t06", category: "cashout",  name: "Karim Store · AGT-10234", detail: "Cash Out",             date: "2026-02-13T09:30:00", amount: -5000 },
  { id: "t07", category: "payment",  name: "Shajgoj",              detail: "Merchant Payment",        date: "2026-02-12T17:55:00", amount: -320 },
  { id: "t08", category: "recharge", name: "Robi",                 detail: "Mobile Recharge · 2GB Pack",date: "2026-02-11T08:00:00", amount: -59 },
  { id: "t09", category: "bill",     name: "Titas Gas",            detail: "Pay Bill · Feb 2026",      date: "2026-02-10T12:10:00", amount: -780 },
  { id: "t10", category: "send",     name: "Nasrin Begum",         detail: "Send Money",              date: "2026-02-09T16:00:00", amount: -2000 },
  { id: "t11", category: "payment",  name: "Daraz BD",             detail: "Merchant Payment",        date: "2026-02-08T13:25:00", amount: -1490 },
  { id: "t12", category: "cashout",  name: "Hasan Mobile · AGT-33512", detail: "Cash Out",           date: "2026-02-07T10:40:00", amount: -3000 },
  { id: "t13", category: "send",     name: "Farhan Islam",         detail: "Money Received",          date: "2026-02-06T09:00:00", amount: 800 },
  { id: "t14", category: "bill",     name: "WASA (Dhaka)",         detail: "Pay Bill · Feb 2026",     date: "2026-02-05T14:00:00", amount: -450 },
  { id: "t15", category: "recharge", name: "Banglalink",           detail: "Mobile Recharge · ৳100 Custom", date: "2026-02-04T19:30:00", amount: -100 },
  { id: "t16", category: "payment",  name: "Pathao",               detail: "Merchant Payment",        date: "2026-02-03T08:55:00", amount: -180 },
  { id: "t17", category: "send",     name: "Salary Bonus",         detail: "Money Received",          date: "2026-02-01T10:00:00", amount: 5000 },
  { id: "t18", category: "bill",     name: "Link3 Internet",       detail: "Pay Bill · Feb 2026",     date: "2026-01-31T11:00:00", amount: -650 },
  { id: "t19", category: "cashout",  name: "Rina Telecom · AGT-20871", detail: "Cash Out",           date: "2026-01-28T15:20:00", amount: -10000 },
  { id: "t20", category: "payment",  name: "Chaldal",              detail: "Merchant Payment",        date: "2026-01-25T18:00:00", amount: -990 },
];

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES: { id: TxCategory; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "send",     label: "Send" },
  { id: "cashout",  label: "Cash Out" },
  { id: "payment",  label: "Payment" },
  { id: "recharge", label: "Recharge" },
  { id: "bill",     label: "Bill Pay" },
];

const ICON_MAP: Record<Exclude<TxCategory, "all">, { icon: typeof ArrowUpRight; debitClass: string; creditClass: string }> = {
  send:     { icon: ArrowUpRight,  debitClass: "text-destructive bg-destructive/10",  creditClass: "text-primary bg-primary/10" },
  cashout:  { icon: Wallet,        debitClass: "text-rose-500 bg-rose-500/10",         creditClass: "text-primary bg-primary/10" },
  payment:  { icon: CreditCard,    debitClass: "text-blue-500 bg-blue-500/10",         creditClass: "text-primary bg-primary/10" },
  recharge: { icon: Smartphone,    debitClass: "text-accent bg-accent/10",             creditClass: "text-primary bg-primary/10" },
  bill:     { icon: Zap,           debitClass: "text-orange-500 bg-orange-500/10",     creditClass: "text-primary bg-primary/10" },
};

const PAGE_SIZE = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const relativeDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Today, ${format(d, "h:mm a")}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${format(d, "h:mm a")}`;
  return format(d, "dd MMM yyyy, h:mm a");
};

// ─── TransactionHistory ───────────────────────────────────────────────────────
interface TransactionHistoryProps { onClose?: () => void; }

const TransactionHistory = ({ onClose }: TransactionHistoryProps) => {
  const [activeTab, setActiveTab]     = useState<TxCategory>("all");
  const [search, setSearch]           = useState("");
  const [dateFrom, setDateFrom]       = useState<Date | undefined>();
  const [dateTo, setDateTo]           = useState<Date | undefined>();
  const [fromOpen, setFromOpen]       = useState(false);
  const [toOpen, setToOpen]           = useState(false);
  const [page, setPage]               = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_TRANSACTIONS.filter((tx) => {
      if (activeTab !== "all" && tx.category !== activeTab) return false;
      if (q && !tx.name.toLowerCase().includes(q) && !tx.detail.toLowerCase().includes(q)) return false;
      if (dateFrom || dateTo) {
        const txDate = new Date(tx.date);
        const from = dateFrom ? startOfDay(dateFrom) : new Date(0);
        const to   = dateTo  ? endOfDay(dateTo)     : new Date(8640000000000000);
        if (!isWithinInterval(txDate, { start: from, end: to })) return false;
      }
      return true;
    });
  }, [activeTab, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  const handleTabChange = (t: TxCategory) => { setActiveTab(t); setPage(1); };
  const handleSearch    = (v: string)     => { setSearch(v);    setPage(1); };
  const clearFilters    = () => { setDateFrom(undefined); setDateTo(undefined); setSearch(""); setActiveTab("all"); setPage(1); };

  const hasActiveFilters = search || dateFrom || dateTo || activeTab !== "all";

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalIn  = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="gradient-primary px-4 pt-12 pb-5 text-primary-foreground">
        <div className="flex items-center gap-3 mb-1">
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h1 className="text-lg font-bold flex-1">Transaction History</h1>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              showFilters || dateFrom || dateTo ? "bg-white text-primary" : "bg-white/15"
            }`}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-white/15 rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-white/70">Money In</p>
            <p className="text-sm font-bold">+৳{totalIn.toLocaleString()}</p>
          </div>
          <div className="flex-1 bg-white/15 rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-white/70">Money Out</p>
            <p className="text-sm font-bold">-৳{totalOut.toLocaleString()}</p>
          </div>
          <div className="flex-1 bg-white/15 rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-white/70">Transactions</p>
            <p className="text-sm font-bold">{filtered.length}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 pr-9 h-10 bg-card border-border text-sm"
          />
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Date filters (collapsible) */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-4"
          >
            <div className="flex gap-2 pt-2">
              {/* From */}
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 h-9 text-xs justify-start border-border bg-card font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon size={13} className="mr-1.5 shrink-0" />
                    {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => { setDateFrom(d); setFromOpen(false); setPage(1); }}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {/* To */}
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 h-9 text-xs justify-start border-border bg-card font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon size={13} className="mr-1.5 shrink-0" />
                    {dateTo ? format(dateTo, "dd MMM yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => { setDateTo(d); setToOpen(false); setPage(1); }}
                    disabled={(d) => d > new Date() || (dateFrom ? d < dateFrom : false)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(undefined); setDateTo(undefined); setPage(1); }}
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground border border-border shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category tab bar */}
      <div className="px-4 pt-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((cat) => {
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleTabChange(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  active
                    ? "gradient-primary text-white shadow-card"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <div className="px-4 pt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
          <button onClick={clearFilters} className="text-xs font-semibold text-primary flex items-center gap-1">
            <X size={11} /> Clear all
          </button>
        </div>
      )}

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <AnimatePresence mode="wait">
          {paginated.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Search size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No transactions found</p>
              <p className="text-xs text-muted-foreground text-center">Try adjusting your filters or search query</p>
              <button onClick={clearFilters} className="text-xs font-semibold text-primary mt-1">Clear filters</button>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeTab}-${page}-${search}-${dateFrom?.toISOString()}-${dateTo?.toISOString()}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-2"
            >
              {paginated.map((tx, i) => {
                const cfg  = ICON_MAP[tx.category];
                const Icon = cfg.icon;
                const isCredit = tx.amount > 0;
                const iconClass = isCredit ? cfg.creditClass : cfg.debitClass;

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-card border border-border"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
                      {isCredit
                        ? <ArrowDownLeft size={18} />
                        : <Icon size={18} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{tx.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tx.detail}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{relativeDate(tx.date)}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isCredit ? "text-primary" : "text-foreground"}`}>
                      {isCredit ? "+" : "-"}৳{Math.abs(tx.amount).toLocaleString()}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground disabled:opacity-40 active:scale-95 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    p === page
                      ? "gradient-primary text-white shadow-card"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground disabled:opacity-40 active:scale-95 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
