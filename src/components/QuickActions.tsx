import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Lock, ChevronUp } from "lucide-react";
import {
  SendMoneyIcon,
  CashOutIcon,
  PaymentIcon,
  BankTransferIcon,
  RechargeIcon,
  PayBillIcon,
  ShopIcon,
  MoreIcon,
  ReferIcon,
  SavingsIcon,
  CouponsIcon,
  DonationsIcon,
  LoanIcon,
  InsuranceIcon,
  GiftCardsIcon,
} from "./QuickActionIcons";
import { useI18n } from "@/lib/i18n";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import { useGlobalToggles } from "@/hooks/use-global-toggles";

const FEATURE_MAP: Record<string, string> = {
  send: "send_money",
  cashout: "cash_out",
  payment: "payment",
  recharge: "mobile_recharge",
  bill: "pay_bill",
  shop: "payment",
};

const actionDefs = [
  { Icon: SendMoneyIcon, labelKey: "sendMoney" as const, id: "send", bgStyle: "rgba(233,30,140,0.12)", ringStyle: "1px solid rgba(233,30,140,0.25)", rippleColor: "rgba(233,30,140,0.35)" },
  { Icon: CashOutIcon, labelKey: "cashOut" as const, id: "cashout", bgStyle: "rgba(67,160,71,0.12)", ringStyle: "1px solid rgba(67,160,71,0.25)", rippleColor: "rgba(67,160,71,0.35)" },
  { Icon: PaymentIcon, labelKey: "payment" as const, id: "payment", bgStyle: "rgba(156,39,176,0.12)", ringStyle: "1px solid rgba(156,39,176,0.25)", rippleColor: "rgba(156,39,176,0.35)" },
  { Icon: BankTransferIcon, labelKey: "bankTransfer" as const, id: "bank", bgStyle: "rgba(33,150,243,0.12)", ringStyle: "1px solid rgba(33,150,243,0.25)", rippleColor: "rgba(33,150,243,0.35)" },
  { Icon: RechargeIcon, labelKey: "recharge" as const, id: "recharge", bgStyle: "rgba(0,188,212,0.12)", ringStyle: "1px solid rgba(0,188,212,0.25)", rippleColor: "rgba(0,188,212,0.35)" },
  { Icon: PayBillIcon, labelKey: "payBill" as const, id: "bill", bgStyle: "rgba(255,193,7,0.12)", ringStyle: "1px solid rgba(255,193,7,0.25)", rippleColor: "rgba(255,193,7,0.45)" },
  { Icon: ShopIcon, labelKey: "shop" as const, id: "shop", bgStyle: "rgba(255,112,67,0.12)", ringStyle: "1px solid rgba(255,112,67,0.25)", rippleColor: "rgba(255,112,67,0.35)" },
  { Icon: MoreIcon, labelKey: "more" as const, id: "more", bgStyle: "rgba(120,120,140,0.10)", ringStyle: "1px solid rgba(120,120,140,0.20)", rippleColor: "rgba(120,120,140,0.30)" },
];

const moreServices = [
  { id: "refer", Icon: ReferIcon, label: "Refer & Earn", desc: "Invite friends & earn", gradient: "from-orange-500 to-red-500" },
  { id: "savings", Icon: SavingsIcon, label: "Savings", desc: "Set goals & grow money", gradient: "from-emerald-500 to-teal-600" },
  { id: "coupons", Icon: CouponsIcon, label: "Coupons & Offers", desc: "Exclusive deals", gradient: "from-pink-500 to-rose-600", soon: true },
  { id: "donations", Icon: DonationsIcon, label: "Donations", desc: "Support causes", gradient: "from-red-500 to-rose-700", soon: true },
  { id: "loan", Icon: LoanIcon, label: "Loan", desc: "Quick personal loans", gradient: "from-amber-500 to-orange-600", soon: true },
  { id: "insurance", Icon: InsuranceIcon, label: "Insurance", desc: "Protect what matters", gradient: "from-violet-500 to-purple-600", soon: true },
  { id: "giftcards", Icon: GiftCardsIcon, label: "Gift Cards", desc: "Send & redeem gifts", gradient: "from-orange-400 to-red-500", soon: true },
];

interface RippleState { x: number; y: number; id: number; }

interface QuickActionsProps {
  onSendMoney: () => void;
  onCashOut: () => void;
  onPayment: () => void;
  onRecharge: () => void;
  onPayBill: () => void;
  onAddMoney: () => void;
  onRefer: () => void;
  onShop: () => void;
  onBankTransfer: () => void;
  onSavings: () => void;
}

const QuickActions = ({ onSendMoney, onCashOut, onPayment, onRecharge, onPayBill, onAddMoney, onRefer, onShop, onBankTransfer, onSavings }: QuickActionsProps) => {
  const { t } = useI18n();
  const { isLocked } = useFeatureLocks();
  const { isDisabled: isGloballyDisabled } = useGlobalToggles();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Record<string, RippleState | null>>({});
  const rippleCounterRef = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [hoveredMoreId, setHoveredMoreId] = useState<string | null>(null);

  const triggerRipple = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    const el = (e.currentTarget as HTMLElement).querySelector("[data-ripple-container]") as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else if ("clientX" in e) { clientX = e.clientX; clientY = e.clientY; }
    else { clientX = rect.left + rect.width / 2; clientY = rect.top + rect.height / 2; }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    rippleCounterRef.current += 1;
    setRipples(prev => ({ ...prev, [id]: { x, y, id: rippleCounterRef.current } }));
    setTimeout(() => setRipples(prev => ({ ...prev, [id]: null })), 600);
  }, []);

  const handleAction = (id: string, label: string) => {
    const featureKey = FEATURE_MAP[id];
    if (featureKey && isGloballyDisabled(featureKey)) {
      toast.error(`${label} is currently unavailable.`);
      return;
    }
    if (id === "send") return onSendMoney();
    if (id === "cashout") return onCashOut();
    if (id === "payment") return onPayment();
    if (id === "addmoney") return onAddMoney();
    if (id === "recharge") return onRecharge();
    if (id === "bill") return onPayBill();
    if (id === "bank") return onBankTransfer();
    if (id === "shop") return onShop();
    if (id === "more") return setExpanded(prev => !prev);
    toast.info(`${label} coming soon!`);
  };

  const handleMoreService = (id: string, soon?: boolean) => {
    if (soon) { toast.info("Coming soon!"); return; }
    if (id === "refer") onRefer();
    else if (id === "savings") onSavings();
  };

  return (
    <div className="bg-card rounded-3xl shadow-card border border-border/60 p-4 sm:p-5">
      <div className="grid grid-cols-4 gap-y-5 gap-x-2 sm:gap-x-3">
        {actionDefs.map((action, index) => {
          const isHovered = hoveredId === action.id;
          const ripple = ripples[action.id];
          const label = t(action.labelKey);
          const featureKey = FEATURE_MAP[action.id];
          const lockStatus = featureKey ? isLocked(featureKey) : { locked: false };
          const isFeatureLocked = lockStatus.locked;
          const isGlobalOff = featureKey ? isGloballyDisabled(featureKey) : false;
          const isUnavailable = isFeatureLocked || isGlobalOff;

          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.04 + index * 0.05, ease: [0.23, 1, 0.32, 1] }}
              whileTap={{ scale: 0.90 }}
              onClick={(e) => { triggerRipple(action.id, e); handleAction(action.id, label); }}
              onTouchStart={(e) => triggerRipple(action.id, e)}
              onHoverStart={() => setHoveredId(action.id)}
              onHoverEnd={() => setHoveredId(null)}
              className={`flex flex-col items-center gap-2.5 group outline-none relative ${isUnavailable ? "opacity-60" : ""}`}
            >
              <motion.div
                data-ripple-container
                whileHover={{ scale: 1.06, y: -2 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className="relative flex items-center justify-center rounded-full shadow-sm group-hover:shadow-md transition-shadow duration-200 overflow-hidden"
                style={{ width: 56, height: 56, background: action.bgStyle, outline: action.ringStyle }}
              >
                <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-[10px] transition-opacity duration-300 -z-10 scale-110" style={{ background: action.bgStyle }} />
                <AnimatePresence>
                  {ripple && (
                    <motion.span
                      key={ripple.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{ left: ripple.x, top: ripple.y, width: 8, height: 8, marginLeft: -4, marginTop: -4, background: action.rippleColor }}
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 10, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>
                {action.id === "more" ? (
                  <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-center">
                    <MoreIcon />
                  </motion.div>
                ) : (
                  <action.Icon isHovered={isHovered} />
                )}

                {isFeatureLocked && (
                  <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center shadow-md z-10">
                    <Lock className="w-2.5 h-2.5 text-destructive-foreground" />
                  </div>
                )}
              </motion.div>
              <span className="text-[10px] sm:text-[10.5px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-colors duration-150 px-0.5">
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Inline expanded More services */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 mt-4 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">More Services</h3>
                <button onClick={() => setExpanded(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                  <ChevronUp size={14} className="text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-y-5 gap-x-2 sm:gap-x-3">
                {moreServices.map((item, i) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.7, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.06 * i, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                    whileTap={{ scale: 0.90 }}
                    onClick={() => handleMoreService(item.id, item.soon)}
                    onMouseEnter={() => setHoveredMoreId(item.id)}
                    onMouseLeave={() => setHoveredMoreId(null)}
                    className="flex flex-col items-center gap-2.5 group outline-none relative"
                  >
                    <motion.div
                      whileHover={{ scale: 1.06, y: -2 }}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      className="relative flex items-center justify-center rounded-full shadow-sm group-hover:shadow-md transition-shadow duration-200 overflow-hidden"
                      style={{ width: 56, height: 56 }}
                    >
                      <div className={`absolute inset-0 rounded-full bg-gradient-to-b ${item.gradient} opacity-[0.14]`} />
                      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-[10px] transition-opacity duration-300 -z-10 scale-110">
                        <div className={`w-full h-full bg-gradient-to-b ${item.gradient} opacity-30`} />
                      </div>
                      <item.Icon isHovered={hoveredMoreId === item.id} />
                    </motion.div>
                    {item.soon && (
                      <div className="absolute -top-1 right-0 z-10">
                        <span className="text-[7px] font-bold text-muted-foreground/70">Soon</span>
                      </div>
                    )}
                    <span className="text-[10px] sm:text-[10.5px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-colors duration-150 px-0.5">
                      {item.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickActions;
