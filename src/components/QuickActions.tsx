import { Send, Wallet, CreditCard, PlusCircle, Smartphone, Zap, ShoppingBag, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const actions = [
  { icon: Send, label: "Send Money", gradient: "gradient-send", id: "send" },
  { icon: Wallet, label: "Cash Out", gradient: "gradient-cashout", id: "cashout" },
  { icon: CreditCard, label: "Payment", gradient: "gradient-payment", id: "payment" },
  { icon: PlusCircle, label: "Add Money", gradient: "gradient-addmoney", id: "addmoney" },
  { icon: Smartphone, label: "Mobile Recharge", gradient: "gradient-accent", id: "recharge" },
  { icon: Zap, label: "Pay Bill", gradient: "gradient-primary", id: "bill" },
  { icon: ShoppingBag, label: "Shopping", gradient: "gradient-cashout", id: "shopping" },
  { icon: MoreHorizontal, label: "More", gradient: "gradient-payment", id: "more" },
];

interface QuickActionsProps {
  onSendMoney: () => void;
}

const QuickActions = ({ onSendMoney }: QuickActionsProps) => {
  return (
    <div className="grid grid-cols-4 gap-3">
      {actions.map((action, index) => (
        <motion.button
          key={action.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          onClick={() => {
            if (action.id === "send") { onSendMoney(); return; }
            toast.info(`${action.label} coming soon!`);
          }}
          className="flex flex-col items-center gap-2 group"
        >
          <div
            className={`${action.gradient} w-14 h-14 rounded-2xl flex items-center justify-center text-primary-foreground shadow-card group-hover:shadow-elevated transition-all duration-200 group-active:scale-95`}
          >
            <action.icon size={22} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground leading-tight text-center">
            {action.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
};

export default QuickActions;

