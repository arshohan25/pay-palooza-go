import Seo from "@/components/Seo";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Ticket, Copy, CheckCircle2, Sparkles, Clock, Flame,
  ShoppingBag, CreditCard, Smartphone, FileText, Zap, Tag, ChevronRight, Plus, Loader2,
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
  per_user_limit: number | null;
}

type FlowKey = "all" | "shop" | "payment" | "recharge" | "bill_pay" | "cash_out";

const FLOW_MAP: Record<string, { labelKey: TranslationKey; icon: typeof ShoppingBag; tint: string }> = {
  shop:     { labelKey: "cpFlowShop",     icon: ShoppingBag, tint: "hsl(var(--shariah-green-600))" },
  payment:  { labelKey: "cpFlowPayment",  icon: CreditCard,  tint: "hsl(220 70% 55%)" },
  cash_out: { labelKey: "cpFlowCashOut",  icon: Zap,         tint: "hsl(35 90% 55%)" },
  recharge: { labelKey: "cpFlowRecharge", icon: Smartphone,  tint: "hsl(280 65% 60%)" },
  bill_pay: { labelKey: "cpFlowBillPay",  icon: FileText,    tint: "hsl(190 75% 50%)" },
  all:      { labelKey: "cpFlowAll",      icon: Tag,         tint: "hsl(var(--shariah-green-600))" },
};




function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

/* ── FEATURED HERO COUPON ─────────────────────────────── */
function FeaturedCoupon({ coupon, onOpen, onCopy, copied }: {
  coupon: Coupon; onOpen: () => void; onCopy: () => void; copied: boolean;
}) {
  const { t } = useI18n();
  const isPct = coupon.discount_type === "percentage";
  const flow = coupon.applicable_flow || "shop";
  const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
  const FlowIcon = flowInfo.icon;
  const dLeft = coupon.expires_at ? daysLeft(coupon.expires_at) : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onClick={onOpen}
      className="w-full text-left relative rounded-[26px] overflow-hidden active:scale-[0.99] transition-transform"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--shariah-green-900)) 0%, hsl(var(--shariah-green-700)) 55%, hsl(var(--shariah-green-800)) 100%)",
      }}
    >
      {/* Foil sheen */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            "linear-gradient(115deg, transparent 30%, hsl(var(--shariah-gold-500)/0.35) 50%, transparent 70%)",
        }}
      />
      {/* Gold blob */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[hsl(var(--shariah-gold-500)/0.25)] blur-2xl pointer-events-none" />
      {/* Micro dots */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "10px 10px" }}
      />

      <div className="relative p-5 text-primary-foreground">
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(var(--shariah-gold-500)/0.18)] border border-[hsl(var(--shariah-gold-300)/0.4)]">
            <Sparkles className="w-3 h-3 text-[hsl(var(--shariah-gold-300))]" />
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[hsl(var(--shariah-gold-300))]">
              Featured
            </span>
          </div>
          {dLeft != null && dLeft <= 7 && dLeft > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 backdrop-blur">
              <Flame className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {dLeft === 1 ? t("endsTomorrow") : `${dLeft}${t("daysRemainingSuffix")}`}
              </span>
            </div>
          )}
        </div>

        {/* Big value */}
        <div className="flex items-baseline gap-1">
          {!isPct && <span className="text-[26px] font-bold opacity-90">৳</span>}
          <span className="text-[64px] font-black leading-none tracking-tight tabular-nums">
            {coupon.discount_value}
          </span>
          {isPct && <span className="text-[32px] font-black leading-none">%</span>}
          <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[hsl(var(--shariah-gold-300))] ml-2 pb-1">
            {t("cpOff")}
          </span>
        </div>

        <p className="mt-2 text-[13px] font-medium text-white/85 leading-snug line-clamp-2">
          {coupon.description || `${t(flowInfo.labelKey)} ${t("cpDiscountSuffix")}`}
        </p>

        {/* Category tag */}
        <div className="mt-3 flex items-center gap-1.5 text-white/70">
          <FlowIcon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{t(flowInfo.labelKey)}</span>
          {coupon.min_order_amount ? (
            <>
              <span className="opacity-40">•</span>
              <span className="text-[11px] font-semibold">Min ৳{coupon.min_order_amount}</span>
            </>
          ) : null}
        </div>

        {/* Code chip + CTA */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className={`flex-1 h-11 px-3 rounded-xl border-2 border-dashed flex items-center justify-between gap-2 transition-all ${
              copied
                ? "border-[hsl(var(--shariah-gold-300))] bg-[hsl(var(--shariah-gold-500)/0.12)]"
                : "border-white/25 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/60">Code</p>
              <p className="text-[13px] font-black tracking-[0.18em] text-white -mt-0.5">{coupon.code}</p>
            </div>
            {copied
              ? <CheckCircle2 className="w-4 h-4 text-[hsl(var(--shariah-gold-300))]" />
              : <Copy className="w-4 h-4 text-white/70" />}
          </button>
          <div className="h-11 px-4 rounded-xl bg-[hsl(var(--shariah-gold-500))] text-[hsl(var(--shariah-green-900))] text-[13px] font-black flex items-center gap-1 shadow-[0_4px_14px_-4px_hsl(var(--shariah-gold-500)/0.6)]">
            {t("redeem")}
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

/* ── COMPACT COUPON ROW ───────────────────────────────── */
function CouponRow({ coupon, index, copied, onCopy, onOpen }: {
  coupon: Coupon; index: number; copied: boolean;
  onCopy: () => void; onOpen: () => void;
}) {
  const { t } = useI18n();
  const isPct = coupon.discount_type === "percentage";
  const flow = coupon.applicable_flow || "shop";
  const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
  const FlowIcon = flowInfo.icon;
  const dLeft = coupon.expires_at ? daysLeft(coupon.expires_at) : null;
  const isExpiring = dLeft != null && dLeft > 0 && dLeft <= 3;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.03, 0.15), duration: 0.3 }}
      onClick={onOpen}
      className="w-full text-left group relative"
    >
      <div className="relative bg-card rounded-2xl border border-border/50 overflow-hidden shadow-[0_1px_3px_0_hsl(var(--foreground)/0.03)] group-hover:border-primary/30 group-hover:shadow-[0_4px_16px_-6px_hsl(var(--shariah-green-600)/0.2)] transition-all">
        {/* Ticket cutouts */}
        <div className="absolute left-[68px] top-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-background z-10" />
        <div className="absolute left-[68px] bottom-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full bg-background z-10" />

        <div className="flex items-stretch">
          {/* Left: value pill */}
          <div
            className="relative shrink-0 w-[68px] flex flex-col items-center justify-center py-3"
            style={{
              background: `linear-gradient(160deg, ${flowInfo.tint}, ${flowInfo.tint} 60%, transparent)`,
              backgroundColor: `${flowInfo.tint}0F`,
            }}
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: flowInfo.tint }}
            >
              <FlowIcon className="w-5 h-5 text-white" />
            </div>
            {/* Perforated edge */}
            <div
              className="absolute right-0 top-2 bottom-2 w-px opacity-40"
              style={{ backgroundImage: "repeating-linear-gradient(to bottom, hsl(var(--border)) 0 3px, transparent 3px 7px)" }}
            />
          </div>

          {/* Right: content */}
          <div className="flex-1 min-w-0 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(flowInfo.labelKey)}
              </span>
              {isExpiring && dLeft != null && (
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-destructive flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5" />
                  {dLeft === 1 ? t("endsTomorrow") : `${dLeft}${t("daysRemainingSuffix")}`}
                </span>
              )}
            </div>

            {/* Big value + title */}
            <div className="flex items-baseline gap-1 mt-0.5">
              {!isPct && <span className="text-[13px] font-bold text-primary">৳</span>}
              <span className="text-[22px] font-black text-primary leading-none tabular-nums">
                {coupon.discount_value}
              </span>
              {isPct && <span className="text-[14px] font-black text-primary leading-none">%</span>}
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-0.5">
                {t("cpOff")}
              </span>
            </div>

            <p className="mt-1 text-[11.5px] text-foreground/70 line-clamp-1 leading-snug">
              {coupon.description || `${t(flowInfo.labelKey)} ${t("cpDiscountSuffix")}`}
            </p>

            {/* Code chip */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div
                onClick={(e) => { e.stopPropagation(); onCopy(); }}
                className={`inline-flex items-center gap-1 px-2 h-6 rounded-md border border-dashed transition-colors ${
                  copied
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border/70 text-foreground/70 hover:border-primary/30"
                }`}
              >
                <span className="text-[10px] font-black tracking-[0.14em]">{coupon.code}</span>
                {copied ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function CouponsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");

  const [redeeming, setRedeeming] = useState(false);
  const { rewards: aiCouponRewards, claimReward } = useAiRewards("coupon");
  const { rewards: aiOfferRewards, claimReward: claimOffer } = useAiRewards("offer");

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      const [{ data }, { data: sess }] = await Promise.all([
        supabase
          .from("coupons")
          .select("*")
          .eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);

      const uid = sess?.user?.id;
      const usedMap = new Map<string, number>();
      if (uid) {
        const { data: reds } = await supabase
          .from("coupon_redemptions")
          .select("coupon_id")
          .eq("user_id", uid);
        (reds || []).forEach((r: any) => {
          usedMap.set(r.coupon_id, (usedMap.get(r.coupon_id) ?? 0) + 1);
        });
      }

      const filtered = (data || []).filter((c: any) => {
        if (c.usage_limit != null && (c.used_count ?? 0) >= c.usage_limit) return false;
        const myUses = usedMap.get(c.id) ?? 0;
        const perUserCap = c.per_user_limit ?? 1;
        if (myUses >= perUserCap) return false;
        return true;
      });

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

  const handleRedeemByCode = async () => {
    const code = redeemCode.trim().toUpperCase();
    if (code.length < 3) {
      toast.error("Enter a valid coupon code");
      return;
    }
    setRedeeming(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        toast.error("Coupon not found");
        return;
      }
      if (data.expires_at && data.expires_at < now) {
        toast.error("This coupon has expired");
        return;
      }
      if (data.usage_limit != null && (data.used_count ?? 0) >= data.usage_limit) {
        toast.error("This coupon is fully redeemed");
        return;
      }

      const existing = coupons.find((c) => c.id === data.id);
      if (!existing) {
        setCoupons((prev) => [data as Coupon, ...prev]);
      }
      toast.success(`Coupon ${code} added`);
      setRedeemCode("");
      navigate(`/coupons/${data.id}`);
    } finally {
      setRedeeming(false);
    }
  };
  const filtered = coupons;


  const featured = filtered[0];
  const rest = filtered.slice(1);
  const endingSoon = rest.filter(c => c.expires_at && daysLeft(c.expires_at) <= 3 && daysLeft(c.expires_at) > 0);
  const everythingElse = rest.filter(c => !endingSoon.includes(c));

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo
        title="Coupons & Promotions – EasyPay"
        description="Browse the latest EasyPay coupons, cashback offers and discount codes across shopping, recharge, bills and more."
        path="/coupons"
      />

      {/* ── Premium branded hero header ────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(140deg, hsl(var(--shariah-green-900)) 0%, hsl(var(--shariah-green-700)) 55%, hsl(var(--shariah-green-800)) 100%)",
        }}
      >
        {/* Foil sheen */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "linear-gradient(115deg, transparent 30%, hsl(var(--shariah-gold-500)/0.35) 50%, transparent 70%)",
          }}
        />
        {/* Gold blob */}
        <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-[hsl(var(--shariah-gold-500)/0.25)] blur-3xl pointer-events-none" />
        {/* Micro dots */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "12px 12px" }}
        />

        <div className="relative px-4 pt-3 pb-6">
          {/* Nav row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 backdrop-blur hover:bg-white/15 active:scale-95 transition"
            >
              <ArrowLeft className="w-[18px] h-[18px] text-white" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--shariah-gold-500)/0.18)] border border-[hsl(var(--shariah-gold-300)/0.4)]">
              <Sparkles className="w-3 h-3 text-[hsl(var(--shariah-gold-300))]" />
              <span className="text-[9.5px] font-black uppercase tracking-[0.16em] text-[hsl(var(--shariah-gold-300))]">
                EasyPay Rewards
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <Ticket className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Brand title */}
          <div className="mt-5">
            <h1 className="text-[26px] font-black tracking-tight text-white leading-[1.05]">
              {t("coupons")}
            </h1>
            <p className="mt-1 text-[12px] text-white/70 leading-snug max-w-[260px]">
              Handpicked premium offers, refreshed for you in real-time.
            </p>
          </div>

          {/* Stats strip */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 rounded-xl bg-white/10 backdrop-blur border border-white/10 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Live</p>
              <p className="text-[16px] font-black text-white tabular-nums leading-none mt-0.5">
                {loading ? "…" : coupons.length}
              </p>
            </div>
            <div className="flex-1 rounded-xl bg-white/10 backdrop-blur border border-white/10 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Ending soon</p>
              <p className="text-[16px] font-black text-[hsl(var(--shariah-gold-300))] tabular-nums leading-none mt-0.5">
                {loading
                  ? "…"
                  : coupons.filter(c => c.expires_at && daysLeft(c.expires_at) > 0 && daysLeft(c.expires_at) <= 3).length}
              </p>
            </div>
            <div className="flex-1 rounded-xl bg-white/10 backdrop-blur border border-white/10 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">Curated</p>
              <p className="text-[16px] font-black text-white tabular-nums leading-none mt-0.5">24/7</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">


        {/* Redeem by code — premium ticket input */}
        <div
          className="relative rounded-2xl p-[1px] overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--shariah-green-700)) 0%, hsl(var(--shariah-gold-500)) 50%, hsl(var(--shariah-green-700)) 100%)",
          }}
        >
          <div className="relative rounded-2xl bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-[hsl(var(--shariah-gold-500)/0.15)] flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-[hsl(var(--shariah-gold-600))]" />
              </div>
              <div className="flex-1">
                <p className="text-[11.5px] font-black uppercase tracking-wider text-foreground">
                  Have a code?
                </p>
                <p className="text-[10px] text-muted-foreground -mt-0.5">
                  Enter a valid promo code to unlock
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && !redeeming && handleRedeemByCode()}
                  placeholder="ENTER CODE"
                  maxLength={20}
                  className="w-full h-11 px-3 rounded-xl bg-muted/50 border-2 border-dashed border-border/60 focus:border-primary/40 focus:bg-card focus:outline-none text-[13px] font-black tracking-[0.18em] text-foreground placeholder:text-muted-foreground/50 placeholder:tracking-widest placeholder:font-bold uppercase transition-all"
                />
              </div>
              <button
                onClick={handleRedeemByCode}
                disabled={redeeming || redeemCode.trim().length < 3}
                className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-black flex items-center gap-1 shadow-[0_4px_14px_-4px_hsl(var(--shariah-green-600)/0.6)] disabled:opacity-40 disabled:shadow-none active:scale-95 transition-all"
              >
                {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Apply
              </button>
            </div>
          </div>
        </div>




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

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-[240px] w-full rounded-[26px]" />
            <Skeleton className="h-[92px] w-full rounded-2xl" />
            <Skeleton className="h-[92px] w-full rounded-2xl" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div
              className="w-20 h-20 rounded-[22px] flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(var(--shariah-green-600)/0.12), hsl(var(--shariah-gold-500)/0.12))" }}
            >
              <Ticket className="w-8 h-8 text-primary/60" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[15px] text-foreground font-semibold">
                {query ? "No matches found" : t("noCouponsYet")}
              </p>
              <p className="text-[12px] text-muted-foreground max-w-[240px]">
                {query ? "Try a different keyword or category." : t("noCouponsDesc")}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Featured */}
            {featured && (
              <FeaturedCoupon
                coupon={featured}
                copied={copiedId === featured.id}
                onCopy={() => handleCopy(featured)}
                onOpen={() => navigate(`/coupons/${featured.id}`)}
              />
            )}

            {/* Ending soon */}
            {endingSoon.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Flame className="w-3 h-3 text-destructive" />
                    </div>
                    <h3 className="text-[12px] font-black uppercase tracking-wider text-foreground/80">
                      Ending soon
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{endingSoon.length}</span>
                </div>
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2.5">
                    {endingSoon.map((coupon, i) => (
                      <CouponRow
                        key={coupon.id}
                        coupon={coupon}
                        index={i}
                        copied={copiedId === coupon.id}
                        onCopy={() => handleCopy(coupon)}
                        onOpen={() => navigate(`/coupons/${coupon.id}`)}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </section>
            )}

            {/* All offers */}
            {everythingElse.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Tag className="w-3 h-3 text-primary" />
                    </div>
                    <h3 className="text-[12px] font-black uppercase tracking-wider text-foreground/80">
                      {category === "all" ? "All offers" : t(FLOW_MAP[category].labelKey)}
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{everythingElse.length}</span>
                </div>
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2.5">
                    {everythingElse.map((coupon, i) => (
                      <CouponRow
                        key={coupon.id}
                        coupon={coupon}
                        index={i}
                        copied={copiedId === coupon.id}
                        onCopy={() => handleCopy(coupon)}
                        onOpen={() => navigate(`/coupons/${coupon.id}`)}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </section>
            )}
          </div>
        )}

        {/* Footer note */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-[10.5px] text-muted-foreground/60 pt-2 flex items-center justify-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Coupons refresh in real-time. Tap any card for details.
          </p>
        )}
      </div>
    </div>
  );
}
