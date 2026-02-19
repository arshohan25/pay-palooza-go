import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  SendMoneyIcon,
  CashOutIcon,
  PaymentIcon,
  AddMoneyIcon,
  RechargeIcon,
  PayBillIcon,
  ShopIcon,
  MoreIcon,
} from "./QuickActionIcons";

const actions = [
  {
    Icon: SendMoneyIcon,
    label: "Send Money",
    id: "send",
    bgStyle: "rgba(233,30,140,0.12)",
    ringStyle: "1px solid rgba(233,30,140,0.25)",
  },
  {
    Icon: CashOutIcon,
    label: "Cash Out",
    id: "cashout",
    bgStyle: "rgba(76,175,80,0.12)",
    ringStyle: "1px solid rgba(76,175,80,0.25)",
  },
  {
    Icon: PaymentIcon,
    label: "Payment",
    id: "payment",
    bgStyle: "rgba(156,39,176,0.12)",
    ringStyle: "1px solid rgba(156,39,176,0.25)",
  },
  {
    Icon: AddMoneyIcon,
    label: "Add Money",
    id: "addmoney",
    bgStyle: "rgba(25,118,210,0.12)",
    ringStyle: "1px solid rgba(25,118,210,0.25)",
  },
  {
    Icon: RechargeIcon,
    label: "Recharge",
    id: "recharge",
    bgStyle: "rgba(0,188,212,0.12)",
    ringStyle: "1px solid rgba(0,188,212,0.25)",
  },
  {
    Icon: PayBillIcon,
    label: "Pay Bill",
    id: "bill",
    bgStyle: "rgba(255,193,7,0.12)",
    ringStyle: "1px solid rgba(255,193,7,0.25)",
  },
  {
    Icon: ShopIcon,
    label: "Shop",
    id: "shopping",
    bgStyle: "rgba(255,87,34,0.12)",
    ringStyle: "1px solid rgba(255,87,34,0.25)",
  },
  {
    Icon: MoreIcon,
    label: "More",
    id: "more",
    bgStyle: "rgba(120,120,140,0.10)",
    ringStyle: "1px solid rgba(120,120,140,0.20)",
  },
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
      <div className="grid grid-cols-4 gap-y-5 gap-x-2 sm:gap-x-3">
        {actions.map((action, index) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.04 + index * 0.05, ease: [0.23, 1, 0.32, 1] }}
            whileTap={{ scale: 0.90 }}
            onClick={() => handleAction(action.id, action.label)}
            className="flex flex-col items-center gap-2.5 group outline-none"
          >
            {/* Icon circle */}
            <motion.div
              whileHover={{ scale: 1.06, y: -2 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="relative flex items-center justify-center rounded-full shadow-sm group-hover:shadow-md transition-shadow duration-200"
              style={{
                width: 56,
                height: 56,
                background: action.bgStyle,
                outline: action.ringStyle,
              }}
            >
              {/* Subtle glow on hover */}
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-[10px] transition-opacity duration-300 -z-10 scale-110"
                style={{ background: action.bgStyle }}
              />
              <action.Icon />
            </motion.div>

            {/* Label */}
            <span className="text-[10px] sm:text-[10.5px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-colors duration-150 px-0.5">
              {action.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
