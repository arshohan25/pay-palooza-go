import Seo from "@/components/Seo";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Ticket, Copy, CheckCircle2, Sparkles, Clock, Flame,
  ShoppingBag, CreditCard, Smartphone, FileText, Zap, Tag,
  ShieldCheck, AlertCircle, ChevronRight, CalendarClock, Users, Share2, Info,
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

const FLOW_MAP: Record<string, { labelKey: TranslationKey; icon: typeof ShoppingBag; route: string }> = {
  shop:     { labelKey: "cpFlowShop",     icon: ShoppingBag, route: "/shop" },
  payment:  { labelKey: "cpFlowPayment",  icon: CreditCard,  route: "/?flow=payment" },
  cash_out: { labelKey: "cpFlowCashOut",  icon: Zap,         route: "/?flow=cash_out" },
  recharge: { labelKey: "cpFlowRecharge", icon: Smartphone,  route: "/?flow=recharge" },
  bill_pay: { labelKey: "cpFlowBillPay",  icon: FileText,    route: "/?flow=bill_pay" },
  all:      { labelKey: "cpFlowAll",      icon: Tag,         route: "/shop" },
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
      {
        ok: coupon.is_active,
        label: coupon.is_active ? "Coupon is currently active" : "Coupon is inactive",
      },
      {
        ok: !coupon.starts_at || new Date(coupon.starts_at).getTime() <= now,
        label: coupon.starts_at
          ? `Starts ${new Date(coupon.starts_at).toLocaleDateString()}`
          : "Available immediately",
      },
      {
        ok: !coupon.expires_at || new Date(coupon.expires_at).getTime() > now,
        label: coupon.expires_at
          ? `Expires ${new Date(coupon.expires_at).toLocaleDateString()}`
          : "No expiry date",
      },
      {
        ok: coupon.usage_limit == null || coupon.used_count < coupon.usage_limit,
        label: coupon.usage_limit
          ? `${coupon.used_count}/${coupon.usage_limit} total redemptions used`
          : "No total usage limit",
      },
      {
        ok: coupon.per_user_limit == null || myRedemptions < coupon.per_user_limit,
        label: coupon.per_user_limit
          ? `${myRedemptions}/${coupon.per_user_limit} used by you`
          : "No per-user limit",
      },
    ];
    return { items, eligible: items.every(i => i.ok) };
  }, [coupon, myRedemptions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-[24px]" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
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

      {/* ── Hero ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden text-primary-foreground"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--shariah-green-900)) 0%, hsl(var(--shariah-green-800)) 45%, hsl(var(--shariah-green-600)) 100%)",
        }}
      >
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[hsl(var(--shariah-gold-500)/0.18)] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-56 h-56 rounded-full bg-[hsl(var(--shariah-green-300)/0.25)] blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "3px 3px" }}
        />

        <div className="relative flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 active:scale-95 transition"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
            <h2 className="text-[15px] font-bold tracking-tight">Coupon details</h2>
          </div>
          <button
            onClick={share}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 active:scale-95 transition"
          >
            <Share2 className="w-[16px] h-[16px]" />
          </button>
        </div>

        <div className="relative px-4 pt-2 pb-6">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur">
              <FlowIcon className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t(flowInfo.labelKey)}</span>
            </div>
            {isExpiring && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/90">
                <Flame className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {dLeft === 1 ? t("endsTomorrow") : `${dLeft} ${t("daysLeftSuffix")}`}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-1.5">
            {!isPct && <span className="text-[22px] font-bold opacity-90">৳</span>}
            <span className="text-[56px] font-black leading-none tracking-tight tabular-nums">
              {coupon.discount_value}
            </span>
            {isPct && <span className="text-[26px] font-black">%</span>}
            <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--shariah-gold-300))] ml-1">
              {t("cpOff")}
            </span>
          </div>

          <p className="mt-2 text-[14px] font-medium text-white/85 leading-snug">
            {coupon.description || `${t(flowInfo.labelKey)} ${t("cpDiscountSuffix")}`}
          </p>

          {coupon.max_discount != null && isPct && (
            <p className="mt-1 text-[11px] text-white/60">
              Up to ৳{Number(coupon.max_discount).toFixed(0)} maximum discount
            </p>
          )}
        </div>
      </div>

      {/* ── Coupon code ticket ────────────────────────────── */}
      <div className="px-4 -mt-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-[22px] bg-card border border-border/40 shadow-[0_6px_20px_-8px_hsl(var(--shariah-green-900)/0.25)] overflow-hidden"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full bg-background" />
          <div className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Coupon code
              </p>
              <p className="text-[22px] font-black tracking-[0.2em] text-foreground truncate">{coupon.code}</p>
            </div>
            <button
              onClick={copyCode}
              className={`h-11 px-4 rounded-xl flex items-center gap-1.5 text-[12px] font-bold transition-all ${
                copied
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted text-foreground border border-border/60 hover:bg-muted/70"
              }`}
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── Eligibility ───────────────────────────────────── */}
      <div className="px-4 mt-5">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-foreground/80">Eligibility</h3>
        </div>
        <div className="rounded-2xl bg-card border border-border/40 divide-y divide-border/40">
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
              <p className={`text-[13px] font-medium ${it.ok ? "text-foreground/85" : "text-destructive"}`}>
                {it.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Details grid ─────────────────────────────────── */}
      <div className="px-4 mt-5">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Info className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-foreground/80">Offer details</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DetailTile
            icon={Tag}
            label="Min. order"
            value={coupon.min_order_amount ? `৳${coupon.min_order_amount}` : "None"}
          />
          <DetailTile
            icon={Sparkles}
            label="Max. discount"
            value={coupon.max_discount ? `৳${coupon.max_discount}` : "Unlimited"}
          />
          <DetailTile
            icon={CalendarClock}
            label="Valid till"
            value={coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : "No expiry"}
          />
          <DetailTile
            icon={Users}
            label="Per user"
            value={coupon.per_user_limit ? `${coupon.per_user_limit} time${coupon.per_user_limit > 1 ? "s" : ""}` : "Unlimited"}
          />
        </div>
      </div>

      {/* ── Terms ─────────────────────────────────────────── */}
      <div className="px-4 mt-5">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-foreground/80">Terms & conditions</h3>
        </div>
        <ul className="rounded-2xl bg-card border border-border/40 p-4 space-y-2 text-[12px] text-muted-foreground leading-relaxed">
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
      </div>

      {/* ── Sticky redeem CTA ────────────────────────────── */}
      <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pt-3 pb-5 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={redeem}
          disabled={!eligibility?.eligible}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-primary-foreground text-[15px] font-bold active:scale-[0.98] transition-transform shadow-[0_8px_24px_-8px_hsl(var(--shariah-green-600)/0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          style={{
            background: eligibility?.eligible
              ? "linear-gradient(135deg, hsl(var(--shariah-green-600)), hsl(var(--shariah-green-800)))"
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

function DetailTile({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className="text-[14px] font-bold text-foreground truncate">{value}</p>
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
