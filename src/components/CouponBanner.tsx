import { motion, AnimatePresence } from "framer-motion";
import { Ticket, X } from "lucide-react";
import type { PendingCoupon } from "@/lib/couponStore";
import { useI18n } from "@/lib/i18n";

interface CouponBannerProps {
  coupon: PendingCoupon;
  discount: number;
  onRemove: () => void;
}

const CouponBanner = ({ coupon, discount, onRemove }: CouponBannerProps) => {
  const { t } = useI18n();
  return (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-primary/[0.04] border border-primary/10"
  >
    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <Ticket size={14} className="text-primary" />
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-semibold text-foreground leading-none tracking-tight">
        {coupon.code}
        {discount > 0 && (
          <span className="text-primary ml-1.5 font-medium">−৳{discount.toFixed(0)} {t("cbOff")}</span>
        )}
      </p>
      <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-none">
        {coupon.discount_type === "percentage"
          ? `${coupon.discount_value}%${coupon.max_discount ? ` ${t("cbUpTo")} ৳${coupon.max_discount}` : ""}`
          : `৳${coupon.discount_value} ${t("cbFlat")}`}
      </p>
    </div>

    <button
      onClick={onRemove}
      className="w-6 h-6 rounded-full bg-muted/60 hover:bg-destructive/10 flex items-center justify-center transition-colors shrink-0 group"
    >
      <X size={11} className="text-muted-foreground group-hover:text-destructive transition-colors" />
    </button>
  </motion.div>
  );
};

export default CouponBanner;
