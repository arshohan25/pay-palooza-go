import { Home, ArrowLeftRight, QrCode, Bell, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { getTxnNotifCount, onTxnNotifChange } from "@/lib/txnNotifStore";

const navItems = [
  { icon: Home,           label: "Home",    id: "home" },
  { icon: ArrowLeftRight, label: "History", id: "history" },
  { icon: QrCode,         label: "Scan",    id: "scan", center: true },
  { icon: Bell,           label: "Inbox",   id: "inbox" },
  { icon: User,           label: "Account", id: "account" },
];

interface BottomNavProps {
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

const BottomNav = ({ activeTab = "home", onTabChange }: BottomNavProps) => {
  const [txnCount, setTxnCount] = useState(getTxnNotifCount);

  useEffect(() => {
    const unsub = onTxnNotifChange(setTxnCount);
    return unsub;
  }, []);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-0">
      <div className="glass rounded-2xl border border-border/60 shadow-float max-w-md mx-auto">
        <div className="flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            if (item.center) {
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => onTabChange?.(item.id)}
                  className="gradient-primary -mt-7 w-13 h-13 rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow-lg tap-target"
                  style={{ width: 52, height: 52, marginTop: -24 }}
                  aria-label="Scan QR"
                >
                  <item.icon size={22} strokeWidth={2} />
                </motion.button>
              );
            }

            const showBadge = item.id === "history" && txnCount > 0;

            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.88 }}
                onClick={() => onTabChange?.(item.id)}
                className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-colors tap-target ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                aria-label={item.label}
              >
                {/* Active indicator pill */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-indicator"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                    />
                  )}
                </AnimatePresence>

                {/* Icon wrapper with badge */}
                <div className="relative">
                  <item.icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className="relative z-10 transition-all duration-150"
                  />
                  {/* Transaction badge */}
                  <AnimatePresence>
                    {showBadge && (
                      <motion.span
                        key="txn-badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-background z-20"
                      >
                        {txnCount > 9 ? "9+" : txnCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <span className={`relative z-10 text-[10px] font-semibold transition-all duration-150 ${isActive ? "opacity-100" : "opacity-70"}`}>
                  {item.label}
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
