import { motion } from "framer-motion";
import { Gift, ChevronRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const PromoCard = () => {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-3xl gradient-accent shadow-card press-effect cursor-pointer group"
    >
      {/* Decorative blobs */}
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -bottom-8 right-12 w-24 h-24 rounded-full bg-white/8 pointer-events-none" />

      <div className="relative flex items-center gap-4 p-4 sm:p-5">
        {/* Icon */}
        <div className="glass-hero w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
          <Gift size={22} className="text-accent-foreground" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles size={11} className="text-accent-foreground opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent-foreground/70">
              {t("limitedOffer")}
            </span>
          </div>
          <p className="text-[14px] font-bold text-accent-foreground leading-snug">
            {t("promoCashback")}
          </p>
          <p className="text-[11.5px] text-accent-foreground/75 mt-0.5">
            {t("promoValid")}
          </p>
        </div>

        {/* Arrow */}
        <div className="glass-hero w-8 h-8 rounded-xl flex items-center justify-center shrink-0">
          <ChevronRight size={15} className="text-accent-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
};

export default PromoCard;
