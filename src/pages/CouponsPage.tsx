import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Ticket, Copy, Clock, CheckCircle2, Sparkles,
  ShoppingBag, CreditCard, Smartphone, FileText, Zap, Tag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  all:        { label: "All Services", icon: Tag,         route: "/shop" },
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
    // Store coupon for the target flow to read
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

  const formatDiscount = (c: Coupon) => {
    if (c.discount_type === "percentage") return `${c.discount_value}%`;
    return `৳${c.discount_value}`;
  };

  const getExpiryProgress = (c: Coupon) => {
    if (!c.expires_at || !c.starts_at) return null;
    const start = new Date(c.starts_at).getTime();
    const end = new Date(c.expires_at).getTime();
    const now = Date.now();
    if (now >= end) return 0;
    const total = end - start;
    const remaining = end - now;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  };

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expired";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Coupons & Offers</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="relative overflow-hidden rounded-[19px] bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-5 text-center"
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-6 left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <Sparkles className="w-8 h-8 text-primary-foreground mx-auto mb-2" />
            <h2 className="text-lg font-extrabold text-primary-foreground">Exclusive Deals</h2>
            <p className="text-xs text-primary-foreground/70 mt-1">
              {coupons.length} active coupon{coupons.length !== 1 ? "s" : ""} — tap "Use Now" to apply instantly
            </p>
          </motion.div>
        </motion.div>

        {/* AI Recommended */}
        {(aiCouponRewards.length > 0 || aiOfferRewards.length > 0) && (
          <AiRewardBanner rewards={[...aiCouponRewards, ...aiOfferRewards]} onClaim={(id) => {
            const isCoupon = aiCouponRewards.some(r => r.id === id);
            return isCoupon ? claimReward(id) : claimOffer(id);
          }} />
        )}

        {/* Coupons List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-[19px]" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Ticket className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">No active coupons right now</p>
            <p className="text-xs text-muted-foreground/60">Check back later for new offers!</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {coupons.map((coupon, i) => {
                const isCopied = copiedId === coupon.id;
                const flow = coupon.applicable_flow || "shop";
                const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
                const FlowIcon = flowInfo.icon;
                const expiryProgress = getExpiryProgress(coupon);
                const isExpiring = coupon.expires_at && new Date(coupon.expires_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
                const usageLeft = coupon.usage_limit ? coupon.usage_limit - coupon.used_count : null;

                return (
                  <motion.div
                    key={coupon.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04, duration: 0.35 }}
                    layout
                    className="relative bg-card/80 backdrop-blur-sm rounded-[19px] border border-border/50 overflow-hidden shadow-sm"
                  >
                    {/* Ticket notch effect */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-background border border-border/50" />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 rounded-full bg-background border border-border/50" />

                    <div className="flex">
                      <div className="w-1.5 bg-gradient-to-b from-primary to-primary/60 shrink-0 rounded-l-[19px]" />
                      <div className="flex-1 p-4 pl-5">
                        {/* Discount + flow badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-black bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                                {formatDiscount(coupon)}
                              </span>
                              <span className="text-sm font-bold text-foreground/80">OFF</span>
                            </div>
                            {coupon.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{coupon.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full shrink-0">
                            <FlowIcon className="w-3 h-3" />
                            <span className="text-[10px] font-bold">{flowInfo.label}</span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {coupon.min_order_amount && (
                            <Badge variant="secondary" className="text-[10px] rounded-lg px-2 py-0.5">Min ৳{coupon.min_order_amount}</Badge>
                          )}
                          {coupon.max_discount && coupon.discount_type === "percentage" && (
                            <Badge variant="secondary" className="text-[10px] rounded-lg px-2 py-0.5">Max ৳{coupon.max_discount}</Badge>
                          )}
                          {isExpiring && (
                            <Badge variant="destructive" className="text-[10px] gap-1 rounded-lg px-2 py-0.5">
                              <Clock className="w-2.5 h-2.5" /> Expiring soon
                            </Badge>
                          )}
                          {usageLeft !== null && usageLeft <= 10 && (
                            <Badge variant="outline" className="text-[10px] rounded-lg px-2 py-0.5">{usageLeft} left</Badge>
                          )}
                        </div>

                        {/* Expiry progress */}
                        {expiryProgress !== null && coupon.expires_at && (
                          <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] text-muted-foreground">Time remaining</span>
                              <span className="text-[10px] font-medium text-muted-foreground">{getDaysLeft(coupon.expires_at)}</span>
                            </div>
                            <Progress value={expiryProgress} className="h-1.5" />
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 gap-1.5 rounded-xl font-bold text-xs h-9"
                            onClick={() => handleUseNow(coupon)}
                          >
                            <FlowIcon className="w-3.5 h-3.5" /> Use Now
                          </Button>
                          <Button
                            variant={isCopied ? "secondary" : "outline"}
                            size="sm"
                            className="shrink-0 gap-1.5 rounded-xl text-xs h-9"
                            onClick={() => handleCopy(coupon)}
                          >
                            {isCopied ? (
                              <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" /> {coupon.code}</>
                            )}
                          </Button>
                        </div>

                        {coupon.expires_at && !expiryProgress && (
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Valid until {new Date(coupon.expires_at).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
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
