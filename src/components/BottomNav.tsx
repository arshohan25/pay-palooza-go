import { LayoutDashboard, ArrowLeftRight, ScanLine, MessageCircle, CircleUserRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { getTxnNotifCount, onTxnNotifChange } from "@/lib/txnNotifStore";
import { getInboxCount, onInboxChange } from "@/lib/inboxStore";
import { useI18n } from "@/lib/i18n";

const navDefs = [
  { icon: LayoutDashboard, labelKey: "home" as const, id: "home" },
  { icon: ArrowLeftRight,  labelKey: "history" as const, id: "history" },
  { icon: ScanLine,        labelKey: "scan" as const, id: "scan", center: true },
  { icon: MessageCircle,   labelKey: "inbox" as const, id: "inbox" },
  { icon: CircleUserRound, labelKey: "account" as const, id: "account" },
];

interface BottomNavProps {
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

const BottomNav = ({ activeTab = "home", onTabChange }: BottomNavProps) => {
  const { t } = useI18n();
  const [txnCount, setTxnCount] = useState(getTxnNotifCount);
  const [inboxCount, setInboxCount] = useState(getInboxCount);

  useEffect(() => {
    const unsub1 = onTxnNotifChange(setTxnCount);
    const unsub2 = onInboxChange(setInboxCount);
    return () => { unsub1(); unsub2(); };
  }, []);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-0">
      <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[22px] shadow-float max-w-md mx-auto">
        <div className="flex items-center justify-around px-1 py-1.5">
          {navDefs.map((item) => {
            const isActive = activeTab === item.id;
            const label = t(item.labelKey);

            if (item.center) {
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => onTabChange?.(item.id)}
                  className="gradient-primary -mt-6 rounded-[18px] flex items-center justify-center text-primary-foreground shadow-glow-lg tap-target"
                  style={{ width: 50, height: 50, marginTop: -22 }}
                  aria-label={label}
                >
                  <item.icon size={21} strokeWidth={2} />
                </motion.button>
              );
            }

            const showTxnBadge = item.id === "history" && txnCount > 0;
            const showInboxBadge = item.id === "inbox" && inboxCount > 0 && !isActive;

            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.88 }}
                onClick={() => onTabChange?.(item.id)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-colors tap-target ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                aria-label={label}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-indicator"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      className="absolute inset-0 bg-primary/8 rounded-2xl"
                    />
                  )}
                </AnimatePresence>

                <div className="relative">
                  <item.icon size={19} strokeWidth={isActive ? 2.5 : 1.8} className="relative z-10 transition-all duration-150" />
                  <AnimatePresence>
                    {showTxnBadge && (
                      <motion.span key="txn-badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-card z-20">
                        {txnCount > 9 ? "9+" : txnCount}
                      </motion.span>
                    )}
                    {showInboxBadge && (
                      <motion.span key="inbox-badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 gradient-send text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-card z-20">
                        {inboxCount > 9 ? "9+" : inboxCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <span className={`relative z-10 text-[9.5px] font-semibold transition-all duration-150 ${isActive ? "opacity-100" : "opacity-60"}`}>
                  {label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
