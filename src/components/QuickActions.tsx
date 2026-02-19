import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  SendMoneyIcon,
  CashOutIcon,
  PaymentIcon,
  RechargeIcon,
  PayBillIcon,
  ShopIcon,
  MoreIcon,
  SavingsIcon,
} from "./QuickActionIcons";

const actions = [
  {
    Icon: SendMoneyIcon,
    label: "Send Money",
    id: "send",
    bgStyle: "rgba(233,30,140,0.12)",
    ringStyle: "1px solid rgba(233,30,140,0.25)",
    rippleColor: "rgba(233,30,140,0.35)",
  },
  {
    Icon: CashOutIcon,
    label: "Cash Out",
    id: "cashout",
    bgStyle: "rgba(76,175,80,0.12)",
    ringStyle: "1px solid rgba(76,175,80,0.25)",
    rippleColor: "rgba(76,175,80,0.35)",
  },
  {
    Icon: PaymentIcon,
    label: "Payment",
    id: "payment",
    bgStyle: "rgba(156,39,176,0.12)",
    ringStyle: "1px solid rgba(156,39,176,0.25)",
    rippleColor: "rgba(156,39,176,0.35)",
  },
  {
    Icon: SavingsIcon,
    label: "Savings",
    id: "savings",
    bgStyle: "rgba(233,30,140,0.12)",
    ringStyle: "1px solid rgba(233,30,140,0.25)",
    rippleColor: "rgba(233,30,140,0.35)",
  },
  {
    Icon: RechargeIcon,
    label: "Recharge",
    id: "recharge",
    bgStyle: "rgba(0,188,212,0.12)",
    ringStyle: "1px solid rgba(0,188,212,0.25)",
    rippleColor: "rgba(0,188,212,0.35)",
  },
  {
    Icon: PayBillIcon,
    label: "Pay Bill",
    id: "bill",
    bgStyle: "rgba(255,193,7,0.12)",
    ringStyle: "1px solid rgba(255,193,7,0.25)",
    rippleColor: "rgba(255,193,7,0.45)",
  },
  {
    Icon: ShopIcon,
    label: "Shop",
    id: "shopping",
    bgStyle: "rgba(255,87,34,0.12)",
    ringStyle: "1px solid rgba(255,87,34,0.25)",
    rippleColor: "rgba(255,87,34,0.35)",
  },
  {
    Icon: MoreIcon,
    label: "More",
    id: "more",
    bgStyle: "rgba(120,120,140,0.10)",
    ringStyle: "1px solid rgba(120,120,140,0.20)",
    rippleColor: "rgba(120,120,140,0.30)",
  },
];

interface RippleState {
  x: number;
  y: number;
  id: number;
}

interface QuickActionsProps {
  onSendMoney: () => void;
  onCashOut: () => void;
  onPayment: () => void;
  onRecharge: () => void;
  onPayBill: () => void;
}

const QuickActions = ({ onSendMoney, onCashOut, onPayment, onRecharge, onPayBill }: QuickActionsProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Record<string, RippleState | null>>({});
  const rippleCounterRef = useRef(0);

  const triggerRipple = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    const el = (e.currentTarget as HTMLElement).querySelector("[data-ripple-container]") as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    rippleCounterRef.current += 1;
    setRipples(prev => ({ ...prev, [id]: { x, y, id: rippleCounterRef.current } }));
    setTimeout(() => setRipples(prev => ({ ...prev, [id]: null })), 600);
  }, []);

  const handleAction = (id: string, label: string) => {
    if (id === "send")     return onSendMoney();
    if (id === "cashout")  return onCashOut();
    if (id === "payment")  return onPayment();
    if (id === "recharge") return onRecharge();
    if (id === "bill")     return onPayBill();
    toast.info(`${label} coming soon!`);
  };

  return (
    <div className="bg-card rounded-3xl shadow-card border border-border/60 p-4 sm:p-5">
      <div className="grid grid-cols-4 gap-y-5 gap-x-2 sm:gap-x-3">
        {actions.map((action, index) => {
          const isHovered = hoveredId === action.id;
          const ripple = ripples[action.id];
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.04 + index * 0.05, ease: [0.23, 1, 0.32, 1] }}
              whileTap={{ scale: 0.90 }}
              onClick={(e) => {
                triggerRipple(action.id, e);
                handleAction(action.id, action.label);
              }}
              onTouchStart={(e) => triggerRipple(action.id, e)}
              onHoverStart={() => setHoveredId(action.id)}
              onHoverEnd={() => setHoveredId(null)}
              className="flex flex-col items-center gap-2.5 group outline-none"
            >
              {/* Icon circle with ripple */}
              <motion.div
                data-ripple-container
                whileHover={{ scale: 1.06, y: -2 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className="relative flex items-center justify-center rounded-full shadow-sm group-hover:shadow-md transition-shadow duration-200 overflow-hidden"
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

                {/* Ripple wave */}
                <AnimatePresence>
                  {ripple && (
                    <motion.span
                      key={ripple.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: ripple.x,
                        top: ripple.y,
                        width: 8,
                        height: 8,
                        marginLeft: -4,
                        marginTop: -4,
                        background: action.rippleColor,
                      }}
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 10, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>

                <action.Icon isHovered={isHovered} />
              </motion.div>

              {/* Label */}
              <span className="text-[10px] sm:text-[10.5px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-colors duration-150 px-0.5">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;
