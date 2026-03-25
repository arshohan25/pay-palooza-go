import { Eye, EyeOff, Copy, CheckCheck, QrCode, Share2 } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import UserQrModal from "@/components/UserQrModal";
import WalletShareSheet from "@/components/WalletShareSheet";
import { getBalance, onBalanceChange, fetchBalance, setupBalanceRealtime } from "@/lib/balanceStore";
import { AddMoneyIcon } from "@/components/QuickActionIcons";
import { generateWalletId } from "@/lib/walletId";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/hooks/use-profile";

const REGISTERED_KEY = "mfs_registered_phone";

interface BalanceCardProps {
  onAddMoney?: () => void;
}

const BalanceCard = ({ onAddMoney }: BalanceCardProps) => {
  const { t } = useI18n();
  const { displayName: userName, phone: profilePhone } = useProfile();
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showWalletShare, setShowWalletShare] = useState(false);
  const phone   = useMemo(() => profilePhone || localStorage.getItem(REGISTERED_KEY) || "WALLET_USER", [profilePhone]);
  const userId  = useMemo(() => generateWalletId(phone), [phone]);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated balance
  const motionBalance = useMotionValue(getBalance());
  const [displayBalance, setDisplayBalance] = useState(getBalance());

  // Fetch real balance from DB on mount + setup realtime
  useEffect(() => {
    fetchBalance();
    setupBalanceRealtime();
  }, []);

  useEffect(() => {
    const unsub = onBalanceChange((next) => {
      animate(motionBalance, next, {
        duration: 1.2,
        ease: [0.23, 1, 0.32, 1],
        onUpdate: (v) => setDisplayBalance(v),
      });
    });
    const unsubMv = motionBalance.on("change", (v) => setDisplayBalance(v));
    return () => { unsub(); unsubMv(); };
  }, [motionBalance]);

  // Auto-hide balance after 8 seconds
  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowBalance(false);
    }, 5000);
  }, []);

  const handleToggleBalance = () => {
    setShowBalance((v) => {
      if (!v) {
        startHideTimer();
      } else {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      }
      return !v;
    });
  };

  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  const handleCopyId = async () => {
    try { await navigator.clipboard.writeText(userId); }
    catch {
      const el = document.createElement("textarea");
      el.value = userId; document.body.appendChild(el);
      el.select(); document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    setShowWalletShare(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-[2rem] gradient-hero text-primary-foreground shadow-glow-lg ring-1 ring-white/10"
      >
        {/* Bokeh decorative blobs */}
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-teal-300/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="relative p-5 sm:p-6">
          {/* Top row — Greeting left, QR + Copy right */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60 leading-tight">{t("welcomeBack")} 👋</p>
              <p className="text-[17px] font-bold opacity-95 leading-tight tracking-tight mt-0.5">{userName}</p>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setShowQr(true)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/12 backdrop-blur-xl border border-white/15 shadow-lg hover:bg-white/18 transition-all tap-target"
                title="Show QR Code"
              >
                <QrCode size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleCopyId}
                className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/12 backdrop-blur-xl border border-white/15 shadow-lg hover:bg-white/18 transition-all tap-target"
                title="Copy Wallet ID"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copied ? "check" : "copy"}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.16 }}
                  >
                    {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          {/* Balance row */}
          <div className="mb-5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-55 mb-2">{t("availableBalance")}</p>
              <motion.button
                className="flex items-center group w-fit"
                onClick={handleToggleBalance}
                whileTap={{ scale: 0.97 }}
                aria-label={showBalance ? "Hide balance" : t("tapToSeeBalance")}
              >
                <AnimatePresence mode="wait">
                  {showBalance ? (
                    <motion.div
                      key="shown"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                      className="flex items-baseline gap-1"
                    >
                      <span className="text-xl font-semibold opacity-70">৳</span>
                      <span className="text-[2.4rem] sm:text-[2.6rem] font-bold tracking-tight leading-none" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                        {displayBalance.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.55 }}
                        className="flex items-center self-center ml-1.5"
                      >
                        <EyeOff size={14} />
                      </motion.span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hidden"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                      className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-2.5 flex items-center gap-2.5 shadow-inner"
                    >
                      <Eye size={15} className="opacity-85" />
                      <span className="text-[13px] font-semibold opacity-95 tracking-wide">{t("tapToSeeBalance")}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={onAddMoney}
              className="flex flex-col items-center gap-1.5 bg-white/12 backdrop-blur-xl border border-white/15 hover:bg-white/18 transition-all rounded-2xl px-4 py-3 tap-target shrink-0 shadow-lg"
              title="Add Money"
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <AddMoneyIcon isHovered={false} />
              </div>
              <span className="text-[10px] font-bold opacity-95 whitespace-nowrap">{t("addMoney")}</span>
            </motion.button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/8 mb-4" />

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.16em] opacity-45 mb-1">{t("walletId")}</p>
              <p className="text-[13px] font-mono font-semibold tracking-[0.12em] opacity-90">{userId}</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleShare}
              className="flex items-center gap-2 bg-white/12 backdrop-blur-xl border border-white/15 hover:bg-white/18 transition-all rounded-2xl px-3.5 py-2 tap-target shadow-lg"
              title="Share QR / Wallet ID"
            >
              <Share2 size={13} className="opacity-90" />
              <span className="text-[11px] font-bold opacity-95 whitespace-nowrap">{t("share")}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      <UserQrModal
        open={showQr}
        onClose={() => setShowQr(false)}
        userId={userId}
        userName={userName}
      />

      <WalletShareSheet
        open={showWalletShare}
        onClose={() => setShowWalletShare(false)}
        userId={userId}
        userName={userName}
      />
    </>
  );
};

export default BalanceCard;
