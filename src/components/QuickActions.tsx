import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  SendMoneyIcon,
  CashOutIcon,
  PaymentIcon,
  ReferIcon,
  RechargeIcon,
  PayBillIcon,
  ShopIcon,
  MoreIcon,
} from "./QuickActionIcons";
import { useI18n } from "@/lib/i18n";

const actionDefs = [
  { Icon: SendMoneyIcon, labelKey: "sendMoney" as const, id: "send", bg: "hsl(330 80% 55% / 0.1)", accent: "hsl(330 80% 55%)" },
  { Icon: CashOutIcon, labelKey: "cashOut" as const, id: "cashout", bg: "hsl(122 38% 50% / 0.1)", accent: "hsl(122 38% 50%)" },
  { Icon: PaymentIcon, labelKey: "payment" as const, id: "payment", bg: "hsl(291 64% 44% / 0.1)", accent: "hsl(291 64% 44%)" },
  { Icon: ReferIcon, labelKey: "referEarn" as const, id: "refer", bg: "hsl(14 100% 57% / 0.1)", accent: "hsl(14 100% 57%)" },
  { Icon: RechargeIcon, labelKey: "recharge" as const, id: "recharge", bg: "hsl(187 100% 42% / 0.1)", accent: "hsl(187 100% 42%)" },
  { Icon: PayBillIcon, labelKey: "payBill" as const, id: "bill", bg: "hsl(45 100% 51% / 0.1)", accent: "hsl(45 100% 51%)" },
  { Icon: ShopIcon, labelKey: "shop" as const, id: "shop", bg: "hsl(14 100% 63% / 0.1)", accent: "hsl(14 100% 63%)" },
  { Icon: MoreIcon, labelKey: "more" as const, id: "more", bg: "hsl(var(--muted))", accent: "hsl(var(--muted-foreground))" },
];

interface QuickActionsProps {
  onSendMoney: () => void;
  onCashOut: () => void;
  onPayment: () => void;
  onRecharge: () => void;
  onPayBill: () => void;
  onAddMoney: () => void;
  onRefer: () => void;
  onShop: () => void;
}

const QuickActions = ({ onSendMoney, onCashOut, onPayment, onRecharge, onPayBill, onAddMoney, onRefer, onShop }: QuickActionsProps) => {
  const { t } = useI18n();
  const [pressedId, setPressedId] = useState<string | null>(null);

  const handleAction = (id: string, label: string) => {
    if (id === "send") return onSendMoney();
    if (id === "cashout") return onCashOut();
    if (id === "payment") return onPayment();
    if (id === "addmoney") return onAddMoney();
    if (id === "recharge") return onRecharge();
    if (id === "bill") return onPayBill();
    if (id === "refer") return onRefer();
    if (id === "shop") return onShop();
    toast.info(`${label} coming soon!`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="bg-card rounded-[24px] shadow-card border border-border/60 p-4"
    >
      <div className="grid grid-cols-4 gap-y-4 gap-x-1">
        {actionDefs.map((action, index) => {
          const label = t(action.labelKey);
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.06 + index * 0.04, ease: [0.23, 1, 0.32, 1] }}
              whileTap={{ scale: 0.88 }}
              onTapStart={() => setPressedId(action.id)}
              onTap={() => setPressedId(null)}
              onTapCancel={() => setPressedId(null)}
              onClick={() => handleAction(action.id, label)}
              className="flex flex-col items-center gap-2 group outline-none"
            >
              <motion.div
                className="relative flex items-center justify-center rounded-[18px] transition-shadow duration-200"
                style={{
                  width: 52,
                  height: 52,
                  background: action.bg,
                  boxShadow: pressedId === action.id
                    ? `0 0 0 2px ${action.accent}, 0 4px 12px -2px ${action.accent}40`
                    : "none",
                }}
                whileHover={{ y: -2, scale: 1.04 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
              >
                <action.Icon isHovered={pressedId === action.id} />
              </motion.div>
              <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-colors px-0.5 line-clamp-2">
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default QuickActions;
