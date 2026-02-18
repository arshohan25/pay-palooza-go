import { Eye, EyeOff, Copy, CheckCheck, QrCode } from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import UserQrModal from "@/components/UserQrModal";

// Generate a stable unique user ID from a fixed seed (would come from auth in a real app)
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
    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      const el = document.createElement("textarea");
      el.value = userId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="gradient-hero rounded-2xl p-6 text-primary-foreground shadow-glow"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm opacity-80">Available Balance</p>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-lg opacity-70">৳</span>
          <span className="text-3xl font-bold tracking-tight">
            {showBalance ? "12,450.75" : "••••••"}
          </span>
        </div>

        {/* User ID row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-60">Wallet ID</p>
            <p className="text-sm font-mono font-semibold tracking-widest opacity-90">{userId}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Copy button */}
            <motion.button
              onClick={handleCopyId}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors"
              title="Copy Wallet ID"
            >
              {copied
                ? <CheckCheck size={15} className="text-white" />
                : <Copy size={15} className="text-white" />
              }
            </motion.button>
            {/* QR share button */}
            <motion.button
              onClick={() => setShowQr(true)}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors"
              title="Show QR Code"
            >
              <QrCode size={15} className="text-white" />
            </motion.button>
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
