import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowDownLeft, ArrowUpRight, Tag, ShieldAlert,
  CheckCheck, Trash2, Bell, BellOff,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────
type NGroup = "transaction" | "promo" | "system";

interface Notification {
  id: string;
  group: NGroup;
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: typeof Bell;
  iconClass: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const INITIAL: Notification[] = [
  {
    id: "n1", group: "transaction", read: false,
    title: "Money Received",
    body: "৳25,000 received from Salary – XYZ Corp",
    time: "2 min ago",
    icon: ArrowDownLeft, iconClass: "text-primary bg-primary/10",
  },
  {
    id: "n2", group: "transaction", read: false,
    title: "Send Money Successful",
    body: "৳500 sent to Rahim Uddin",
    time: "1 hr ago",
    icon: ArrowUpRight, iconClass: "text-destructive bg-destructive/10",
  },
  {
    id: "n3", group: "transaction", read: true,
    title: "Bill Payment Done",
    body: "DESCO electricity bill ৳1,850 paid",
    time: "Yesterday",
    icon: CheckCheck, iconClass: "text-orange-500 bg-orange-500/10",
  },
  {
    id: "n4", group: "promo", read: false,
    title: "🎁 Cashback Offer",
    body: "Get 5% cashback on mobile recharges this week!",
    time: "3 hr ago",
    icon: Tag, iconClass: "text-accent bg-accent/10",
  },
  {
    id: "n5", group: "promo", read: true,
    title: "🌟 Refer & Earn",
    body: "Invite friends and earn ৳50 for each referral.",
    time: "2 days ago",
    icon: Tag, iconClass: "text-accent bg-accent/10",
  },
  {
    id: "n6", group: "system", read: false,
    title: "Security Alert",
    body: "A new device signed into your account. Not you? Contact support.",
    time: "5 hr ago",
    icon: ShieldAlert, iconClass: "text-rose-500 bg-rose-500/10",
  },
  {
    id: "n7", group: "system", read: true,
    title: "KYC Verified",
    body: "Your identity has been verified successfully.",
    time: "3 days ago",
    icon: CheckCheck, iconClass: "text-primary bg-primary/10",
  },
];

const GROUP_LABELS: Record<NGroup, string> = {
  transaction: "Transactions",
  promo: "Promotions",
  system: "System",
};

const GROUP_ORDER: NGroup[] = ["transaction", "promo", "system"];

// ── Component ─────────────────────────────────────────────────────────────────
interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL);

  const markRead    = (id: string)  => setNotifications((n) => n.map((x) => x.id === id ? { ...x, read: true } : x));
  const markAllRead = ()            => setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  const clearAll    = ()            => setNotifications([]);
  const dismiss     = (id: string)  => setNotifications((n) => n.filter((x) => x.id !== id));

  const unread = notifications.filter((n) => !n.read).length;

  // Group and filter
  const grouped = GROUP_ORDER.reduce<Record<NGroup, Notification[]>>((acc, g) => {
    acc[g] = notifications.filter((n) => n.group === g);
    return acc;
  }, { transaction: [], promo: [], system: [] });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="nc-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel — slides in from right on md+, slides up from bottom on mobile */}
          <motion.div
            key="nc-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="fixed top-0 right-0 bottom-0 z-[81] w-full max-w-sm bg-background shadow-float flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Bell size={19} className="text-foreground" strokeWidth={2} />
                <h2 className="text-[17px] font-bold text-foreground">{t("notifications")}</h2>
                <AnimatePresence>
                  {unread > 0 && (
                    <motion.span
                      key="badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="min-w-[20px] h-5 px-1.5 gradient-send text-white text-[11px] font-bold rounded-full flex items-center justify-center"
                    >
                      {unread}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-1"
                  >
                    <CheckCheck size={12} /> {t("allRead")}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={12} /> {t("clear")}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground ml-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence>
                {notifications.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-3 py-20"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                      <BellOff size={28} className="text-muted-foreground" />
                    </div>
                    <p className="font-bold text-foreground text-sm">{t("allCaughtUp")}</p>
                    <p className="text-xs text-muted-foreground">{t("noNotificationsRightNow")}</p>
                  </motion.div>
                ) : (
                  GROUP_ORDER.filter((g) => grouped[g].length > 0).map((group) => (
                    <div key={group}>
                      {/* Group label */}
                      <div className="px-5 py-2 bg-muted/40 border-b border-border/40">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {t(group === "transaction" ? "ncTransactions" : group === "promo" ? "ncPromotions" : "ncSystem")}
                        </p>
                      </div>

                      {/* Items */}
                      <AnimatePresence initial={false}>
                        {grouped[group].map((n) => {
                          const Icon = n.icon;
                          return (
                            <motion.div
                              key={n.id}
                              layout
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                              onClick={() => markRead(n.id)}
                              className={`relative flex items-start gap-3 px-5 py-3.5 border-b border-border/40 cursor-pointer transition-colors hover:bg-muted/40 ${
                                !n.read ? "bg-primary/[0.03]" : ""
                              }`}
                            >
                              {/* Unread dot */}
                              {!n.read && (
                                <span className="absolute left-2.5 top-4 w-1.5 h-1.5 rounded-full bg-primary" />
                              )}

                              {/* Icon */}
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.iconClass}`}>
                                <Icon size={16} strokeWidth={2.2} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] leading-snug ${!n.read ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}>
                                  {n.title}
                                </p>
                                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
                              </div>

                              {/* Dismiss */}
                              <button
                                onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors mt-0.5"
                              >
                                <X size={12} />
                              </button>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Export unread count hook helper ──────────────────────────────────────────
export { INITIAL as INITIAL_NOTIFICATIONS };
