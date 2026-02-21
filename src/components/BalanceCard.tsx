import { Eye, EyeOff, Copy, CheckCheck, QrCode, Share2, Plus } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import UserQrModal from "@/components/UserQrModal";
import WalletShareSheet from "@/components/WalletShareSheet";
import { getBalance, onBalanceChange, fetchBalance, setupBalanceRealtime } from "@/lib/balanceStore";
import { generateWalletId } from "@/lib/walletId";
import { useI18n } from "@/lib/i18n";

const REGISTERED_KEY = "mfs_registered_phone";
const USER_NAME_KEY = "mfs_user_name";

interface BalanceCardProps {
  onAddMoney?: () => void;
}

const BalanceCard = ({ onAddMoney }: BalanceCardProps) => {
  const { t } = useI18n();
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showWalletShare, setShowWalletShare] = useState(false);
  const phone = useMemo(() => localStorage.getItem(REGISTERED_KEY) ?? "WALLET_USER", []);
  const userId = useMemo(() => generateWalletId(phone), [phone]);
  const userName = useMemo(() => {
    const stored = localStorage.getItem(USER_NAME_KEY);
    if (stored) return stored;
    if (phone) return `+880 ${phone.slice(0, 3)}****${phone.slice(-3)}`;
    return "My Wallet";
  }, [phone]);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const motionBalance = useMotionValue(getBalance());
  const [displayBalance, setDisplayBalance] = useState(getBalance());

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

  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowBalance(false), 8000);
  }, []);

  const handleToggleBalance = () => {
    setShowBalance((v) => {
      if (!v) startHideTimer();
      else if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-[28px] gradient-hero text-primary-foreground"
        style={{ boxShadow: "var(--shadow-glow-lg)" }}
      >
        {/* Decorative orbs */}
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/[0.04] pointer-events-none" />
        <div className="absolute bottom-0 -left-8 w-48 h-48 rounded-full bg-white/[0.03] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-full bg-white/[0.04] pointer-events-none" />

        <div className="relative p-5">
          {/* Balance section */}
          <div className="mb-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-50 mb-2">
              {t("availableBalance")}
            </p>
            <motion.button
              className="flex items-center group w-full"
              onClick={handleToggleBalance}
              whileTap={{ scale: 0.98 }}
              aria-label={showBalance ? "Hide balance" : t("tapToSeeBalance")}
            >
              <AnimatePresence mode="wait">
                {showBalance ? (
                  <motion.div
                    key="shown"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-baseline gap-1.5"
                  >
                    <span className="text-xl font-semibold opacity-60">৳</span>
                    <span className="text-[2.4rem] font-extrabold tracking-tight leading-none">
                      {displayBalance.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <EyeOff size={14} className="opacity-40 ml-2 self-center" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="hidden"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="glass-hero rounded-2xl px-5 py-2.5 flex items-center gap-2.5"
                  >
                    <Eye size={14} className="opacity-80" />
                    <span className="text-[13px] font-semibold opacity-90 tracking-wide">
                      {t("tapToSeeBalance")}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 mb-5">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onAddMoney}
              className="flex items-center gap-2 bg-white/[0.15] hover:bg-white/[0.22] border border-white/[0.15] transition-colors rounded-2xl px-4 py-2.5 tap-target"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span className="text-[12px] font-bold">{t("addMoney")}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowQr(true)}
              className="w-10 h-10 rounded-2xl bg-white/[0.12] hover:bg-white/[0.18] border border-white/[0.12] flex items-center justify-center transition-colors tap-target"
              title="Show QR Code"
            >
              <QrCode size={15} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowWalletShare(true)}
              className="w-10 h-10 rounded-2xl bg-white/[0.12] hover:bg-white/[0.18] border border-white/[0.12] flex items-center justify-center transition-colors tap-target"
              title="Share"
            >
              <Share2 size={14} />
            </motion.button>
          </div>

          {/* Wallet ID */}
          <div className="h-px bg-white/[0.1] mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.16em] opacity-40 mb-0.5">
                {t("walletId")}
              </p>
              <p className="text-[12.5px] font-mono font-semibold tracking-widest opacity-85">
                {userId}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleCopyId}
              className="w-9 h-9 rounded-xl bg-white/[0.12] hover:bg-white/[0.18] flex items-center justify-center transition-colors tap-target"
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
                  {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.div>

      <UserQrModal open={showQr} onClose={() => setShowQr(false)} userId={userId} userName={userName} />
      <WalletShareSheet open={showWalletShare} onClose={() => setShowWalletShare(false)} userId={userId} userName={userName} />
    </>
  );
};

export default BalanceCard;
