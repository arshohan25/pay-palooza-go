import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { ArrowLeft, Sparkles, TrendingUp, Wallet, PiggyBank, Repeat, Award, Percent, Gift, Headphones, Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import LoyaltyBadge from "@/components/LoyaltyBadge";
import TierLimitsCard from "@/components/loyalty/TierLimitsCard";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";
import { useLoyaltyPerks } from "@/hooks/use-loyalty-perks";
import { computeScoreBreakdown, LOYALTY_SCORE_WEIGHTS } from "@/lib/loyaltyScore";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type MetricField = {
  key: keyof LoyaltyTier & string;
  current: (l: any) => number;
  labelKey: TranslationKey;
  icon: React.ElementType;
  suffix?: string;
  actionKey: TranslationKey;
  actionRoute?: string;
};

const METRIC_FIELDS: MetricField[] = [
  { key: "min_volume_30d",         current: (l) => Number(l?.volume_30d ?? 0),         labelKey: "lpMetricVolume",   icon: TrendingUp, suffix: "৳", actionKey: "lpActionSend",     actionRoute: "/pay" },
  { key: "min_lifetime_txn_count", current: (l) => Number(l?.lifetime_txn_count ?? 0), labelKey: "lpMetricTxnCount", icon: Repeat,     suffix: "",  actionKey: "lpActionTxn",      actionRoute: "/" },
  { key: "min_wallet_balance",     current: (l) => Number(l?.wallet_balance ?? 0),     labelKey: "lpMetricWallet",   icon: Wallet,     suffix: "৳", actionKey: "lpActionAddMoney", actionRoute: "/" },
  { key: "min_addmoney_lifetime",  current: (l) => Number(l?.addmoney_lifetime ?? 0),  labelKey: "lpMetricAddMoney", icon: Wallet,     suffix: "৳", actionKey: "lpActionTopUp",    actionRoute: "/" },
  { key: "min_savings_balance",    current: (l) => Number(l?.savings_balance ?? 0),    labelKey: "lpMetricSavings",  icon: PiggyBank,  suffix: "৳", actionKey: "lpActionGrow",     actionRoute: "/savings" },
];

export default function LoyaltyProgressPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmtNum = (n: number) => Math.round(n).toLocaleString(locale);
  const fmt = (n: number, suffix?: string) =>
    suffix === "৳" ? `৳${fmtNum(n)}` : `${fmtNum(n)}${suffix ?? ""}`;
  const pctLabel = (p: number) => `${p.toFixed(p < 10 ? 1 : 0)}%`;

  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty, isLoading } = useMyLoyalty();
  const perks = useLoyaltyPerks();

  const sorted = useMemo(() => (tiers ?? []).slice().sort((a, b) => a.rank - b.rank), [tiers]);
  const currentTier = perks.tier;
  const nextTier = useMemo(() => {
    if (!currentTier) return sorted[0] ?? null;
    return sorted.find((tr) => tr.rank > currentTier.rank && tr.is_active) ?? null;
  }, [sorted, currentTier]);

  const gaps = useMemo(() => {
    if (!nextTier) return [];
    return METRIC_FIELDS.map((f) => {
      const target = Number((nextTier as any)[f.key] ?? 0);
      const current = f.current(loyalty);
      const remaining = Math.max(0, target - current);
      const pct = target > 0 ? Math.min(100, (current / target) * 100) : 100;
      const done = current >= target;
      return { ...f, target, current, remaining, pct, done };
    }).filter((g) => g.target > 0);
  }, [nextTier, loyalty]);

  const overallPct = useMemo(() => {
    if (!gaps.length) return 100;
    return gaps.reduce((s, g) => s + g.pct, 0) / gaps.length;
  }, [gaps]);

  const breakdown = useMemo(() => computeScoreBreakdown(loyalty ?? {}), [loyalty]);
  const scoreTarget = Number(nextTier?.min_combined_score ?? 0);
  const scorePct = scoreTarget > 0 ? Math.min(100, (breakdown.total / scoreTarget) * 100) : 100;

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/60 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold flex items-center gap-1.5"><Sparkles size={14} className="text-primary" /> {t("lpEasypayClub")}</p>
          <p className="text-[11px] text-muted-foreground truncate">{t("lpSubtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
        {/* Current tier hero */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div
            className="p-5 text-white"
            style={{
              background: currentTier
                ? `linear-gradient(135deg, ${currentTier.gradient_from ?? currentTier.badge_color}, ${currentTier.gradient_to ?? currentTier.badge_color})`
                : "linear-gradient(135deg,#64748b,#334155)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider opacity-80">{t("lpCurrentTier")}</p>
                <p className="text-2xl font-bold truncate">{currentTier?.name ?? t("lpNotEnrolled")}</p>
                {currentTier?.description && <p className="text-[12px] opacity-90 line-clamp-2 mt-0.5">{currentTier.description}</p>}
              </div>
              {currentTier && <LoyaltyBadge tier={currentTier} size="lg" />}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <PerkChip icon={Percent} label={t("lpFeeMinus").replace("{n}", fmtNum(perks.feeDiscountPct))} />
              <PerkChip icon={TrendingUp} label={t("lpLimitsX").replace("{n}", perks.limitMultiplier.toFixed(2))} />
              <PerkChip icon={Gift} label={t("lpCashbackPlus").replace("{n}", fmtNum(perks.cashbackBonusPct))} />
              <PerkChip icon={Headphones} label={perks.prioritySupport ? t("lpPrioritySupport") : t("lpStandardSupport")} />
            </div>
          </div>
        </Card>

        {/* Next tier progress */}
        {nextTier ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("lpNextTier")}</p>
                  <p className="text-lg font-bold truncate">{nextTier.name}</p>
                </div>
                <LoyaltyBadge tier={nextTier} size="md" />
              </div>

              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("lpOverall")}</span>
                  <span className="text-xl font-bold text-primary">{pctLabel(overallPct)}</span>
                </div>
                <Progress value={overallPct} className="h-2" />
                <p className="text-[10.5px] text-muted-foreground mt-1.5">
                  {(gaps.length === 1 ? t("lpAveragedReq") : t("lpAveragedReqs")).replace("{n}", fmtNum(gaps.length))}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {gaps.map((g) => (
                  <div
                    key={g.key}
                    className={`rounded-2xl border p-3 ${g.done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60"}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <g.icon size={14} className={g.done ? "text-emerald-600" : "text-primary"} />
                      <p className="text-[13px] font-medium flex-1">{t(g.labelKey)}</p>
                      <span className={`text-[11.5px] font-bold ${g.done ? "text-emerald-600" : "text-foreground"}`}>
                        {pctLabel(g.pct)}
                      </span>
                    </div>
                    <Progress value={g.pct} className="h-1.5" />
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <p className="text-[11px] text-muted-foreground truncate">
                        {fmt(g.current, g.suffix)} <span className="opacity-60">{t("lpOf")}</span> {fmt(g.target, g.suffix)}
                        {!g.done && <> · <span className="text-foreground/80 font-medium">{t("lpToGo").replace("{amt}", fmt(g.remaining, g.suffix))}</span></>}
                      </p>
                      {!g.done && g.actionRoute && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] shrink-0" onClick={() => navigate(g.actionRoute!)}>
                          {t(g.actionKey)} →
                        </Button>
                      )}
                      {g.done && <span className="text-[10px] font-bold text-emerald-600">{t("lpDone")}</span>}
                    </div>
                  </div>
                ))}
                {gaps.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">{t("lpAllMet")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center space-y-1">
              <Award className="w-8 h-8 mx-auto text-amber-500" />
              <p className="font-bold">{t("lpTopReached")}</p>
              <p className="text-[12px] text-muted-foreground">{t("lpTopDesc")}</p>
            </CardContent>
          </Card>
        )}

        {/* Tier limits */}
        <TierLimitsCard />

        {/* Combined score breakdown */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-primary" />
              <p className="text-sm font-bold flex-1">{t("lpScoreBreakdown")}</p>
              <span className="text-[11px] text-muted-foreground">
                {breakdown.total.toFixed(1)}
                {scoreTarget > 0 && ` / ${scoreTarget.toLocaleString(locale)}`}
              </span>
            </div>

            {scoreTarget > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">{t("lpScoreToward").replace("{tier}", nextTier?.name ?? "")}</span>
                  <span className="font-semibold">{pctLabel(scorePct)}</span>
                </div>
                <Progress value={scorePct} className="h-1.5" />
              </div>
            )}

            <div className="space-y-1.5">
              {breakdown.parts.map((p) => (
                <div key={p.key} className="rounded-xl bg-muted/40 px-3 py-2">
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="font-medium">{p.label}</span>
                    <span className="tabular-nums font-bold">{t("lpPoints").replace("{n}", p.points.toFixed(1))}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">
                    {t("lpPartInfo")
                      .replace("{metric}", p.metric.toLocaleString(locale))
                      .replace("{weight}", String(p.weight))
                      .replace("{pct}", pctLabel(p.pctOfScore))}
                  </p>
                  <div className="mt-1 h-1 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full bg-primary/70"
                      style={{ width: `${Math.min(100, p.pctOfScore)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {t("lpWeightsFootnote")
                .replace("{v}", String(LOYALTY_SCORE_WEIGHTS.volume_30d))
                .replace("{t}", String(LOYALTY_SCORE_WEIGHTS.txn_count))
                .replace("{w}", String(LOYALTY_SCORE_WEIGHTS.wallet))
                .replace("{a}", String(LOYALTY_SCORE_WEIGHTS.addmoney))
                .replace("{s}", String(LOYALTY_SCORE_WEIGHTS.savings))}
            </p>
          </CardContent>
        </Card>

        {/* All tiers roadmap */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{t("lpAllTiers")}</p>
            <div className="space-y-2">
              {sorted.filter((tr) => tr.is_active).map((tr) => {
                const Icon = (Icons as any)[tr.badge_icon] ?? Icons.Award;
                const isCurrent = currentTier?.id === tr.id;
                return (
                  <div
                    key={tr.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${isCurrent ? "border-primary bg-primary/5" : "border-border/60"}`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${tr.gradient_from ?? tr.badge_color}, ${tr.gradient_to ?? tr.badge_color})` }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13.5px] font-semibold truncate">{tr.name}</p>
                        {isCurrent && <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">{t("lpCurrentBadge")}</span>}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground truncate">
                        {t("lpTierPerks")
                          .replace("{lm}", String(tr.limit_multiplier))
                          .replace("{fd}", String(tr.fee_discount_pct))
                          .replace("{cb}", String(tr.cashback_bonus_pct))}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">R{tr.rank}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isLoading && <p className="text-center text-xs text-muted-foreground">{t("lpLoadingProgress")}</p>}
      </div>
    </div>
  );
}

function PerkChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur px-2.5 py-1.5 text-[11px] font-semibold">
      <Icon size={12} /> <span className="truncate">{label}</span>
    </div>
  );
}
