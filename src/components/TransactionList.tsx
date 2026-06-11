import { useState } from "react";
import { ChevronRight, X, Copy, CheckCircle2, Hash, User, Tag, FileText, Clock, Coins, AlertCircle, Shield, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useTransactions, DbTransaction } from "@/hooks/use-transactions";
import { useI18n } from "@/lib/i18n";
import {
  TxSendIcon,
  TxReceiveIcon,
  TxCashOutIcon,
  TxRechargeIcon,
  TxBillIcon,
  TxBankIcon,
  TxPaymentIcon,
  TxBankTransferIcon,
  TxCashbackIcon,
} from "./QuickActionIcons";

// Detect cashback transactions from drive pack recharges
function isCashbackTx(tx: DbTransaction): boolean {
  return tx.type === "addmoney" && (tx.description?.startsWith("Drive Cashback:") || tx.reference?.startsWith("CB-") || false);
}

// Icon/color config per transaction type
const TX_CONFIG: Record<string, {
  Icon: () => JSX.Element;
  bg: string;
  ring: string;
  label: string;
  gradient: string;
}> = {
  send:     { Icon: TxSendIcon,     bg: "rgba(233,30,140,0.12)", ring: "1px solid rgba(233,30,140,0.2)", label: "Send Money", gradient: "from-pink-500 to-rose-600" },
  receive:  { Icon: TxReceiveIcon,  bg: "rgba(76,175,80,0.12)",  ring: "1px solid rgba(76,175,80,0.2)",  label: "Received", gradient: "from-emerald-500 to-green-600" },
  cashout:  { Icon: TxCashOutIcon,  bg: "rgba(255,152,0,0.12)",  ring: "1px solid rgba(255,152,0,0.2)",  label: "Cash Out", gradient: "from-orange-500 to-amber-600" },
  cashin:   { Icon: TxCashOutIcon,  bg: "rgba(76,175,80,0.12)",  ring: "1px solid rgba(76,175,80,0.2)",  label: "Cash In", gradient: "from-emerald-500 to-green-600" },
  payment:  { Icon: TxPaymentIcon,  bg: "rgba(156,39,176,0.12)", ring: "1px solid rgba(156,39,176,0.2)", label: "Payment", gradient: "from-purple-500 to-violet-600" },
  recharge: { Icon: TxRechargeIcon, bg: "rgba(0,188,212,0.12)",  ring: "1px solid rgba(0,188,212,0.2)",  label: "Recharge", gradient: "from-cyan-500 to-teal-600" },
  paybill:  { Icon: TxBillIcon,     bg: "rgba(255,193,7,0.12)",  ring: "1px solid rgba(255,193,7,0.2)",  label: "Bill Pay", gradient: "from-yellow-500 to-amber-600" },
  addmoney: { Icon: TxBankIcon,     bg: "rgba(25,118,210,0.12)", ring: "1px solid rgba(25,118,210,0.2)", label: "Add Money", gradient: "from-blue-500 to-indigo-600" },
  banktransfer: { Icon: TxBankTransferIcon, bg: "rgba(63,81,181,0.12)", ring: "1px solid rgba(63,81,181,0.2)", label: "Bank Transfer", gradient: "from-indigo-500 to-blue-600" },
};

const CASHBACK_CONFIG = {
  Icon: TxCashbackIcon,
  bg: "rgba(245,158,11,0.15)",
  ring: "1px solid rgba(245,158,11,0.3)",
  label: "Drive Cashback",
  gradient: "from-amber-500 to-yellow-600",
};

const RECEIVE_CONFIG = {
  Icon: TxReceiveIcon,
  bg: "rgba(76,175,80,0.12)",
  ring: "1px solid rgba(76,175,80,0.2)",
};

function getTxDisplay(tx: DbTransaction) {
  const cashback = isCashbackTx(tx);
  const isCredit = tx.type === "addmoney" || tx.type === "receive" || tx.type === "cashin";
  const cfg = cashback ? CASHBACK_CONFIG : (TX_CONFIG[tx.type] ?? TX_CONFIG.send);
  return {
    icon: cashback ? CASHBACK_CONFIG.Icon : (isCredit ? RECEIVE_CONFIG.Icon : cfg.Icon),
    bg: cashback ? CASHBACK_CONFIG.bg : (isCredit ? RECEIVE_CONFIG.bg : cfg.bg),
    ring: cashback ? CASHBACK_CONFIG.ring : (isCredit ? RECEIVE_CONFIG.ring : cfg.ring),
    label: cashback ? "Drive Cashback" : cfg.label,
    gradient: cfg.gradient,
    name: cashback
      ? (tx.description?.replace("Drive Cashback: ", "") || "Cashback")
      : (tx.recipient_name || tx.description || cfg.label),
    amount: isCredit ? tx.amount : -tx.amount,
    isCashback: cashback,
  };
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Today · ${format(d, "h:mm a")}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${format(d, "h:mm a")}`;
  return format(d, "dd MMM · h:mm a");
}

const fmt = (n: number) => n.toLocaleString("en-IN");
const fmtDec = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

interface TransactionListProps {
  onSeeAll?: () => void;
  refreshKey?: number;
}

const TransactionDetailSheet = ({ tx, onClose }: { tx: DbTransaction; onClose: () => void }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const display = getTxDisplay(tx);
  const isCredit = display.amount > 0;
  const txDate = new Date(tx.created_at);
  const txId = tx.short_id || tx.id.slice(0, 12).toUpperCase();
  const baseAmount = Math.abs(display.amount);
  const summaryBaseLabel = isCredit ? "Gross Amount" : "Principal";
  const summaryFeeLabel = isCredit ? "Fee Deducted" : "Fee (from balance)";
  const summaryTotalLabel = isCredit ? "Net Credited" : "Total Deducted";
  const summaryTotalAmount = isCredit ? Math.max(0, baseAmount - tx.fee) : baseAmount + tx.fee;

  const handleCopy = () => {
    navigator.clipboard.writeText(tx.short_id || tx.id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rows: { icon: React.ElementType; label: string; value: string; copy: boolean; accent?: string }[] = [
    { icon: Hash,     label: t("transactionId"), value: txId,                                  copy: true, accent: "text-primary"  },
    { icon: User,     label: t("nameParty"),      value: display.name,                          copy: false },
    ...(tx.recipient_phone ? [{ icon: Phone, label: "Receiver Number", value: tx.recipient_phone, copy: true }] : []),
    { icon: Tag,      label: t("type"),            value: display.label,                         copy: false },
    ...(tx.description && !tx.description.includes("[Wallet:") && !tx.description.includes("Wallet:") && tx.description !== display.label
      ? [{ icon: FileText, label: t("description"), value: tx.description, copy: false }] : []),
    ...(tx.fee > 0 ? [{ icon: Coins, label: "Charge / Fee", value: `৳${fmtDec(tx.fee)}`, copy: false, accent: "text-amber-600 dark:text-amber-400" }] : []),
    { icon: Clock,    label: t("dateTime"),        value: format(txDate, "dd MMM yyyy, h:mm a"), copy: false },
    ...(tx.commission > 0 ? [{ icon: Tag, label: t("commission"), value: `৳${fmtDec(tx.commission)}`, copy: false, accent: "text-emerald-600 dark:text-emerald-400" }] : []),
  ];

  return (
    <>
      <motion.div
        key="tx-detail-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="tx-detail-sheet"
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="fixed bottom-0 left-0 right-0 z-[71] bg-card rounded-t-3xl shadow-float
                   md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                   md:w-[90vw] md:max-w-md md:rounded-3xl overflow-hidden"
      >
        {/* Premium gradient hero header */}
        <div className={`relative bg-gradient-to-br ${display.gradient} px-5 pt-6 pb-7`}>
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "30px 30px, 40px 40px",
          }} />

          <div className="flex justify-center pt-1 pb-2 md:hidden relative z-10">
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </div>

          <motion.button
            whileTap={{ scale: 0.88 }} onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white tap-target z-10"
          >
            <X size={15} />
          </motion.button>

          <div className="flex flex-col items-center relative z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
              className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 border border-white/20"
            >
              <display.icon />
            </motion.div>
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-[32px] font-extrabold text-white tracking-tight"
            >
              {isCredit ? "+" : "−"}৳{fmt(Math.abs(display.amount))}
            </motion.p>
            <p className="text-[12px] font-medium text-white/70 mt-0.5">{display.label}</p>

            {/* Status pill */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-2.5"
            >
              {display.isCashback ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <Coins size={11} className="text-white" />
                  <span className="text-[10px] font-bold text-white">Drive Cashback</span>
                </div>
              ) : tx.status === "pending" ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <Clock size={11} className="text-white" />
                  <span className="text-[10px] font-bold text-white">Pending</span>
                </div>
              ) : tx.status === "failed" ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/30 backdrop-blur-sm">
                  <AlertCircle size={11} className="text-white" />
                  <span className="text-[10px] font-bold text-white">Rejected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <CheckCircle2 size={11} className="text-white" />
                  <span className="text-[10px] font-bold text-white capitalize">{tx.status}</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <div className="px-5 pt-4 pb-8 max-h-[55vh] overflow-y-auto">
          {/* Detail rows with left accent */}
          {rows.map(({ icon: RowIcon, label, value, copy, accent }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * idx, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0"
            >
              <div className="w-8 h-8 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 mt-0.5">
                <RowIcon size={14} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-semibold">{label}</p>
                <p className={`text-[13px] font-semibold mt-0.5 break-all leading-snug ${accent || "text-foreground"}`}>{value}</p>
              </div>
              {copy && (
                <motion.button whileTap={{ scale: 0.88 }} onClick={handleCopy}
                  className="shrink-0 w-8 h-8 rounded-xl bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground tap-target">
                  {copied ? <CheckCircle2 size={13} className="text-primary" /> : <Copy size={13} />}
                </motion.button>
              )}
            </motion.div>
          ))}

          {/* Total Amount card — glassmorphism style */}
          {tx.fee > 0 ? (
            <div className="mt-4 rounded-2xl p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-800/30 shadow-sm">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-muted-foreground font-medium">{summaryBaseLabel}</span>
                <span className="font-semibold text-foreground">৳{fmt(baseAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-[12.5px] mt-1.5">
                <span className="text-amber-600 dark:text-amber-400 font-medium">{summaryFeeLabel}</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">৳{fmt(tx.fee)}</span>
              </div>
              <div className="h-px bg-amber-200/60 dark:bg-amber-800/40 my-2.5" />
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                  <Shield size={13} className="text-amber-600 dark:text-amber-400" />
                  {summaryTotalLabel}
                </span>
                <span className="text-[20px] font-extrabold text-foreground">৳{fmt(summaryTotalAmount)}</span>
              </div>
            </div>
          ) : (
            <div className={`mt-4 rounded-2xl p-4 flex items-center justify-between ${isCredit ? "bg-gradient-to-r from-primary/10 to-primary/5" : "bg-muted/50"} border border-border/40`}>
              <span className="text-[13px] font-semibold text-muted-foreground">{t("totalAmount")}</span>
              <span className={`text-[22px] font-extrabold ${isCredit ? "text-primary" : "text-foreground"}`}>
                {isCredit ? "+" : "−"}৳{fmt(Math.abs(display.amount))}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

const USER_TYPES = new Set(["send", "receive", "payment", "recharge", "addmoney", "banktransfer"]);

const TransactionList = ({ onSeeAll, refreshKey }: TransactionListProps) => {
  const { t } = useI18n();
  const { transactions: rawTransactions, loading } = useTransactions(100, refreshKey);
  const transactions = rawTransactions.filter((tx) => USER_TYPES.has(tx.type));
  const [selectedTx, setSelectedTx] = useState<DbTransaction | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h2 className="text-[15px] font-bold text-foreground tracking-tight">{t("recentTransactions")}</h2>
        <button onClick={onSeeAll}
          className="flex items-center gap-0.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors press-effect">
          {t("seeAll")} <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      </div>

      <div className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">{t("loading")}</div>
        ) : transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3"
            >
              <FileText className="w-7 h-7 text-muted-foreground" />
            </motion.div>
            <p className="text-sm font-semibold text-foreground">{t("noTransactions")}</p>
            <p className="text-xs text-muted-foreground mt-1">Your transactions will appear here</p>
          </motion.div>
        ) : (
          transactions.map((tx, index) => {
            const display = getTxDisplay(tx);
            const isCredit = display.amount > 0;
            return (
              <motion.button
                key={tx.id}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.06, ease: [0.23, 1, 0.32, 1] }}
                onClick={() => setSelectedTx(tx)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors border-b border-border/50 last:border-0 text-left ${
                  display.isCashback ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                }`}
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: display.bg, outline: display.ring }}>
                  <display.icon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13.5px] font-semibold text-foreground truncate">{display.name}</p>
                    {display.isCashback && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <Coins size={9} /> CASHBACK
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">{relativeDate(tx.created_at)}</p>
                  {tx.status === "pending" && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 mt-0.5">
                      <Clock size={9} /> PENDING
                    </span>
                  )}
                  {tx.status === "failed" && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive mt-0.5">
                      <AlertCircle size={9} /> REJECTED
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[14px] font-bold ${display.isCashback ? "text-amber-600 dark:text-amber-400" : isCredit ? "text-primary" : "text-foreground"}`}>
                    {isCredit ? "+" : "−"}৳{fmt(Math.abs(display.amount))}
                  </span>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">{display.label}</p>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {selectedTx && <TransactionDetailSheet tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default TransactionList;
