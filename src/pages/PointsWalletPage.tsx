import { useMemo } from "react";
import { Coins, Gift, TrendingUp, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import FlowHeader from "@/components/FlowHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LoyaltyPointsCard from "@/components/loyalty/LoyaltyPointsCard";
import { useI18n } from "@/lib/i18n";
import {
  useMyPoints,
  useMyPointLedger,
  POINT_VALUE_BDT,
  MIN_REDEEM_POINTS,
} from "@/hooks/use-loyalty-points";

/** Points expire after 6 months of inactivity (warning at 5 months). */
const INACTIVITY_MONTHS = 6;
const WARN_MONTHS = 5;

const addMonths = (d: Date, m: number) => {
  const n = new Date(d);
  n.setMonth(n.getMonth() + m);
  return n;
};

export default function PointsWalletPage() {
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmt = (n: number) => Math.round(n).toLocaleString(locale);
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const { data: points } = useMyPoints();
  const { data: ledger } = useMyPointLedger(60);

  const balance = points?.points_balance ?? 0;

  const { lastEarnedAt, expiresAt, warnAt, daysLeft, atRisk } = useMemo(() => {
    const lastEarn = (ledger ?? []).find((r) => r.points > 0);
    const base = lastEarn ? new Date(lastEarn.created_at) : null;
    const exp = base ? addMonths(base, INACTIVITY_MONTHS) : null;
    const warn = base ? addMonths(base, WARN_MONTHS) : null;
    const days = exp ? Math.ceil((exp.getTime() - Date.now()) / 86_400_000) : null;
    return {
      lastEarnedAt: base,
      expiresAt: exp,
      warnAt: warn,
      daysLeft: days,
      atRisk: balance > 0 && days !== null && days <= 30,
    };
  }, [ledger, balance]);

  const earnRows = (ledger ?? []).filter((r) => r.points > 0);
  const spendRows = (ledger ?? []).filter((r) => r.points < 0);

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <FlowHeader title={t("lpPointsTitle")} tagline={t("lpPointsSub")} icon={Coins} />

      <div className="px-4 py-4 space-y-4">
        {/* Balance hero */}
        <Card className="overflow-hidden">
          <CardContent className="p-5 space-y-1">
            <p className="text-[11px] text-muted-foreground">{t("lpPointsBalance")}</p>
            <p className="text-4xl font-extrabold tabular-nums leading-none">{fmt(balance)}</p>
            <p className="text-sm text-muted-foreground">
              ≈ ৳{(balance * POINT_VALUE_BDT).toFixed(2)}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-3">
              <div className="rounded-2xl border border-border/60 px-3 py-2">
                <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp size={11} /> {t("lpPointsEarned")}
                </p>
                <p className="text-base font-bold tabular-nums">{fmt(points?.lifetime_earned ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 px-3 py-2">
                <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                  <Gift size={11} /> {t("lpPointsRedeemedTotal")}
                </p>
                <p className="text-base font-bold tabular-nums">{fmt(points?.lifetime_redeemed ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expiry */}
        <Card className={atRisk ? "border-destructive/50" : undefined}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              {atRisk ? (
                <AlertTriangle size={15} className="text-destructive" />
              ) : (
                <Clock size={15} className="text-primary" />
              )}
              <p className="text-sm font-bold flex-1">Upcoming expiry</p>
              {daysLeft !== null && balance > 0 && (
                <Badge variant={atRisk ? "destructive" : "secondary"}>
                  {daysLeft > 0 ? `${fmt(daysLeft)} days left` : "Expired"}
                </Badge>
              )}
            </div>
            {balance <= 0 || !expiresAt ? (
              <p className="text-[11.5px] text-muted-foreground">
                Points expire after {INACTIVITY_MONTHS} months without any earning activity. Earn points
                on any transaction to keep them alive.
              </p>
            ) : (
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last points earned</span>
                  <span className="font-semibold">{lastEarnedAt ? fmtDate(lastEarnedAt) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reminder date</span>
                  <span className="font-semibold">{warnAt ? fmtDate(warnAt) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {fmt(balance)} points expire on
                  </span>
                  <span className={`font-bold ${atRisk ? "text-destructive" : ""}`}>
                    {fmtDate(expiresAt)}
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground pt-1">
                  Any new earning resets the {INACTIVITY_MONTHS}-month window. Redeem from{" "}
                  {fmt(MIN_REDEEM_POINTS)} points.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Redemption + earn rate control */}
        <LoyaltyPointsCard />

        {/* Full history */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold">{t("lpPointsHistory")}</p>

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Earned</p>
              {!earnRows.length ? (
                <p className="text-[10.5px] text-muted-foreground">{t("lpPointsEmpty")}</p>
              ) : (
                earnRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 py-1">
                    <ArrowUpRight size={13} className="text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] truncate">{r.description ?? r.txn_type ?? r.kind}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtDate(new Date(r.created_at))}
                        {r.tier_code ? ` · ${r.tier_code}` : ""}
                      </p>
                    </div>
                    <span className="text-[11.5px] font-bold tabular-nums text-emerald-600">
                      +{fmt(r.points)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                Redeemed &amp; expired
              </p>
              {!spendRows.length ? (
                <p className="text-[10.5px] text-muted-foreground">{t("lpPointsEmpty")}</p>
              ) : (
                spendRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 py-1">
                    <ArrowDownRight size={13} className="text-destructive shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] truncate">{r.description ?? r.kind}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtDate(new Date(r.created_at))}
                      </p>
                    </div>
                    <span className="text-[11.5px] font-bold tabular-nums text-destructive">
                      {fmt(r.points)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
