import Seo from "@/components/Seo";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Ticket, Copy, CheckCircle2, Sparkles,
  ShoppingBag, CreditCard, Smartphone, FileText, Zap, Tag, Clock, Flame, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

const FLOW_MAP: Record<string, { labelKey: TranslationKey; icon: typeof ShoppingBag }> = {
  shop:     { labelKey: "cpFlowShop",     icon: ShoppingBag },
  payment:  { labelKey: "cpFlowPayment",  icon: CreditCard  },
  cash_out: { labelKey: "cpFlowCashOut",  icon: Zap         },
  recharge: { labelKey: "cpFlowRecharge", icon: Smartphone  },
  bill_pay: { labelKey: "cpFlowBillPay",  icon: FileText    },
  all:      { labelKey: "cpFlowAll",      icon: Tag         },
};

const FILTERS: { id: string; labelKey: TranslationKey }[] = [
  { id: "all",      labelKey: "cpFlowAll"      },
  { id: "shop",     labelKey: "cpFlowShop"     },
  { id: "payment",  labelKey: "cpFlowPayment"  },
  { id: "recharge", labelKey: "cpFlowRecharge" },
  { id: "bill_pay", labelKey: "cpFlowBillPay"  },
  { id: "cash_out", labelKey: "cpFlowCashOut"  },
];

/* ────────────────────────────────────────────────────────────
   Premium ticket card — emerald + gold, ticket cutouts,
   perforated divider, foil-style discount block.
   ──────────────────────────────────────────────────────────── */
function CouponCard({
  coupon, index, copiedId, onCopy, onUse, featured,
}: {
  coupon: Coupon; index: number; copiedId: string | null;
  onCopy: (c: Coupon) => void; onUse: (c: Coupon) => void; featured?: boolean;
}) {
  const { t } = useI18n();
  const isCopied = copiedId === coupon.id;
  const flow = coupon.applicable_flow || "shop";
  const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
  const FlowIcon = flowInfo.icon;

  const msLeft = coupon.expires_at ? new Date(coupon.expires_at).getTime() - Date.now() : Infinity;
  const isExpiring = msLeft < 3 * 24 * 60 * 60 * 1000;

  const getDaysLeft = (expiresAt: string) => {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return t("expiredLabel");
    if (days === 1) return t("endsTomorrow");
    if (days <= 7) return `${days} ${t("daysLeftSuffix")}`;
    return `${days}${t("daysRemainingSuffix")}`;
  };

  const value = coupon.discount_value;
  const isPct = coupon.discount_type === "percentage";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      layout
      className="relative group"
    >
      {/* Soft ambient glow */}
      <div
        className={`absolute -inset-px rounded-[22px] opacity-60 blur-md pointer-events-none transition-opacity duration-500 group-hover:opacity-100 ${
          featured
            ? "bg-[radial-gradient(60%_120%_at_10%_50%,hsl(var(--shariah-green-600)/0.35),transparent_60%),radial-gradient(50%_120%_at_100%_50%,hsl(var(--shariah-gold-500)/0.25),transparent_60%)]"
            : "bg-[radial-gradient(60%_120%_at_10%_50%,hsl(var(--shariah-green-600)/0.18),transparent_70%)]"
        }`}
      />

      <div className="relative overflow-hidden rounded-[22px] border border-border/40 bg-card shadow-[0_2px_10px_-4px_hsl(var(--shariah-green-900)/0.15)]">
        {/* Ticket cutouts */}
        <div className="absolute left-[96px] top-0 -translate-x-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-background z-10" />
        <div className="absolute left-[96px] bottom-0 -translate-x-1/2 translate-y-1/2 w-[14px] h-[14px] rounded-full bg-background z-10" />

        <div className="flex items-stretch">
          {/* Left: foil discount block */}
          <div
            className="relative shrink-0 w-[96px] flex flex-col items-center justify-center py-4 text-primary-foreground overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--shariah-green-800)) 0%, hsl(var(--shariah-green-600)) 55%, hsl(var(--shariah-green-800)) 100%)",
            }}
          >
            {/* gold shimmer streak */}
            <div className="absolute inset-0 opacity-40 pointer-events-none"
                 style={{ background: "linear-gradient(115deg, transparent 40%, hsl(var(--shariah-gold-500)/0.35) 50%, transparent 60%)" }} />
            {/* micro dot pattern */}
            <div className="absolute inset-0 opacity-[0.12] pointer-events-none"
                 style={{ backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "8px 8px" }} />

            <div className="relative flex items-baseline gap-0.5">
              {!isPct && <span className="text-[13px] font-semibold opacity-90 leading-none">৳</span>}
              <span className="text-[28px] font-black leading-none tracking-tight tabular-nums">{value}</span>
              {isPct && <span className="text-[14px] font-bold leading-none">%</span>}
            </div>
            <span className="relative mt-1 text-[9px] font-bold uppercase tracking-[0.18em] opacity-90">
              {t("cpOff")}
            </span>

            {/* perforated right edge */}
            <div className="absolute right-0 top-0 bottom-0 w-px opacity-40"
                 style={{ backgroundImage: "repeating-linear-gradient(to bottom, hsl(var(--shariah-gold-500)) 0 4px, transparent 4px 8px)" }} />
          </div>

          {/* Right: details */}
          <div className="flex-1 min-w-0 p-3 pl-4">
            {/* header row */}
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50">
                <FlowIcon className="w-2.5 h-2.5 text-muted-foreground" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(flowInfo.labelKey)}
                </span>
              </div>
              {featured && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[hsl(var(--shariah-gold-500)/0.15)]">
                  <Sparkles className="w-2.5 h-2.5 text-[hsl(var(--shariah-gold-700))]" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--shariah-gold-700))]">
                    Featured
                  </span>
                </div>
              )}
              {isExpiring && coupon.expires_at && (
                <div className="ml-auto flex items-center gap-0.5 text-destructive">
                  <Flame className="w-2.5 h-2.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{getDaysLeft(coupon.expires_at)}</span>
                </div>
              )}
            </div>

            {/* title */}
            <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
              {coupon.description || `${t(flowInfo.labelKey)} ${t("cpDiscountSuffix")}`}
            </p>

            {/* meta */}
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              {coupon.min_order_amount ? (
                <span>{t("cbUpTo") ? `Min ৳${coupon.min_order_amount}` : `Min ৳${coupon.min_order_amount}`}</span>
              ) : null}
              {coupon.expires_at && !isExpiring && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {getDaysLeft(coupon.expires_at)}
                </span>
              )}
            </div>

            {/* code + CTA */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => onCopy(coupon)}
                className={`flex-1 h-8 px-2.5 rounded-lg border-2 border-dashed flex items-center justify-between gap-1 transition-all ${
                  isCopied
                    ? "border-primary/50 bg-primary/[0.06] text-primary"
                    : "border-border/70 text-foreground/80 hover:border-primary/40 hover:bg-primary/[0.03]"
                }`}
              >
                <span className="text-[11px] font-black tracking-[0.15em] truncate">{coupon.code}</span>
                {isCopied ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <Copy className="w-3 h-3 shrink-0 opacity-60" />}
              </button>
              <button
                onClick={() => onUse(coupon)}
                className="h-8 px-3 rounded-lg text-primary-foreground text-[11px] font-bold flex items-center gap-0.5 active:scale-[0.97] transition-transform shadow-[0_2px_8px_-2px_hsl(var(--shariah-green-600)/0.5)]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--shariah-green-600)), hsl(var(--shariah-green-800)))",
                }}
              >
                {t("redeem")}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
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
  const [filter, setFilter] = useState<string>("all");
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
    toast.success(t("cpCopiedToast").replace("{code}", coupon.code));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUseNow = (coupon: Coupon) => {
    navigator.clipboard.writeText(coupon.code);
    setCopiedId(coupon.id);
    toast.success(t("cpUseNowToast").replace("{code}", coupon.code));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const visible = useMemo(
    () => (filter === "all" ? coupons : coupons.filter(c => (c.applicable_flow || "shop") === filter)),
    [coupons, filter]
  );

  const bestValue = useMemo(() => {
    if (!coupons.length) return 0;
    return Math.max(...coupons.map(c => (c.discount_type === "percentage" ? c.discount_value : c.discount_value)));
  }, [coupons]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Seo
        title="Coupons & Promotions – EasyPay"
        description="Browse the latest EasyPay coupons, cashback offers and discount codes across shopping, recharge, bills and more."
        path="/coupons"
      />

      {/* ── Premium hero header ─────────────────────────────── */}
      <div className="relative overflow-hidden text-primary-foreground"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--shariah-green-900)) 0%, hsl(var(--shariah-green-800)) 45%, hsl(var(--shariah-green-600)) 100%)",
        }}
      >
        {/* Ambient blobs */}
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[hsl(var(--shariah-gold-500)/0.18)] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-56 h-56 rounded-full bg-[hsl(var(--shariah-green-300)/0.25)] blur-3xl pointer-events-none" />
        {/* Grain */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
             style={{ backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 active:scale-95 transition"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
            <h2 className="text-[16px] font-bold tracking-tight">{t("coupons")}</h2>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">
            <Ticket className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold tabular-nums">{loading ? "…" : coupons.length}</span>
          </div>
        </div>


        {/* Title block */}
        <div className="relative px-4 pt-2 pb-6">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--shariah-gold-300))]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--shariah-gold-300))]">
              EasyPay Rewards
            </span>
          </div>
          <h1 className="text-[26px] leading-[1.1] font-black tracking-tight">
            Save more, every
            <br />
            <span className="italic font-serif font-normal text-[hsl(var(--shariah-gold-300))]">
              single tap.
            </span>
          </h1>
          <p className="mt-2 text-[12px] text-white/70 max-w-[280px]">
            Handpicked coupons across shopping, bills, recharge & more.
          </p>

          {/* Stat strip */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 border border-white/10">
              <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Active</p>
              <p className="text-[16px] font-black tabular-nums">{loading ? "…" : coupons.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 border border-white/10">
              <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Best</p>
              <p className="text-[16px] font-black text-[hsl(var(--shariah-gold-300))] tabular-nums">
                {loading ? "…" : `${bestValue}%`}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 border border-white/10">
              <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Ending</p>
              <p className="text-[16px] font-black tabular-nums">
                {loading ? "…" : coupons.filter(c => c.expires_at && new Date(c.expires_at).getTime() - Date.now() < 3 * 86400000).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter pills (sticky) ───────────────────────────── */}
      <div className="sticky top-0 z-30 -mt-3 px-3 pb-2 pt-3 bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold transition-all ${
                  active
                    ? "text-primary-foreground shadow-[0_2px_8px_-2px_hsl(var(--shariah-green-600)/0.5)]"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                style={active ? { background: "linear-gradient(135deg, hsl(var(--shariah-green-600)), hsl(var(--shariah-green-800)))" } : undefined}
              >
                {t(f.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* AI Recommended */}
        {(aiCouponRewards.length > 0 || aiOfferRewards.length > 0) && (
          <AiRewardBanner
            rewards={[...aiCouponRewards, ...aiOfferRewards]}
            onClaim={(id) => {
              const isCoupon = aiCouponRewards.some(r => r.id === id);
              return isCoupon ? claimReward(id) : claimOffer(id);
            }}
          />
        )}

        {loading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[130px] w-full rounded-[22px]" />)}
          </div>
        ) : visible.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div className="relative w-20 h-20 rounded-[20px] flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, hsl(var(--shariah-green-600)/0.1), hsl(var(--shariah-gold-500)/0.1))" }}>
              <Ticket className="w-8 h-8 text-primary/60" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[15px] text-foreground font-semibold">{t("noCouponsYet")}</p>
              <p className="text-[12px] text-muted-foreground">{t("noCouponsDesc")}</p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {visible.map((coupon, i) => (
                <CouponCard
                  key={coupon.id}
                  coupon={coupon}
                  index={i}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onUse={handleUseNow}
                  featured={i === 0 && filter === "all"}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
