import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  TxSendIcon,
  TxReceiveIcon,
  TxCashOutIcon,
  TxRechargeIcon,
  TxBillIcon,
  TxBankIcon,
} from "./QuickActionIcons";

const transactions = [
  {
    id: 1,
    type: "sent",
    name: "Rahim Uddin",
    sub: "Send Money",
    time: "Today · 2:30 PM",
    amount: -500,
    Icon: TxSendIcon,
    bg: "rgba(233,30,140,0.12)",
    ring: "1px solid rgba(233,30,140,0.2)",
  },
  {
    id: 2,
    type: "received",
    name: "Salary – XYZ Corp",
    sub: "Bank Transfer",
    time: "Today · 10:00 AM",
    amount: 25000,
    Icon: TxBankIcon,
    bg: "rgba(25,118,210,0.12)",
    ring: "1px solid rgba(25,118,210,0.2)",
  },
  {
    id: 3,
    type: "recharge",
    name: "Grameenphone",
    sub: "Mobile Recharge",
    time: "Yesterday · 8:15 PM",
    amount: -200,
    Icon: TxRechargeIcon,
    bg: "rgba(0,188,212,0.12)",
    ring: "1px solid rgba(0,188,212,0.2)",
  },
  {
    id: 4,
    type: "bill",
    name: "DESCO Electricity",
    sub: "Utility Bill",
    time: "Yesterday · 3:45 PM",
    amount: -1850,
    Icon: TxBillIcon,
    bg: "rgba(255,193,7,0.12)",
    ring: "1px solid rgba(255,193,7,0.2)",
  },
  {
    id: 5,
    type: "received",
    name: "Karim Ahmed",
    sub: "Cash Received",
    time: "Feb 14 · 11:20 AM",
    amount: 1200,
    Icon: TxReceiveIcon,
    bg: "rgba(76,175,80,0.12)",
    ring: "1px solid rgba(76,175,80,0.2)",
  },
];

interface TransactionListProps {
  onSeeAll?: () => void;
}

const TransactionList = ({ onSeeAll }: TransactionListProps) => {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h2 className="text-[15px] font-bold text-foreground tracking-tight">Recent Transactions</h2>
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors press-effect"
        >
          See All <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      </div>

      {/* List */}
      <div className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden">
        {transactions.map((tx, index) => (
          <motion.button
            key={tx.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + index * 0.06, ease: [0.23, 1, 0.32, 1] }}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors border-b border-border/50 last:border-0 text-left"
          >
            {/* Illustrated icon circle */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: tx.bg, outline: tx.ring }}
            >
              <tx.Icon />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-foreground truncate">{tx.name}</p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">{tx.time}</p>
            </div>

            {/* Amount */}
            <div className="text-right shrink-0">
              <span className={`text-[14px] font-bold ${tx.amount > 0 ? "text-primary" : "text-foreground"}`}>
                {tx.amount > 0 ? "+" : "−"}৳{Math.abs(tx.amount).toLocaleString()}
              </span>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">{tx.sub}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default TransactionList;
