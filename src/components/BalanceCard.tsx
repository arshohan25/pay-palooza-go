import { Eye, EyeOff, Copy, CheckCheck, QrCode, TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UserQrModal from "@/components/UserQrModal";

const generateUserId = () => {
  const seed = "TANVIR_HASAN_2024";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  return `MFS-${abs.slice(0, 4)}-${abs.slice(4, 8)}`;
};

const BalanceCard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const userId = useMemo(() => generateUserId(), []);

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
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-3xl gradient-hero text-primary-foreground shadow-glow-lg"
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-12 -left-6 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-4 right-24 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative p-5 sm:p-6">
          {/* Top row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="glass-hero rounded-xl px-3 py-1 flex items-center gap-1.5">
                <TrendingUp size={12} strokeWidth={2.5} className="opacity-80" />
                <span className="text-[11px] font-semibold opacity-90 tracking-wide">+2.4% this month</span>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setShowBalance(!showBalance)}
              className="glass-hero w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors tap-target"
              aria-label="Toggle balance visibility"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={showBalance ? "eye" : "eyeoff"}
                  initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.7, rotate: 10 }}
                  transition={{ duration: 0.18 }}
                >
                  {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Balance */}
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-60 mb-1">Available Balance</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold opacity-70">৳</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={showBalance ? "shown" : "hidden"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="text-[2.2rem] sm:text-5xl font-bold tracking-tight leading-none"
                >
                  {showBalance ? "12,450.75" : "••••••"}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/15 mb-4" />

          {/* Wallet ID row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] opacity-50 mb-0.5">Wallet ID</p>
              <p className="text-sm font-mono font-semibold tracking-widest opacity-90">{userId}</p>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleCopyId}
                className="glass-hero w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors tap-target"
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
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setShowQr(true)}
                className="glass-hero w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors tap-target"
                title="Show QR Code"
              >
                <QrCode size={14} />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      <UserQrModal
        open={showQr}
        onClose={() => setShowQr(false)}
        userId={userId}
        userName="Tanvir Hasan"
      />
    </>
  );
};

export default BalanceCard;
