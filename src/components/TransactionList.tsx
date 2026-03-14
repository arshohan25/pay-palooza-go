import { useState } from "react";
import { ChevronRight, X, Copy, CheckCircle2, Hash, User, Tag, FileText, Clock, Coins } from "lucide-react";
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
}> = {
  send:     { Icon: TxSendIcon,     bg: "rgba(233,30,140,0.12)", ring: "1px solid rgba(233,30,140,0.2)", label: "Send Money" },
  receive:  { Icon: TxReceiveIcon,  bg: "rgba(76,175,80,0.12)",  ring: "1px solid rgba(76,175,80,0.2)",  label: "Received" },
  cashout:  { Icon: TxCashOutIcon,  bg: "rgba(255,152,0,0.12)",  ring: "1px solid rgba(255,152,0,0.2)",  label: "Cash Out" },
  cashin:   { Icon: TxCashOutIcon,  bg: "rgba(76,175,80,0.12)",  ring: "1px solid rgba(76,175,80,0.2)",  label: "Cash In" },
  payment:  { Icon: TxPaymentIcon,  bg: "rgba(156,39,176,0.12)", ring: "1px solid rgba(156,39,176,0.2)", label: "Payment" },
  recharge: { Icon: TxRechargeIcon, bg: "rgba(0,188,212,0.12)",  ring: "1px solid rgba(0,188,212,0.2)",  label: "Recharge" },
  paybill:  { Icon: TxBillIcon,     bg: "rgba(255,193,7,0.12)",  ring: "1px solid rgba(255,193,7,0.2)",  label: "Bill Pay" },
  addmoney: { Icon: TxBankIcon,     bg: "rgba(25,118,210,0.12)", ring: "1px solid rgba(25,118,210,0.2)", label: "Add Money" },
  banktransfer: { Icon: TxBankTransferIcon, bg: "rgba(63,81,181,0.12)", ring: "1px solid rgba(63,81,181,0.2)", label: "Bank Transfer" },
};

const CASHBACK_CONFIG = {
  Icon: TxCashbackIcon,
  bg: "rgba(245,158,11,0.15)",
  ring: "1px solid rgba(245,158,11,0.3)",
  label: "Drive Cashback",
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

  const handleCopy = () => {
    navigator.clipboard.writeText(tx.short_id || tx.id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rows: { icon: React.ElementType; label: string; value: string; copy: boolean }[] = [
    { icon: Hash,     label: t("transactionId"), value: txId,                                  copy: true  },
    { icon: User,     label: t("nameParty"),      value: display.name,                          copy: false },
    { icon: Tag,      label: t("type"),            value: display.label,                         copy: false },
    { icon: FileText, label: t("description"),     value: tx.description || display.label,       copy: false },
    { icon: Clock,    label: t("dateTime"),        value: format(txDate, "dd MMM yyyy, h:mm a"), copy: false },
    ...(tx.commission > 0 ? [{ icon: Tag, label: t("commission"), value: `৳${tx.commission.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, copy: false }] : []),
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
                   md:w-[90vw] md:max-w-md md:rounded-3xl"
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
        </div>
        <motion.button
          whileTap={{ scale: 0.88 }} onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground tap-target"
        >
          <X size={15} />
        </motion.button>

        <div className="px-5 pt-3 pb-8 max-h-[85vh] overflow-y-auto">
          <div className="flex flex-col items-center mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: display.bg, outline: display.ring }}>
              <display.icon />
            </div>
            <p className={`text-[26px] font-bold ${display.isCashback ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              {isCredit ? "+" : "−"}৳{Math.abs(display.amount).toLocaleString()}
            </p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">{display.label}</p>
            {display.isCashback ? (
              <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Coins size={12} className="text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Drive Cashback</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-primary/10">
                <CheckCircle2 size={12} className="text-primary" />
                <span className="text-[11px] font-bold text-primary capitalize">{tx.status}</span>
              </div>
            )}
          </div>

          <div className="h-px bg-border/60 mb-3" />

          {rows.map(({ icon: RowIcon, label, value, copy }) => (
            <div key={label} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <RowIcon size={14} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-semibold">{label}</p>
                <p className="text-[13px] font-semibold text-foreground mt-0.5 break-all leading-snug">{value}</p>
              </div>
              {copy && (
                <motion.button whileTap={{ scale: 0.88 }} onClick={handleCopy}
                  className="shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground tap-target">
                  {copied ? <CheckCircle2 size={13} className="text-primary" /> : <Copy size={13} />}
                </motion.button>
              )}
            </div>
          ))}

          <div className={`mt-4 rounded-2xl p-4 flex items-center justify-between ${isCredit ? "bg-primary/10" : "bg-muted/60"}`}>
            <span className="text-[13px] font-semibold text-muted-foreground">{t("totalAmount")}</span>
            <span className={`text-[20px] font-bold ${isCredit ? "text-primary" : "text-foreground"}`}>
              {isCredit ? "+" : "−"}৳{Math.abs(display.amount).toLocaleString()}
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
};

const USER_TYPES = new Set(["send", "receive", "payment", "recharge", "addmoney", "banktransfer"]);

const TransactionList = ({ onSeeAll, refreshKey }: TransactionListProps) => {
  const { t } = useI18n();
  const { transactions: rawTransactions, loading } = useTransactions(5, refreshKey);
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
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[14px] font-bold ${display.isCashback ? "text-amber-600 dark:text-amber-400" : isCredit ? "text-primary" : "text-foreground"}`}>
                    {isCredit ? "+" : "−"}৳{Math.abs(display.amount).toLocaleString()}
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
