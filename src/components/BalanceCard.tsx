import { Eye, EyeOff, Copy, CheckCheck, QrCode, Share2 } from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import UserQrModal from "@/components/UserQrModal";
import { getBalance, onBalanceChange } from "@/lib/balanceStore";
import { AddMoneyIcon } from "@/components/QuickActionIcons";

const REGISTERED_KEY = "mfs_registered_phone";
const USER_NAME_KEY  = "mfs_user_name";

const generateUserId = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  return `MFS-${abs.slice(0, 4)}-${abs.slice(4, 8)}`;
};

const getDisplayName = (): string => {
  const stored = localStorage.getItem(USER_NAME_KEY);
  if (stored) return stored;
  const phone = localStorage.getItem(REGISTERED_KEY);
  if (phone) return `+880 ${phone.slice(0, 3)}****${phone.slice(-3)}`;
  return "My Wallet";
};

interface BalanceCardProps {
  onAddMoney?: () => void;
}

const BalanceCard = ({ onAddMoney }: BalanceCardProps) => {
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const phone   = useMemo(() => localStorage.getItem(REGISTERED_KEY) ?? "WALLET_USER", []);
  const userId  = useMemo(() => generateUserId(phone), [phone]);
  const userName = useMemo(() => getDisplayName(), []);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated balance
  const motionBalance = useMotionValue(getBalance());
  const [displayBalance, setDisplayBalance] = useState(getBalance());

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
    }, 8000);
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

  const handleShare = async () => {
    const text = `My Wallet ID: ${userId}\nScan my QR to send money.`;
    if (navigator.share) {
      try { await navigator.share({ title: "My MFS Wallet", text }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-3xl gradient-hero text-primary-foreground shadow-glow-lg"
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60 leading-tight">Welcome back 👋</p>
              <p className="text-[15px] font-bold opacity-95 leading-tight tracking-tight">{userName}</p>
            </div>

            {/* RIGHT: QR + Copy */}
            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setShowQr(true)}
                className="glass-hero w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors tap-target"
                title="Show QR Code"
              >
                <QrCode size={13} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleCopyId}
                className="glass-hero w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors tap-target"
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

          {/* Balance row — tap to reveal + Add Money inline on the right */}
          <div className="mb-3 flex items-center gap-3">
            {/* Balance tap area */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-55 mb-1.5">Available Balance</p>
              <motion.button
                className="flex items-center group"
                onClick={handleToggleBalance}
                whileTap={{ scale: 0.97 }}
                aria-label={showBalance ? "Hide balance" : "Tap to see balance"}
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
                      <span className="text-[2rem] sm:text-[2.2rem] font-bold tracking-tight leading-none">
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
                      <span className="text-[12.5px] font-semibold opacity-95 tracking-wide">Tap to see balance</span>
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
              title="Add Money"
            >
              <div className="w-7 h-7 flex items-center justify-center">
                <AddMoneyIcon isHovered={false} />
              </div>
              <span className="text-[9.5px] font-bold opacity-95 whitespace-nowrap">Add Money</span>
            </motion.button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/12 mb-3" />

          {/* Bottom row: Wallet ID left | Share right (green circle area) */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] opacity-45 mb-0.5">Wallet ID</p>
              <p className="text-[12px] font-mono font-semibold tracking-widest opacity-90">{userId}</p>
            </div>

            {/* Share — green tinted glass (green circle area) */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleShare}
              className="flex items-center gap-1.5 bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-300/25 transition-colors rounded-xl px-2.5 py-1.5 tap-target"
              title="Share QR / Wallet ID"
            >
              <Share2 size={11} className="opacity-90" />
              <span className="text-[10.5px] font-bold opacity-95 whitespace-nowrap">Share</span>
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
    </>
  );
};

export default BalanceCard;
