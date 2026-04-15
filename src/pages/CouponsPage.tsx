import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Ticket, Copy, CheckCircle2,
  ShoppingBag, CreditCard, Smartphone, FileText, Zap, Tag, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setPendingCoupon } from "@/lib/couponStore";
import { useAiRewards } from "@/hooks/use-ai-rewards";
import AiRewardBanner from "@/components/AiRewardBanner";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number | null;
  expires_at: string | null;
  starts_at: string | null;
  usage_limit: number | null;
  used_count: number;
  applicable_flow: string | null;
}

const FLOW_MAP: Record<string, { label: string; icon: typeof ShoppingBag; route: string }> = {
  shop:       { label: "Shop",        icon: ShoppingBag, route: "/shop" },
  payment:    { label: "Payment",     icon: CreditCard,  route: "/?flow=payment" },
  cash_out:   { label: "Cash Out",    icon: Zap,         route: "/?flow=cash_out" },
  recharge:   { label: "Recharge",    icon: Smartphone,  route: "/?flow=recharge" },
  bill_pay:   { label: "Bill Pay",    icon: FileText,    route: "/?flow=bill_pay" },
  all:        { label: "All",         icon: Tag,         route: "/shop" },
};

export default function CouponsPage() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { rewards: aiCouponRewards, claimReward } = useAiRewards("coupon");
  const { rewards: aiOfferRewards, claimReward: claimOffer } = useAiRewards("offer");

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false });
      if (data) setCoupons(data as Coupon[]);
      setLoading(false);
    };
    load();
  }, []);

  const handleCopy = (coupon: Coupon) => {
    navigator.clipboard.writeText(coupon.code);
    setCopiedId(coupon.id);
    toast.success(`Copied: ${coupon.code}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUseNow = (coupon: Coupon) => {
    const flow = coupon.applicable_flow || "shop";
    const mapping = FLOW_MAP[flow] || FLOW_MAP.shop;
    setPendingCoupon({
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type as "percentage" | "flat",
      discount_value: coupon.discount_value,
      max_discount: coupon.max_discount,
      min_order_amount: coupon.min_order_amount,
      applicable_flow: flow,
    });
    navigator.clipboard.writeText(coupon.code);
    toast.success(`Coupon "${coupon.code}" applied! Redirecting…`);
    setTimeout(() => navigate(mapping.route), 400);
  };

  const formatDiscount = (c: Coupon) =>
    c.discount_type === "percentage" ? `${c.discount_value}%` : `৳${c.discount_value}`;

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expired";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Minimal header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/30 flex items-center gap-3 px-4 h-14">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="w-[18px] h-[18px] text-foreground" />
        </button>
        <h1 className="text-[15px] font-semibold text-foreground tracking-tight">Coupons</h1>
        <span className="text-[11px] text-muted-foreground font-medium ml-auto">
          {!loading && `${coupons.length} active`}
        </span>
      </div>

      <div className="px-4 pt-5 space-y-3">
        {/* AI Recommended */}
        {(aiCouponRewards.length > 0 || aiOfferRewards.length > 0) && (
          <AiRewardBanner rewards={[...aiCouponRewards, ...aiOfferRewards]} onClaim={(id) => {
            const isCoupon = aiCouponRewards.some(r => r.id === id);
            return isCoupon ? claimReward(id) : claimOffer(id);
          }} />
        )}

        {/* Loading */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[120px] w-full rounded-2xl" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
              <Ticket className="w-6 h-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">No coupons available</p>
            <p className="text-xs text-muted-foreground/50">Check back later for offers</p>
          </motion.div>
        ) : (
          /* Coupon cards */
          <AnimatePresence mode="popLayout">
            <div className="space-y-2.5">
              {coupons.map((coupon, i) => {
                const isCopied = copiedId === coupon.id;
                const flow = coupon.applicable_flow || "shop";
                const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
                const FlowIcon = flowInfo.icon;
                const isExpiring = coupon.expires_at && new Date(coupon.expires_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

                return (
                  <motion.div
                    key={coupon.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.03, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    layout
                    className="group bg-card rounded-2xl border border-border/40 overflow-hidden"
                  >
                    <div className="p-4">
                      {/* Top row: discount + flow */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[22px] font-extrabold text-primary leading-none tracking-tight">
                            {formatDiscount(coupon)}
                          </span>
                          <span className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide">off</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <FlowIcon className="w-3 h-3" />
                          <span className="text-[10px] font-medium">{flowInfo.label}</span>
                        </div>
                      </div>

                      {/* Description */}
                      {coupon.description && (
                        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                          {coupon.description}
                        </p>
                      )}

                      {/* Meta chips */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
                        {coupon.min_order_amount && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                            Min ৳{coupon.min_order_amount}
                          </span>
                        )}
                        {coupon.max_discount && coupon.discount_type === "percentage" && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                            Max ৳{coupon.max_discount}
                          </span>
                        )}
                        {coupon.expires_at && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isExpiring
                              ? "text-destructive bg-destructive/8"
                              : "text-muted-foreground bg-muted/50"
                          }`}>
                            <Clock className="w-2.5 h-2.5" />
                            {getDaysLeft(coupon.expires_at)}
                          </span>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-border/40 mb-3.5 -mx-4 px-4">
                        <div className="h-full bg-border/40" />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 rounded-xl font-semibold text-[12px] h-9"
                          onClick={() => handleUseNow(coupon)}
                        >
                          Apply & Use
                        </Button>
                        <button
                          onClick={() => handleCopy(coupon)}
                          className={`h-9 px-3 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                            isCopied
                              ? "bg-primary/5 border-primary/20 text-primary"
                              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                        >
                          {isCopied ? (
                            <><CheckCircle2 className="w-3 h-3" /> Copied</>
                          ) : (
                            <><Copy className="w-3 h-3" /> {coupon.code}</>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
