import { motion } from "framer-motion";
import { Gift } from "lucide-react";

const PromoCard = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="gradient-accent rounded-2xl p-4 flex items-center gap-4 shadow-card"
    >
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
        <Gift size={24} className="text-accent-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-accent-foreground">Cashback Offer!</p>
        <p className="text-xs text-accent-foreground/80">
          Get 5% cashback on mobile recharge. Limited time.
        </p>
      </div>
    </motion.div>
  );
};

export default PromoCard;
