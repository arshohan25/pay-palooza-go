import { Eye, EyeOff, Copy, CheckCheck, QrCode, Share2 } from "lucide-react";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import UserQrModal from "@/components/UserQrModal";
import WalletShareSheet from "@/components/WalletShareSheet";
import { getBalance, onBalanceChange, fetchBalance, setupBalanceRealtime } from "@/lib/balanceStore";
import { AddMoneyIcon } from "@/components/QuickActionIcons";
import { generateWalletId } from "@/lib/walletId";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/hooks/use-profile";

const REGISTERED_KEY = "mfs_registered_phone";

function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning" as const;
  if (h < 17) return "goodAfternoon" as const;
  return "goodEvening" as const;
}

interface BalanceCardProps {
  onAddMoney?: () => void;
}

const BalanceCard = React.memo(({ onAddMoney }: BalanceCardProps) => {
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
        className="relative overflow-hidden rounded-[19px] gradient-hero text-primary-foreground shadow-glow-lg"
      >
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-10 -left-5 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-3 right-20 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative p-4 sm:p-5">
          {/* Top row — Greeting left, QR + Copy right */}
          <div className="flex items-start justify-between mb-3">
            {/* LEFT: Greeting + name (yellow circle area) */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60 leading-tight">{t(getGreetingKey())} 👋</p>
              <p className="text-[15px] font-bold opacity-95 leading-tight tracking-tight text-shine">{userName}</p>
            </div>

            {/* RIGHT: QR + Copy */}
            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setShowQr(true)}
                className="glass-hero w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors tap-target"
                title={t("showQrCode")}
              >
                <QrCode size={13} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleCopyId}
                className="glass-hero w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors tap-target"
                title={t("copyWalletId")}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copied ? "check" : "copy"}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.16 }}
                  >
                    {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          {/* Balance row — tap to reveal + Add Money inline on the right */}
          <div className="mb-3 flex items-center gap-3">
            {/* Balance tap area */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55 mb-1.5">{t("availableBalance")}</p>
              <motion.button
                className="flex items-center group w-fit"
                onClick={handleToggleBalance}
                whileTap={{ scale: 0.97 }}
                aria-label={showBalance ? t("hideBalance") : t("tapToSeeBalance")}
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
                      <span className="text-lg font-semibold opacity-70">৳</span>
                      <span className="text-[2rem] sm:text-[2.2rem] font-bold tracking-tight leading-none text-shine">
                        {displayBalance.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.55 }}
                        className="flex items-center self-center ml-1"
                      >
                        <EyeOff size={12} />
                      </motion.span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hidden"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                      className="glass-hero rounded-2xl px-4 py-2 flex items-center gap-2"
                    >
                      <Eye size={13} className="opacity-85" />
                      <span className="text-[12.5px] font-semibold opacity-95 tracking-wide">{t("tapToSeeBalance")}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

            {/* RIGHT of balance: Add Money (white circle area) */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={onAddMoney}
              className="flex flex-col items-center gap-1 bg-white/15 hover:bg-white/25 transition-colors rounded-2xl px-3 py-2 tap-target shrink-0"
              title={t("addMoneyTitle")}
            >
              <div className="w-7 h-7 flex items-center justify-center">
                <AddMoneyIcon isHovered={false} />
              </div>
              <span className="text-[9.5px] font-bold opacity-95 whitespace-nowrap">{t("addMoney")}</span>
            </motion.button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/12 mb-3" />

          {/* Bottom row: Wallet ID left | Share right (green circle area) */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] opacity-45 mb-0.5">{t("walletId")}</p>
              <p className="text-[12px] font-mono font-semibold tracking-widest opacity-90">{userId}</p>
            </div>

            {/* Share button */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleShare}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 transition-colors rounded-xl px-2.5 py-1.5 tap-target"
              title="Share QR / Wallet ID"
            >
              <Share2 size={11} className="opacity-90" />
              <span className="text-[10.5px] font-bold opacity-95 whitespace-nowrap">{t("share")}</span>
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
});

BalanceCard.displayName = "BalanceCard";

export default BalanceCard;
