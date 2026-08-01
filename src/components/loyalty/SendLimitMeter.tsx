import { Gauge } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { useTxnLimitStatus } from "@/hooks/use-txn-limit-status";
import { useMyTierLimits } from "@/hooks/use-loyalty-tier-limits";

/**
 * Live "remaining Send Money limit" indicator: daily + monthly headroom for the
 * user's current EasyPay Club tier, plus what the next tier would add.
 * Values come straight from the server resolver used to enforce the limit.
 */
export default function SendLimitMeter({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmt = (n: number) => Math.round(n).toLocaleString(locale);
  const { data } = useTxnLimitStatus("send");
  const { tier, nextTier, uplift } = useMyTierLimits();

  const daily = data?.daily;
  const monthly = data?.monthly;
  if (!daily && !monthly) return null;

  const pct = (used: number, max: number) => (max > 0 ? Math.min((used / max) * 100, 100) : 0);
  const sendUplift = uplift.send ?? 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Gauge size={13} className="text-primary shrink-0" />
        <p className="text-[12px] font-semibold flex-1 truncate">{t("lpSendLimitTitle")}</p>
        {tier && (
          <span
            className="text-[9.5px] px-2 py-0.5 rounded-full font-bold text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${tier.gradient_from ?? tier.badge_color}, ${tier.gradient_to ?? tier.badge_color})`,
            }}
          >
            {tier.name}
          </span>
        )}
      </div>

      {daily && daily.maxAmount > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10.5px] text-muted-foreground">{t("lpRemainingToday")}</span>
            <span className="text-[12px] font-bold tabular-nums">
              ৳{fmt(daily.remainingAmount ?? 0)}{" "}
              <span className="text-[9.5px] font-normal text-muted-foreground">
                {t("lpLimitOf").replace("{n}", fmt(daily.maxAmount))}
              </span>
            </span>
          </div>
          <Progress value={pct(daily.usedAmount, daily.maxAmount)} className="h-1.5 mt-1" />
        </div>
      )}

      {!compact && monthly && monthly.maxAmount > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10.5px] text-muted-foreground">{t("lpRemainingMonth")}</span>
            <span className="text-[12px] font-bold tabular-nums">
              ৳{fmt(monthly.remainingAmount ?? 0)}{" "}
              <span className="text-[9.5px] font-normal text-muted-foreground">
                {t("lpLimitOf").replace("{n}", fmt(monthly.maxAmount))}
              </span>
            </span>
          </div>
          <Progress value={pct(monthly.usedAmount, monthly.maxAmount)} className="h-1.5 mt-1" />
        </div>
      )}

      {nextTier && sendUplift > 0 && (
        <p className="text-[10px] font-semibold text-emerald-600">
          {t("lpNextTierUplift").replace("{tier}", nextTier.name).replace("{n}", fmt(sendUplift))}
        </p>
      )}
    </div>
  );
}
