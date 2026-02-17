import { ArrowUpRight, ArrowDownLeft, Smartphone, Zap } from "lucide-react";
import { motion } from "framer-motion";

const transactions = [
  {
    id: 1,
    type: "sent",
    name: "Rahim Uddin",
    time: "Today, 2:30 PM",
    amount: -500,
    icon: ArrowUpRight,
    iconClass: "text-destructive bg-destructive/10",
  },
  {
    id: 2,
    type: "received",
    name: "Salary - XYZ Corp",
    time: "Today, 10:00 AM",
    amount: 25000,
    icon: ArrowDownLeft,
    iconClass: "text-primary bg-primary/10",
  },
  {
    id: 3,
    type: "recharge",
    name: "Grameenphone Recharge",
    time: "Yesterday, 8:15 PM",
    amount: -200,
    icon: Smartphone,
    iconClass: "text-accent bg-accent/10",
  },
  {
    id: 4,
    type: "bill",
    name: "DESCO Electricity",
    time: "Yesterday, 3:45 PM",
    amount: -1850,
    icon: Zap,
    iconClass: "text-muted-foreground bg-muted",
  },
  {
    id: 5,
    type: "received",
    name: "Karim Ahmed",
    time: "Feb 14, 11:20 AM",
    amount: 1200,
    icon: ArrowDownLeft,
    iconClass: "text-primary bg-primary/10",
  },
];

const TransactionList = () => {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">Recent Transactions</h2>
        <button className="text-xs font-semibold text-primary hover:underline">
          See All
        </button>
      </div>
      <div className="space-y-2">
        {transactions.map((tx, index) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + index * 0.06 }}
            className="flex items-center gap-3 bg-card rounded-xl p-3 shadow-card"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.iconClass}`}>
              <tx.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-card-foreground truncate">{tx.name}</p>
              <p className="text-xs text-muted-foreground">{tx.time}</p>
            </div>
            <span
              className={`text-sm font-bold ${
                tx.amount > 0 ? "text-primary" : "text-foreground"
              }`}
            >
              {tx.amount > 0 ? "+" : ""}৳{Math.abs(tx.amount).toLocaleString()}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TransactionList;
