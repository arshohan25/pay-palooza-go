import { motion } from "framer-motion";
import { Gift, ChevronRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const PromoCard = () => {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-accent/15 via-accent/10 to-accent/5 border border-accent/20 press-effect cursor-pointer group"
    >
      <div className="relative flex items-center gap-3.5 p-4">
        {/* Icon */}
        <div className="w-11 h-11 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
          <Gift size={20} className="text-accent" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles size={10} className="text-accent" />
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-accent">
              {t("limitedOffer")}
            </span>
          </div>
          <p className="text-[13.5px] font-bold text-foreground leading-snug">
            {t("promoCashback")}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("promoValid")}
          </p>
        </div>

        {/* Arrow */}
        <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <ChevronRight size={15} className="text-accent group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
};

export default PromoCard;
