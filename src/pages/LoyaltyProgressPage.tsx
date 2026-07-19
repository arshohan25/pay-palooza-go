import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { ArrowLeft, Sparkles, TrendingUp, Wallet, PiggyBank, Repeat, Award, Percent, Gift, Headphones, Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import LoyaltyBadge from "@/components/LoyaltyBadge";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";
import { useLoyaltyPerks } from "@/hooks/use-loyalty-perks";
import { computeScoreBreakdown, LOYALTY_SCORE_WEIGHTS } from "@/lib/loyaltyScore";

const METRIC_FIELDS: Array<{
  key: keyof LoyaltyTier & string;
  current: (l: any) => number;
  label: string;
  icon: React.ElementType;
  suffix?: string;
  action: string;
  actionRoute?: string;
}> = [
  { key: "min_volume_30d",         current: (l) => Number(l?.volume_30d ?? 0),         label: "30-day volume",         icon: TrendingUp, suffix: "৳", action: "Send money, pay bills or shop",    actionRoute: "/pay" },
  { key: "min_lifetime_txn_count", current: (l) => Number(l?.lifetime_txn_count ?? 0), label: "Lifetime transactions", icon: Repeat,     suffix: "",  action: "Complete more transactions",       actionRoute: "/" },
  { key: "min_wallet_balance",     current: (l) => Number(l?.wallet_balance ?? 0),     label: "Wallet balance",        icon: Wallet,     suffix: "৳", action: "Add money to your wallet",         actionRoute: "/" },
  { key: "min_addmoney_lifetime",  current: (l) => Number(l?.addmoney_lifetime ?? 0),  label: "Add-money lifetime",    icon: Wallet,     suffix: "৳", action: "Top up from your bank / card",     actionRoute: "/" },
  { key: "min_savings_balance",    current: (l) => Number(l?.savings_balance ?? 0),    label: "Savings balance",       icon: PiggyBank,  suffix: "৳", action: "Grow your savings goals",          actionRoute: "/savings" },
];

const fmt = (n: number, suffix?: string) =>
  suffix === "৳" ? `৳${Math.round(n).toLocaleString()}` : `${Math.round(n).toLocaleString()}${suffix ?? ""}`;

const pctLabel = (p: number) => `${p.toFixed(p < 10 ? 1 : 0)}%`;

export default function LoyaltyProgressPage() {
  const navigate = useNavigate();
  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty, isLoading } = useMyLoyalty();
  const perks = useLoyaltyPerks();

  const sorted = useMemo(() => (tiers ?? []).slice().sort((a, b) => a.rank - b.rank), [tiers]);
  const currentTier = perks.tier;
  const nextTier = useMemo(() => {
    if (!currentTier) return sorted[0] ?? null;
    return sorted.find((t) => t.rank > currentTier.rank && t.is_active) ?? null;
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
          <p className="text-sm font-bold flex items-center gap-1.5"><Sparkles size={14} className="text-primary" /> EasyPay Club</p>
          <p className="text-[11px] text-muted-foreground truncate">Track your loyalty progress</p>
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
                <p className="text-[11px] uppercase tracking-wider opacity-80">Current tier</p>
                <p className="text-2xl font-bold truncate">{currentTier?.name ?? "Not enrolled"}</p>
                {currentTier?.description && <p className="text-[12px] opacity-90 line-clamp-2 mt-0.5">{currentTier.description}</p>}
              </div>
              {currentTier && <LoyaltyBadge tier={currentTier} size="lg" />}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <PerkChip icon={Percent} label={`Fee −${perks.feeDiscountPct}%`} />
              <PerkChip icon={TrendingUp} label={`Limits ×${perks.limitMultiplier.toFixed(2)}`} />
              <PerkChip icon={Gift} label={`Cashback +${perks.cashbackBonusPct}%`} />
              <PerkChip icon={Headphones} label={perks.prioritySupport ? "Priority support" : "Standard support"} />
            </div>
          </div>
        </Card>

        {/* Next tier progress */}
        {nextTier ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Next tier</p>
                  <p className="text-lg font-bold truncate">{nextTier.name}</p>
                </div>
                <LoyaltyBadge tier={nextTier} size="md" />
              </div>

              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Overall</span>
                  <span className="text-xl font-bold text-primary">{pctLabel(overallPct)}</span>
                </div>
                <Progress value={overallPct} className="h-2" />
                <p className="text-[10.5px] text-muted-foreground mt-1.5">
                  Averaged across {gaps.length} requirement{gaps.length === 1 ? "" : "s"}.
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
                      <p className="text-[13px] font-medium flex-1">{g.label}</p>
                      <span className={`text-[11.5px] font-bold ${g.done ? "text-emerald-600" : "text-foreground"}`}>
                        {pctLabel(g.pct)}
                      </span>
                    </div>
                    <Progress value={g.pct} className="h-1.5" />
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <p className="text-[11px] text-muted-foreground truncate">
                        {fmt(g.current, g.suffix)} <span className="opacity-60">of</span> {fmt(g.target, g.suffix)}
                        {!g.done && <> · <span className="text-foreground/80 font-medium">{fmt(g.remaining, g.suffix)} to go</span></>}
                      </p>
                      {!g.done && g.actionRoute && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] shrink-0" onClick={() => navigate(g.actionRoute!)}>
                          {g.action.split(" ").slice(0, 2).join(" ")} →
                        </Button>
                      )}
                      {g.done && <span className="text-[10px] font-bold text-emerald-600">DONE</span>}
                    </div>
                  </div>
                ))}
                {gaps.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">You already meet every requirement — your tier will update on next recalculation.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center space-y-1">
              <Award className="w-8 h-8 mx-auto text-amber-500" />
              <p className="font-bold">You've reached the top!</p>
              <p className="text-[12px] text-muted-foreground">You are enjoying the highest EasyPay Club tier available.</p>
            </CardContent>
          </Card>
        )}

        {/* Combined score breakdown */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-primary" />
              <p className="text-sm font-bold flex-1">Combined score breakdown</p>
              <span className="text-[11px] text-muted-foreground">
                {breakdown.total.toFixed(1)}
                {scoreTarget > 0 && ` / ${scoreTarget.toLocaleString()}`}
              </span>
            </div>

            {scoreTarget > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">Score toward {nextTier?.name}</span>
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
                    <span className="tabular-nums font-bold">+{p.points.toFixed(1)} pts</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">
                    {p.metric.toLocaleString()} × {p.weight} weight · contributes {pctLabel(p.pctOfScore)} of your score
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
              Weights: volume ×{LOYALTY_SCORE_WEIGHTS.volume_30d}, txn count ×{LOYALTY_SCORE_WEIGHTS.txn_count},
              wallet ×{LOYALTY_SCORE_WEIGHTS.wallet}, add-money ×{LOYALTY_SCORE_WEIGHTS.addmoney},
              savings ×{LOYALTY_SCORE_WEIGHTS.savings}. The bigger the contribution bar, the more that metric moves your tier.
            </p>
          </CardContent>
        </Card>

        {/* All tiers roadmap */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">All tiers</p>
            <div className="space-y-2">
              {sorted.filter((t) => t.is_active).map((t) => {
                const Icon = (Icons as any)[t.badge_icon] ?? Icons.Award;
                const isCurrent = currentTier?.id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${isCurrent ? "border-primary bg-primary/5" : "border-border/60"}`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${t.gradient_from ?? t.badge_color}, ${t.gradient_to ?? t.badge_color})` }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13.5px] font-semibold truncate">{t.name}</p>
                        {isCurrent && <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">CURRENT</span>}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground truncate">
                        Limits ×{t.limit_multiplier} · Fee −{t.fee_discount_pct}% · Cashback +{t.cashback_bonus_pct}%
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">R{t.rank}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isLoading && <p className="text-center text-xs text-muted-foreground">Loading your progress…</p>}
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
