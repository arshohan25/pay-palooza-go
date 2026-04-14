import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Ticket, Copy, Clock, CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  usage_limit: number | null;
  used_count: number;
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
      if (data) setCoupons(data);
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

  const formatDiscount = (c: Coupon) => {
    if (c.discount_type === "percentage") {
      return `${c.discount_value}% OFF` + (c.max_discount ? ` (max ৳${c.max_discount})` : "");
    }
    return `৳${c.discount_value} OFF`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Coupons & Offers</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 text-center border border-primary/10">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
          <h2 className="text-lg font-bold text-foreground">Exclusive Deals</h2>
          <p className="text-xs text-muted-foreground mt-1">Copy a code and use it at checkout</p>
        </div>

        {/* AI Recommended Coupons & Offers */}
        {(aiCouponRewards.length > 0 || aiOfferRewards.length > 0) && (
          <AiRewardBanner rewards={[...aiCouponRewards, ...aiOfferRewards]} onClaim={(id) => {
            const isCoupon = aiCouponRewards.some(r => r.id === id);
            return isCoupon ? claimReward(id) : claimOffer(id);
          }} />
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Ticket className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No active coupons right now</p>
            <p className="text-xs text-muted-foreground/70">Check back later for new offers!</p>
          </div>
        ) : (
          coupons.map((coupon, i) => {
            const isCopied = copiedId === coupon.id;
            const isExpiring = coupon.expires_at && new Date(coupon.expires_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
            const usageLeft = coupon.usage_limit ? coupon.usage_limit - coupon.used_count : null;

            return (
              <motion.div
                key={coupon.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                {/* Dashed coupon border effect */}
                <div className="flex">
                  <div className="w-2 bg-primary/80 shrink-0" />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-extrabold text-primary">{formatDiscount(coupon)}</p>
                        {coupon.description && (
                          <p className="text-xs text-muted-foreground mt-1">{coupon.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {coupon.min_order_amount && (
                            <Badge variant="secondary" className="text-[10px]">
                              Min order ৳{coupon.min_order_amount}
                            </Badge>
                          )}
                          {isExpiring && (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <Clock className="w-2.5 h-2.5" /> Expiring soon
                            </Badge>
                          )}
                          {usageLeft !== null && usageLeft <= 10 && (
                            <Badge variant="outline" className="text-[10px]">
                              {usageLeft} left
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={isCopied ? "default" : "outline"}
                        size="sm"
                        className="shrink-0 gap-1.5 rounded-xl"
                        onClick={() => handleCopy(coupon)}
                      >
                        {isCopied ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> {coupon.code}</>
                        )}
                      </Button>
                    </div>
                    {coupon.expires_at && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Valid until {new Date(coupon.expires_at).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
