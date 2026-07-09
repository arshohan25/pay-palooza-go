import Seo from "@/components/Seo";
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
import { useI18n, type TranslationKey } from "@/lib/i18n";

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
  const { t } = useI18n();
  const isCopied = copiedId === coupon.id;
  const flow = coupon.applicable_flow || "shop";
  const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
  const FlowIcon = flowInfo.icon;
  const isExpiring = coupon.expires_at && new Date(coupon.expires_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
  const formatDiscount = coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `৳${coupon.discount_value}`;

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return t("expiredLabel");
    if (days === 1) return t("endsTomorrow");
    if (days <= 7) return `${days} ${t("daysLeftSuffix")}`;
    return `${days}${t("daysRemainingSuffix")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      layout
      className="relative"
    >
      <div className="relative bg-card rounded-2xl border border-border/30 overflow-hidden shadow-[0_1px_2px_0_hsl(var(--foreground)/0.03)]">
        {/* Ticket cutouts */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[7px] w-[14px] h-[14px] rounded-full bg-background z-10" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[7px] w-[14px] h-[14px] rounded-full bg-background z-10" />

        <div className="flex items-center gap-0">
          {/* Left: discount */}
          <div className="shrink-0 w-[90px] flex flex-col items-center justify-center py-3 border-r border-dashed border-border/40">
            <span className="text-[20px] font-black text-primary leading-none tracking-tight">
              {formatDiscount}
            </span>
            <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-widest mt-0.5">off</span>
          </div>

          {/* Right: details + actions */}
          <div className="flex-1 min-w-0 px-3 py-2.5">
            {/* Top: description + flow */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-[11px] text-foreground/70 font-medium leading-snug line-clamp-1 flex-1">
                {coupon.description || `${flowInfo.label} discount`}
              </p>
              <div className="flex items-center gap-1 text-muted-foreground/50 shrink-0">
                <FlowIcon className="w-2.5 h-2.5" />
                <span className="text-[9px] font-medium">{flowInfo.label}</span>
              </div>
            </div>

            {/* Code + copy + expiry row */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => onCopy(coupon)}
                className={`h-6 px-2 rounded-md border border-dashed flex items-center gap-1 transition-all text-[10px] font-bold tracking-wider ${
                  isCopied
                    ? "border-primary/30 bg-primary/[0.04] text-primary"
                    : "border-border/50 text-foreground/60 hover:border-primary/20"
                }`}
              >
                {coupon.code}
                {isCopied ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 text-muted-foreground/40" />}
              </button>
              {coupon.expires_at && (
                <span className={`text-[9px] font-medium flex items-center gap-0.5 ${
                  isExpiring ? "text-destructive" : "text-muted-foreground/40"
                }`}>
                  <Clock className="w-2 h-2" />
                  {getDaysLeft(coupon.expires_at)}
                </span>
              )}
            </div>

            {/* Redeem button */}
            <Button
              size="sm"
              className="w-full rounded-xl font-semibold text-[11px] h-7 shadow-none"
              onClick={() => onUse(coupon)}
            >
              {t("redeem")}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function CouponsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
      const filtered = (data || []).filter((c: any) =>
        c.usage_limit == null || (c.used_count ?? 0) < c.usage_limit
      );
      setCoupons(filtered as Coupon[]);
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
    navigator.clipboard.writeText(coupon.code);
    setCopiedId(coupon.id);
    toast.success(`Code "${coupon.code}" copied — paste it during payment`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Seo
        title="Coupons & Promotions – EasyPay"
        description="Browse the latest EasyPay coupons, cashback offers and discount codes across shopping, recharge, bills and more."
        path="/coupons"
      />
      {/* Header */}
      <div className="sticky top-0 z-40 gradient-hero text-primary-foreground backdrop-blur-2xl border-b border-primary/30 shadow-glow">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors active:scale-95"
            >
              <ArrowLeft className="w-[18px] h-[18px] text-foreground" />
            </button>
            <h1 className="text-[16px] font-bold text-foreground tracking-tight">{t("coupons")}</h1>
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
              <p className="text-[14px] text-foreground/70 font-medium">{t("noCouponsYet")}</p>
              <p className="text-[12px] text-muted-foreground/50">{t("noCouponsDesc")}</p>
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
