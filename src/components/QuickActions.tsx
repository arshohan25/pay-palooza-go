import { ArrowRightLeft, Banknote, ScanLine, PiggyBank, PhoneCall, Lightbulb, ShoppingCart, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const actions = [
  { icon: ArrowRightLeft, label: "Send",     gradient: "gradient-send",     id: "send" },
  { icon: Banknote,       label: "Cash Out", gradient: "gradient-cashout",  id: "cashout" },
  { icon: ScanLine,       label: "Payment",  gradient: "gradient-payment",  id: "payment" },
  { icon: PiggyBank,      label: "Add",      gradient: "gradient-addmoney", id: "addmoney" },
  { icon: PhoneCall,      label: "Recharge", gradient: "gradient-accent",   id: "recharge" },
  { icon: Lightbulb,      label: "Bill Pay", gradient: "gradient-primary",  id: "bill" },
  { icon: ShoppingCart,   label: "Shop",     gradient: "gradient-cashout",  id: "shopping" },
  { icon: LayoutGrid,     label: "More",     gradient: "gradient-payment",  id: "more" },
];

interface QuickActionsProps {
  onSendMoney: () => void;
  onCashOut: () => void;
  onPayment: () => void;
  onRecharge: () => void;
  onPayBill: () => void;
  onAddMoney: () => void;
}

const QuickActions = ({ onSendMoney, onCashOut, onPayment, onRecharge, onPayBill, onAddMoney }: QuickActionsProps) => {
  const handleAction = (id: string, label: string) => {
    if (id === "send")     return onSendMoney();
    if (id === "cashout")  return onCashOut();
    if (id === "payment")  return onPayment();
    if (id === "addmoney") return onAddMoney();
    if (id === "recharge") return onRecharge();
    if (id === "bill")     return onPayBill();
    toast.info(`${label} coming soon!`);
  };

  return (
    <div className="bg-card rounded-3xl shadow-card border border-border/60 p-4 sm:p-5">
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {actions.map((action, index) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 + index * 0.045, ease: [0.23, 1, 0.32, 1] }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleAction(action.id, action.label)}
            className="flex flex-col items-center gap-2 group outline-none"
          >
            <div className="relative">
              <div
                className={`${action.gradient} w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-primary-foreground shadow-card group-hover:shadow-elevated group-hover:-translate-y-0.5 transition-all duration-200`}
                style={{ width: 52, height: 52 }}
              >
                <action.icon size={21} strokeWidth={2} />
              </div>
              {/* subtle glow on hover */}
              <div className={`${action.gradient} absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-200 -z-10`} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-colors">
              {action.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
