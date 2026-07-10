import Seo from "@/components/Seo";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Ticket, Copy, CheckCircle2, Sparkles, Flame,
  ShoppingBag, CreditCard, Smartphone, FileText, Zap, Tag,
  ShieldCheck, AlertCircle, ChevronRight, CalendarClock, Users, Share2, Info, Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { setPendingCoupon } from "@/lib/couponStore";

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
  is_active: boolean;
}

const FLOW_MAP: Record<string, { labelKey: TranslationKey; icon: typeof ShoppingBag; route: string; tint: string }> = {
  shop:     { labelKey: "cpFlowShop",     icon: ShoppingBag, route: "/shop",              tint: "hsl(var(--shariah-green-600))" },
  payment:  { labelKey: "cpFlowPayment",  icon: CreditCard,  route: "/?flow=payment",     tint: "hsl(220 70% 55%)" },
  cash_out: { labelKey: "cpFlowCashOut",  icon: Zap,         route: "/?flow=cash_out",    tint: "hsl(35 90% 55%)" },
  recharge: { labelKey: "cpFlowRecharge", icon: Smartphone,  route: "/?flow=recharge",    tint: "hsl(280 65% 60%)" },
  bill_pay: { labelKey: "cpFlowBillPay",  icon: FileText,    route: "/?flow=bill_pay",    tint: "hsl(190 75% 50%)" },
  all:      { labelKey: "cpFlowAll",      icon: Tag,         route: "/shop",              tint: "hsl(var(--shariah-green-600))" },
};

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function CouponDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [myRedemptions, setMyRedemptions] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) return;
      const [{ data: c }, { data: sess }] = await Promise.all([
        supabase.from("coupons").select("*").eq("id", id).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      setCoupon((c as Coupon) ?? null);
      const uid = sess?.user?.id;
      if (uid && c) {
        const { count } = await supabase
          .from("coupon_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("coupon_id", (c as Coupon).id)
          .eq("user_id", uid);
        if (!cancelled) setMyRedemptions(count ?? 0);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const eligibility = useMemo(() => {
    if (!coupon) return null;
    const now = Date.now();
    const items = [
      { ok: coupon.is_active, label: coupon.is_active ? "Coupon is currently active" : "Coupon is inactive" },
      {
        ok: !coupon.starts_at || new Date(coupon.starts_at).getTime() <= now,
        label: coupon.starts_at ? `Starts ${new Date(coupon.starts_at).toLocaleDateString()}` : "Available immediately",
      },
      {
        ok: !coupon.expires_at || new Date(coupon.expires_at).getTime() > now,
        label: coupon.expires_at ? `Expires ${new Date(coupon.expires_at).toLocaleDateString()}` : "No expiry date",
      },
      {
        ok: coupon.usage_limit == null || coupon.used_count < coupon.usage_limit,
        label: coupon.usage_limit ? `${coupon.used_count}/${coupon.usage_limit} total redemptions used` : "No total usage limit",
      },
      {
        ok: (coupon.per_user_limit ?? 1) > myRedemptions,
        label: coupon.per_user_limit
          ? `${myRedemptions}/${coupon.per_user_limit} used by you`
          : myRedemptions > 0 ? "You've already used this coupon" : "Available for you",
      },
    ];
    return { items, eligible: items.every(i => i.ok) };
  }, [coupon, myRedemptions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b border-border/40" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-[280px] w-full rounded-[26px]" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Ticket className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-[15px] font-semibold text-foreground">Coupon not found</p>
        <p className="text-[12px] text-muted-foreground text-center">This coupon may have expired or been removed.</p>
        <button
          onClick={() => navigate("/coupons")}
          className="mt-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold"
        >
          Back to coupons
        </button>
      </div>
    );
  }

  const flow = coupon.applicable_flow || "shop";
  const flowInfo = FLOW_MAP[flow] || FLOW_MAP.shop;
  const FlowIcon = flowInfo.icon;
  const isPct = coupon.discount_type === "percentage";
  const dLeft = coupon.expires_at ? daysLeft(coupon.expires_at) : null;
  const isExpiring = dLeft != null && dLeft <= 3 && dLeft > 0;

  const copyCode = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    toast.success(t("cpCopiedToast").replace("{code}", coupon.code));
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    const text = `Use ${coupon.code} on EasyPay for ${isPct ? `${coupon.discount_value}% off` : `৳${coupon.discount_value} off`}`;
    try {
      if (navigator.share) await navigator.share({ title: "EasyPay Coupon", text });
      else { navigator.clipboard.writeText(text); toast.success("Copied share text"); }
    } catch { /* user cancelled */ }
  };

  const redeem = () => {
    if (!eligibility?.eligible) {
      toast.error("This coupon isn't eligible right now.");
      return;
    }
    navigator.clipboard.writeText(coupon.code);
    setPendingCoupon({
      id: coupon.id,
      code: coupon.code,
      discount_type: isPct ? "percentage" : "flat",
      discount_value: Number(coupon.discount_value),
      max_discount: coupon.max_discount != null ? Number(coupon.max_discount) : null,
      min_order_amount: coupon.min_order_amount != null ? Number(coupon.min_order_amount) : null,
      applicable_flow: flow,
    });
    toast.success(t("cpUseNowToast").replace("{code}", coupon.code));
    navigate(flowInfo.route);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Seo
        title={`${coupon.code} – EasyPay Coupon`}
        description={coupon.description || `Save with the ${coupon.code} coupon on EasyPay.`}
        path={`/coupons/${coupon.id}`}
      />

      {/* ── Minimal sticky header (matches list page) ─────── */}
      <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted active:scale-95 transition"
            >
              <ArrowLeft className="w-[18px] h-[18px] text-foreground" />
            </button>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-foreground leading-none">
                Coupon details
              </h1>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">{coupon.code}</p>
            </div>
          </div>
          <button
            onClick={share}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted active:scale-95 transition"
          >
            <Share2 className="w-[16px] h-[16px] text-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* ── FEATURED HERO (mirrors list page) ────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[26px] overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--shariah-green-900)) 0%, hsl(var(--shariah-green-700)) 55%, hsl(var(--shariah-green-800)) 100%)",
          }}
        >
          {/* Foil sheen */}
          <div
            className="absolute inset-0 opacity-50 pointer-events-none"
            style={{ background: "linear-gradient(115deg, transparent 30%, hsl(var(--shariah-gold-500)/0.35) 50%, transparent 70%)" }}
          />
          <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-[hsl(var(--shariah-gold-500)/0.25)] blur-2xl pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "10px 10px" }}
          />

          <div className="relative p-5 text-primary-foreground">
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(var(--shariah-gold-500)/0.18)] border border-[hsl(var(--shariah-gold-300)/0.4)]">
                <FlowIcon className="w-3 h-3 text-[hsl(var(--shariah-gold-300))]" />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[hsl(var(--shariah-gold-300))]">
                  {t(flowInfo.labelKey)}
                </span>
              </div>
              {isExpiring && dLeft != null && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/90">
                  <Flame className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
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

            <p className="mt-2 text-[13px] font-medium text-white/85 leading-snug">
              {coupon.description || `${t(flowInfo.labelKey)} ${t("cpDiscountSuffix")}`}
            </p>

            {/* Meta line */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-white/70 text-[11px] font-semibold">
              {coupon.min_order_amount ? <span>Min ৳{coupon.min_order_amount}</span> : null}
              {coupon.min_order_amount && coupon.max_discount && isPct ? <span className="opacity-40">•</span> : null}
              {isPct && coupon.max_discount ? <span>Up to ৳{coupon.max_discount}</span> : null}
            </div>

            {/* Code chip (large) */}
            <div className="mt-4 relative rounded-2xl border-2 border-dashed border-white/25 bg-white/5 overflow-hidden">
              {/* Perforated cutouts */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[hsl(var(--shariah-green-800))]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full bg-[hsl(var(--shariah-green-800))]" />
              <button
                onClick={copyCode}
                className="w-full flex items-center gap-3 px-4 py-3 active:scale-[0.99] transition-transform"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Coupon code</p>
                  <p className="text-[20px] font-black tracking-[0.22em] text-white truncate">{coupon.code}</p>
                </div>
                <div
                  className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-[11px] font-black transition-all ${
                    copied
                      ? "bg-[hsl(var(--shariah-gold-500))] text-[hsl(var(--shariah-green-900))]"
                      : "bg-white/10 text-white border border-white/20"
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "COPIED" : "COPY"}
                </div>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── ELIGIBILITY ──────────────────────────────────── */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-3 h-3 text-primary" />
              </div>
              <h3 className="text-[12px] font-black uppercase tracking-wider text-foreground/80">Eligibility</h3>
            </div>
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                eligibility?.eligible
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {eligibility?.eligible ? "Eligible" : "Not eligible"}
            </span>
          </div>
          <div className="rounded-2xl bg-card border border-border/50 divide-y divide-border/40 overflow-hidden">
            {eligibility?.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                {it.ok ? (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  </div>
                )}
                <p className={`text-[12.5px] font-medium ${it.ok ? "text-foreground/85" : "text-destructive"}`}>
                  {it.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── DETAILS GRID (icon tiles matching list) ──────── */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="w-3 h-3 text-primary" />
            </div>
            <h3 className="text-[12px] font-black uppercase tracking-wider text-foreground/80">Offer details</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <DetailTile
              icon={Tag}
              tint={flowInfo.tint}
              label="Min. order"
              value={coupon.min_order_amount ? `৳${coupon.min_order_amount}` : "None"}
            />
            <DetailTile
              icon={Sparkles}
              tint="hsl(var(--shariah-gold-700))"
              label="Max. discount"
              value={coupon.max_discount ? `৳${coupon.max_discount}` : "Unlimited"}
            />
            <DetailTile
              icon={CalendarClock}
              tint="hsl(190 75% 50%)"
              label="Valid till"
              value={coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : "No expiry"}
            />
            <DetailTile
              icon={Users}
              tint="hsl(280 65% 60%)"
              label="Per user"
              value={coupon.per_user_limit ? `${coupon.per_user_limit}x` : "Unlimited"}
            />
          </div>
        </section>

        {/* ── TERMS ────────────────────────────────────────── */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-3 h-3 text-primary" />
            </div>
            <h3 className="text-[12px] font-black uppercase tracking-wider text-foreground/80">Terms & conditions</h3>
          </div>
          <ul className="rounded-2xl bg-card border border-border/50 p-4 space-y-2 text-[12px] text-muted-foreground leading-relaxed">
            <TermLine>
              Applies to <span className="font-semibold text-foreground/85">{t(flowInfo.labelKey)}</span> transactions only.
            </TermLine>
            {coupon.min_order_amount && (
              <TermLine>Minimum transaction amount of ৳{coupon.min_order_amount} required.</TermLine>
            )}
            {isPct && coupon.max_discount && (
              <TermLine>Percentage discount is capped at ৳{coupon.max_discount} per transaction.</TermLine>
            )}
            {coupon.per_user_limit && (
              <TermLine>Each user can redeem this coupon up to {coupon.per_user_limit} time(s).</TermLine>
            )}
            <TermLine>Cannot be combined with other coupons or cashback offers on the same transaction.</TermLine>
            <TermLine>EasyPay may withdraw or amend this offer at any time without prior notice.</TermLine>
            <TermLine>Refunded transactions will reverse the coupon usage.</TermLine>
          </ul>
        </section>

        <p className="text-center text-[10.5px] text-muted-foreground/60 pt-1 flex items-center justify-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          Terms subject to EasyPay policy
        </p>
      </div>

      {/* ── Sticky redeem CTA ────────────────────────────── */}
      <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pt-3 pb-5 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={redeem}
          disabled={!eligibility?.eligible}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-[hsl(var(--shariah-green-900))] text-[15px] font-black tracking-wide active:scale-[0.98] transition-transform shadow-[0_8px_24px_-8px_hsl(var(--shariah-gold-500)/0.7)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:text-muted-foreground"
          style={{
            background: eligibility?.eligible
              ? "linear-gradient(135deg, hsl(var(--shariah-gold-300)), hsl(var(--shariah-gold-500)))"
              : "hsl(var(--muted))",
          }}
        >
          <Ticket className="w-5 h-5" />
          {eligibility?.eligible ? "Redeem now" : "Not eligible"}
          {eligibility?.eligible && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function DetailTile({ icon: Icon, label, value, tint }: {
  icon: typeof Tag; label: string; value: string; tint: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-3 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${tint}18`, color: tint }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9.5px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-[13px] font-bold text-foreground truncate leading-tight">{value}</p>
      </div>
    </div>
  );
}

function TermLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
      <span>{children}</span>
    </li>
  );
}
