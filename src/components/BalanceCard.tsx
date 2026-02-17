import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const BalanceCard = () => {
  const [showBalance, setShowBalance] = useState(true);

  return (
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs opacity-60">Account Number</p>
          <p className="text-sm font-medium tracking-wide">017 •••• 4523</p>
        </div>
        <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-semibold">
          Personal
        </div>
      </div>
    </motion.div>
  );
};

export default BalanceCard;
