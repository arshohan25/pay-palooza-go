import { motion } from "framer-motion";
import { Ticket, Sparkles, X } from "lucide-react";
import type { PendingCoupon } from "@/lib/couponStore";

interface CouponBannerProps {
  coupon: PendingCoupon;
  discount: number;
  onRemove: () => void;
}

const CouponBanner = ({ coupon, discount, onRemove }: CouponBannerProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: -6 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: -6 }}
    transition={{ type: "spring", stiffness: 400, damping: 28 }}
    className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 via-primary/5 to-accent/8"
  >
    {/* Decorative shimmer */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-primary/8 blur-xl" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-accent/10 blur-xl" />
    </div>

    <div className="relative flex items-center gap-3 px-3.5 py-2.5">
      {/* Animated icon */}
      <motion.div
        animate={{ rotate: [0, -8, 8, -4, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
        className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
      >
        <Ticket size={18} className="text-primary" />
      </motion.div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Sparkles size={10} className="text-primary" />
          <p className="text-[11px] font-bold text-primary tracking-wide uppercase">
            {coupon.code}
          </p>
        </div>
        <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight">
          {coupon.discount_type === "percentage"
            ? `${coupon.discount_value}% off${coupon.max_discount ? ` · max ৳${coupon.max_discount}` : ""}`
            : `৳${coupon.discount_value} flat discount`}
          {discount > 0 && (
            <span className="text-primary font-semibold"> — saving ৳{discount.toFixed(0)}</span>
          )}
        </p>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors shrink-0"
      >
        <X size={13} className="text-destructive" />
      </button>
    </div>
  </motion.div>
);

export default CouponBanner;
