
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowDownLeft, ArrowUpRight, Tag, ShieldAlert,
  CheckCheck, Trash2, Bell, BellOff, type LucideIcon,
  Gift, Copy, ExternalLink, Coins, Megaphone, Truck, PackageCheck, Package,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useNotifications, type DbNotification } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Flow-based features that are opened via custom event on the Index page
const FLOW_FEATURES = new Set([
  "send-money", "cash-out", "add-money", "mobile-recharge", "pay-bill",
  "payment", "bank-transfer", "shop", "savings", "merchant-apply", "scan-pay", "kyc",
]);

function getIcon(cat: string): { icon: LucideIcon; iconClass: string } {
  switch (cat) {
    case "transaction":
    case "payment":
      return { icon: ArrowDownLeft, iconClass: "text-primary bg-primary/10" };
    case "transfer":
      return { icon: ArrowUpRight, iconClass: "text-destructive bg-destructive/10" };
    case "promo":
    case "promotion":
      return { icon: Megaphone, iconClass: "text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/30" };
    case "offer":
      return { icon: Tag, iconClass: "text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30" };
    case "coupon":
      return { icon: Gift, iconClass: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30" };
    case "cashback":
      return { icon: Coins, iconClass: "text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/30" };
    case "update":
      return { icon: CheckCheck, iconClass: "text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30" };
    case "kyc":
      return { icon: CheckCheck, iconClass: "text-primary bg-primary/10" };
    case "security":
      return { icon: ShieldAlert, iconClass: "text-rose-500 bg-rose-500/10" };
    default:
      return { icon: Bell, iconClass: "text-muted-foreground bg-muted" };
  }
}

const RICH_CATEGORIES = ["promo", "promotion", "offer", "coupon", "cashback", "update"];

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { t } = useI18n();
  const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const [detailNotif, setDetailNotif] = useState<DbNotification | null>(null);
  const navigate = useNavigate();

  // Sort by created_at descending — latest first
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleNotifClick = (n: DbNotification) => {
    markRead(n.id);
    if (RICH_CATEGORIES.includes(n.category)) {
      setDetailNotif(n);
    }
  };

  const meta = detailNotif?.metadata as any;
  const hasCoupon = meta?.coupon_code;
  const hasImage = meta?.image_url;
  const hasAction = meta?.action_url;

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="nc-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              key="nc-panel"
              initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed top-0 right-0 bottom-0 z-[81] w-full max-w-sm bg-background shadow-float flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Bell size={19} className="text-foreground" strokeWidth={2} />
                  <h2 className="text-[17px] font-bold text-foreground">{t("notifications")}</h2>
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="min-w-[20px] h-5 px-1.5 gradient-send text-white text-[11px] font-bold rounded-full flex items-center justify-center"
                      >{unreadCount}</motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead}
                      className="text-[11px] font-semibold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-1">
                      <CheckCheck size={12} /> {t("allRead")}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={clearAll}
                      className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors flex items-center gap-1">
                      <Trash2 size={12} /> {t("clear")}
                    </button>
                  )}
                  <button onClick={onClose}
                    className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground ml-1">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body — flat chronological list, latest first */}
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {sorted.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center h-full gap-3 py-20">
                      <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                        <BellOff size={28} className="text-muted-foreground" />
                      </div>
                      <p className="font-bold text-foreground text-sm">{t("allCaughtUp")}</p>
                      <p className="text-xs text-muted-foreground">{t("noNotificationsRightNow")}</p>
                    </motion.div>
                  ) : (
                    sorted.map((n) => {
                      const { icon: Icon, iconClass } = getIcon(n.category);
                      const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
                      const isRich = RICH_CATEGORIES.includes(n.category);
                      return (
                        <motion.div key={n.id} layout
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                          onClick={() => handleNotifClick(n)}
                          className={`relative flex items-start gap-3 px-5 py-3.5 border-b border-border/40 cursor-pointer transition-colors hover:bg-muted/40 ${!n.read ? "bg-primary/[0.03]" : ""}`}
                        >
                          {!n.read && <span className="absolute left-2.5 top-4 w-1.5 h-1.5 rounded-full bg-primary" />}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
                            <Icon size={16} strokeWidth={2.2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] leading-snug ${!n.read ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}>{n.title}</p>
                            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${iconClass}`}>
                                {n.category}
                              </span>
                              <p className="text-[10px] text-muted-foreground/60">{timeAgo}</p>
                              {isRich && (
                                <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                  Tap for details
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors mt-0.5">
                            <X size={12} />
                          </button>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Detail Popup Card — z-index above panel ── */}
      <Dialog open={!!detailNotif} onOpenChange={(o) => { if (!o) setDetailNotif(null); }}>
        <DialogPortal>
          <DialogOverlay className="z-[90]" />
          <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden z-[100] fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
          {detailNotif && (
            <>
              {hasImage && (
                <div className="w-full h-40 bg-muted overflow-hidden">
                  <img
                    src={meta.image_url}
                    alt={detailNotif.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              <div className="p-5 space-y-4">
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      detailNotif.category === "coupon" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                      detailNotif.category === "cashback" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                      detailNotif.category === "offer" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      detailNotif.category === "update" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    }`}>
                      {detailNotif.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(detailNotif.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <DialogTitle className="text-lg leading-tight">{detailNotif.title}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-1">
                    {detailNotif.body}
                  </DialogDescription>
                </DialogHeader>

                {hasCoupon && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
                    <Gift size={18} className="text-primary shrink-0" />
                    <span className="font-mono font-bold text-foreground tracking-wider flex-1">{meta.coupon_code}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(meta.coupon_code);
                        toast.success("Coupon code copied!");
                      }}
                    >
                      <Copy size={12} /> Copy
                    </Button>
                  </div>
                )}

                {hasAction && (
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      const url = meta.action_url as string;
                      setDetailNotif(null);
                      onClose();
                      if (FLOW_FEATURES.has(url)) {
                        // Dispatch custom event for Index page flow-based features
                        window.dispatchEvent(new CustomEvent("open-feature", { detail: url }));
                      } else if (url.startsWith("/")) {
                        navigate(url);
                      } else {
                        window.open(url, "_blank");
                      }
                    }}
                  >
                    <ExternalLink size={14} />
                    {meta.action_label || "Learn More"}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
