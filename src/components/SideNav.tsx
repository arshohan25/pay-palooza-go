import { LayoutDashboard, ArrowLeftRight, ScanLine, MessageCircle, CircleUserRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { getTxnNotifCount, onTxnNotifChange } from "@/lib/txnNotifStore";
import { getInboxCount, onInboxChange } from "@/lib/inboxStore";
import { useI18n } from "@/lib/i18n";

const navDefs = [
  { icon: LayoutDashboard, labelKey: "home" as const, id: "home" },
  { icon: ArrowLeftRight,  labelKey: "history" as const, id: "history" },
  { icon: ScanLine,        labelKey: "scan" as const, id: "scan" },
  { icon: MessageCircle,   labelKey: "inbox" as const, id: "inbox" },
  { icon: CircleUserRound, labelKey: "account" as const, id: "account" },
];

interface SideNavProps {
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

const SideNav = ({ activeTab = "home", onTabChange }: SideNavProps) => {
  const { t } = useI18n();
  const [txnCount, setTxnCount]     = useState(getTxnNotifCount);
  const [inboxCount, setInboxCount] = useState(getInboxCount);
  const displayName = localStorage.getItem("mfs_user_name") || "My Wallet";
  const phone       = localStorage.getItem("mfs_registered_phone") || "—";
  const initials    = displayName.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  useEffect(() => {
    const unsub1 = onTxnNotifChange(setTxnCount);
    const unsub2 = onInboxChange(setInboxCount);
    return () => { unsub1(); unsub2(); };
  }, []);
  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border/60 shadow-card z-40">
      {/* Brand */}
      <div className="px-5 py-6 flex items-center gap-3 border-b border-border/60">
        <div className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-glow shrink-0">
          ₿
        </div>
        <div>
          <p className="text-[14px] font-bold text-foreground">EasyPay</p>
          <p className="text-[10px] text-muted-foreground font-medium">{t("mobileFinancialService")}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {navDefs.map((item) => {
          const isActive = activeTab === item.id;
          const label = t(item.labelKey);
          return (
            <motion.button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              whileTap={{ scale: 0.97 }}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[13.5px] font-semibold transition-all duration-150 group ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {/* Active bg */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="sidenav-indicator"
                    className="absolute inset-0 gradient-primary rounded-2xl shadow-glow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </AnimatePresence>
              <div className="relative z-10 shrink-0">
                <item.icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {/* History transaction badge */}
                <AnimatePresence>
                  {item.id === "history" && txnCount > 0 && !isActive && (
                    <motion.span
                      key="hist-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-background"
                    >
                      {txnCount > 9 ? "9+" : txnCount}
                    </motion.span>
                  )}
                  {item.id === "inbox" && inboxCount > 0 && !isActive && (
                    <motion.span
                      key="inbox-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 gradient-send text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-background"
                    >
                      {inboxCount > 9 ? "9+" : inboxCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span className="relative z-10">{label}</span>
              {/* Inline count label for inbox on sidebar */}
              {item.id === "inbox" && inboxCount > 0 && !isActive && (
                <span className="relative z-10 ml-auto min-w-[18px] h-[18px] px-1 gradient-send text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {inboxCount > 9 ? "9+" : inboxCount}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* User card */}
      <div className="px-4 pb-5">
        <div className="bg-muted/50 border border-border/60 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 shadow-glow">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground truncate">{displayName}</p>
            <p className="text-[10.5px] text-muted-foreground truncate">{phone}</p>
          </div>
          <div className="ml-auto w-2 h-2 bg-primary rounded-full shrink-0 shadow-glow" />
        </div>
      </div>
    </aside>
  );
};

export default SideNav;
