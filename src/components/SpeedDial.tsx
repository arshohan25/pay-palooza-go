import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Send,
  CreditCard,
  Zap,
  Phone,
  Receipt,
  Landmark,
} from "lucide-react";
import { haptics } from "@/lib/haptics";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface SpeedDialAction {
  id: string;
  labelKey: TranslationKey;
  icon: React.ElementType;
  gradient: string;
  shadow: string;
  onClick: () => void;
}

interface SpeedDialProps {
  onSendMoney: () => void;
  onPayment:   () => void;
  onCashOut:   () => void;
  onRecharge:  () => void;
  onPayBill:   () => void;
  onAddMoney:  () => void;
}

const SpeedDial = ({
  onSendMoney,
  onPayment,
  onCashOut,
  onRecharge,
  onPayBill,
  onAddMoney,
}: SpeedDialProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  const actions: SpeedDialAction[] = [
    {
      id: "send",
      labelKey: "sendMoney",
      icon: Send,
      gradient: "gradient-send",
      shadow: "shadow-[0_4px_20px_rgba(99,102,241,0.45)]",
      onClick: onSendMoney,
    },
    {
      id: "pay",
      labelKey: "sdPay",
      icon: CreditCard,
      gradient: "gradient-payment",
      shadow: "shadow-[0_4px_20px_rgba(236,72,153,0.45)]",
      onClick: onPayment,
    },
    {
      id: "cashout",
      labelKey: "cashOut",
      icon: Zap,
      gradient: "gradient-cashout",
      shadow: "shadow-[0_4px_20px_rgba(234,88,12,0.45)]",
      onClick: onCashOut,
    },
    {
      id: "recharge",
      labelKey: "recharge",
      icon: Phone,
      gradient: "gradient-accent",
      shadow: "shadow-[0_4px_20px_rgba(16,185,129,0.45)]",
      onClick: onRecharge,
    },
    {
      id: "bill",
      labelKey: "payBill",
      icon: Receipt,
      gradient: "gradient-primary",
      shadow: "shadow-[0_4px_20px_rgba(59,130,246,0.45)]",
      onClick: onPayBill,
    },
    {
      id: "addmoney",
      labelKey: "addMoney",
      icon: Landmark,
      gradient: "gradient-addmoney",
      shadow: "shadow-[0_4px_20px_rgba(139,92,246,0.45)]",
      onClick: onAddMoney,
    },
  ];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    haptics.medium();
    setOpen((v) => !v);
  };

  const handleAction = (action: SpeedDialAction) => {
    haptics.medium();
    setOpen(false);
    action.onClick();
  };

  return (
    // Sits just above the bottom nav pill on mobile; hidden on md+ (sidebar covers it)
    <div
      ref={ref}
      className="md:hidden fixed bottom-24 right-4 z-40 flex flex-col-reverse items-end gap-3"
    >
      {/* Action items */}
      <AnimatePresence>
        {open &&
          actions.map((action, i) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 16 }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 28,
                delay: open ? i * 0.045 : (actions.length - 1 - i) * 0.03,
              }}
              className="flex items-center gap-3"
            >
              {/* Label */}
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ delay: i * 0.045 + 0.05, duration: 0.18 }}
                className="text-xs font-semibold text-foreground bg-card/90 backdrop-blur-sm border border-border/60 px-3 py-1.5 rounded-xl shadow-card whitespace-nowrap"
              >
                {t(action.labelKey)}
              </motion.span>

              {/* Icon button */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => handleAction(action)}
                className={`${action.gradient} ${action.shadow} w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 active:scale-95 transition-transform`}
                aria-label={t(action.labelKey)}
              >
                <action.icon size={20} strokeWidth={2} />
              </motion.button>
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.88 }}
        aria-label={open ? t("sdCloseActions") : t("sdQuickActions")}
        className="w-14 h-14 rounded-2xl gradient-primary shadow-glow-lg flex items-center justify-center text-primary-foreground relative overflow-hidden"
      >
        {/* Ripple ring when open */}
        <AnimatePresence>
          {open && (
            <motion.span
              key="ring"
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="absolute inset-0 rounded-2xl bg-white/30"
            />
          )}
        </AnimatePresence>

        <motion.div
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
        >
          {open ? <X size={24} strokeWidth={2.5} /> : <Plus size={24} strokeWidth={2.5} />}
        </motion.div>
      </motion.button>

      {/* Backdrop scrim */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 -z-10 bg-background/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpeedDial;
