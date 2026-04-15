import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Ticket, Copy, CheckCircle2,
  ShoppingBag, CreditCard, Smartphone, FileText, Zap, Tag, Clock, Scissors
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
  shop:       { label: "Shop",      icon: ShoppingBag, route: "/shop" },
  payment:    { label: "Payment",   icon: CreditCard,  route: "/?flow=payment" },
  cash_out:   { label: "Cash Out",  icon: Zap,         route: "/?flow=cash_out" },
  recharge:   { label: "Recharge",  icon: Smartphone,  route: "/?flow=recharge" },
  bill_pay:   { label: "Bill Pay",  icon: FileText,    route: "/?flow=bill_pay" },
  all:        { label: "All",       icon: Tag,         route: "/shop" },
};

function CouponCard({ coupon, index, copiedId, onCopy, onUse }: {
  coupon: Coupon; index: number; copiedId: string | null;
  onCopy: (c: Coupon) => void; onUse: (c: Coupon) => void;
}) {
  const isCopied = copiedId === coupon.id;
  const flow = coupon.applicable_flow || "shop";
  const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
  const FlowIcon = flowInfo.icon;
  const isExpiring = coupon.expires_at && new Date(coupon.expires_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
  const formatDiscount = coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `৳${coupon.discount_value}`;

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expired";
    if (days === 1) return "Ends tomorrow";
    if (days <= 7) return `${days} days left`;
    return `${days}d remaining`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      layout
      className="relative"
    >
      {/* Main card */}
      <div className="relative bg-card rounded-[20px] border border-border/30 overflow-hidden shadow-[0_1px_3px_0_hsl(var(--foreground)/0.04)]">
        {/* Ticket cutouts */}
        <div className="absolute left-0 top-[72px] -translate-x-[9px] w-[18px] h-[18px] rounded-full bg-background z-10" />
        <div className="absolute right-0 top-[72px] translate-x-[9px] w-[18px] h-[18px] rounded-full bg-background z-10" />

        {/* Top section — colored accent */}
        <div className="relative px-5 pt-4 pb-5">
          {/* Flow pill */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 bg-primary/[0.06] text-primary/80 px-2.5 py-1 rounded-full">
              <FlowIcon className="w-3 h-3" />
              <span className="text-[10px] font-semibold tracking-wide">{flowInfo.label}</span>
            </div>
            {coupon.expires_at && (
              <span className={`text-[10px] font-medium flex items-center gap-1 ${
                isExpiring ? "text-destructive" : "text-muted-foreground/60"
              }`}>
                <Clock className="w-2.5 h-2.5" />
                {getDaysLeft(coupon.expires_at)}
              </span>
            )}
          </div>

          {/* Big discount */}
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-black text-primary leading-none tracking-tighter">
              {formatDiscount}
            </span>
            <span className="text-[13px] font-bold text-foreground/40 uppercase tracking-wider">off</span>
          </div>
        </div>

        {/* Dashed separator */}
        <div className="px-7">
          <div className="border-t border-dashed border-border/50" />
        </div>

        {/* Bottom section */}
        <div className="px-5 pt-3.5 pb-4">
          {/* Description */}
          {coupon.description && (
            <p className="text-[12px] text-muted-foreground/80 leading-[1.5] line-clamp-2 mb-2.5">
              {coupon.description}
            </p>
          )}

          {/* Conditions */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {coupon.min_order_amount && (
              <span className="text-[10px] font-medium text-foreground/50 bg-foreground/[0.03] border border-border/30 px-2 py-[3px] rounded-lg">
                Min ৳{coupon.min_order_amount}
              </span>
            )}
            {coupon.max_discount && coupon.discount_type === "percentage" && (
              <span className="text-[10px] font-medium text-foreground/50 bg-foreground/[0.03] border border-border/30 px-2 py-[3px] rounded-lg">
                Max ৳{coupon.max_discount}
              </span>
            )}
            {coupon.usage_limit && (coupon.usage_limit - coupon.used_count) <= 10 && (
              <span className="text-[10px] font-medium text-foreground/50 bg-foreground/[0.03] border border-border/30 px-2 py-[3px] rounded-lg">
                {coupon.usage_limit - coupon.used_count} uses left
              </span>
            )}
          </div>

          {/* Actions row */}
          <div className="flex gap-2.5 items-center">
            {/* Code + copy */}
            <button
              onClick={() => onCopy(coupon)}
              className={`h-10 px-4 rounded-[14px] border-[1.5px] border-dashed flex items-center gap-2 transition-all duration-300 ${
                isCopied
                  ? "border-primary/30 bg-primary/[0.04]"
                  : "border-border/60 hover:border-primary/30 hover:bg-primary/[0.02]"
              }`}
            >
              <span className={`text-[12px] font-bold tracking-widest ${
                isCopied ? "text-primary" : "text-foreground/70"
              }`}>
                {coupon.code}
              </span>
              <div className={`transition-all duration-200 ${isCopied ? "text-primary" : "text-muted-foreground/40"}`}>
                {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </div>
            </button>

            {/* Use now */}
            <Button
              size="sm"
              className="flex-1 rounded-[14px] font-semibold text-[12px] h-10 shadow-none"
              onClick={() => onUse(coupon)}
            >
              <Scissors className="w-3.5 h-3.5 mr-1.5" />
              Redeem
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/70 backdrop-blur-2xl border-b border-border/20">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors active:scale-95"
            >
              <ArrowLeft className="w-[18px] h-[18px] text-foreground" />
            </button>
            <h1 className="text-[16px] font-bold text-foreground tracking-tight">Coupons</h1>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/60">
            <Ticket className="w-3.5 h-3.5" />
            {!loading && (
              <span className="text-[11px] font-medium">{coupons.length}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* AI Recommended */}
        {(aiCouponRewards.length > 0 || aiOfferRewards.length > 0) && (
          <AiRewardBanner rewards={[...aiCouponRewards, ...aiOfferRewards]} onClaim={(id) => {
            const isCoupon = aiCouponRewards.some(r => r.id === id);
            return isCoupon ? claimReward(id) : claimOffer(id);
          }} />
        )}

        {/* Loading */}
        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[160px] w-full rounded-[20px]" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          /* Empty */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-28 gap-4"
          >
            <div className="w-16 h-16 rounded-[18px] bg-muted/30 flex items-center justify-center">
              <Ticket className="w-7 h-7 text-muted-foreground/20" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[14px] text-foreground/70 font-medium">No coupons yet</p>
              <p className="text-[12px] text-muted-foreground/50">We'll notify you when new offers arrive</p>
            </div>
          </motion.div>
        ) : (
          /* Cards */
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {coupons.map((coupon, i) => (
                <CouponCard
                  key={coupon.id}
                  coupon={coupon}
                  index={i}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onUse={handleUseNow}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
