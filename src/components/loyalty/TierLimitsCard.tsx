import { ArrowUpRight, ArrowDownLeft, Banknote, CreditCard, Smartphone, FileText, Building2, Wallet, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useMyTierLimits, TIER_TXN_KEYS, type TierTxnKey } from "@/hooks/use-loyalty-tier-limits";

const META: Record<TierTxnKey, { icon: React.ElementType; labelKey: TranslationKey }> = {
  send:         { icon: ArrowUpRight,  labelKey: "sendMoney" },
  cashout:      { icon: Banknote,      labelKey: "cashOut" },
  cashin:       { icon: ArrowDownLeft, labelKey: "cashIn" },
  addmoney:     { icon: Wallet,        labelKey: "addMoney" },
  payment:      { icon: CreditCard,    labelKey: "payment" },
  recharge:     { icon: Smartphone,    labelKey: "mobileRecharge" },
  paybill:      { icon: FileText,      labelKey: "payBill" },
  banktransfer: { icon: Building2,     labelKey: "bankTransfer" },
};

/**
 * Shows the daily/monthly ceilings unlocked by the user's EasyPay Club tier,
 * plus what the next tier adds — all values read live from `loyalty_tier_limits`.
 */
export default function TierLimitsCard() {
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmt = (n: number) => Math.round(n).toLocaleString(locale);
  const { tier, nextTier, limits, nextLimits, uplift } = useMyTierLimits();

  const rows = TIER_TXN_KEYS.filter((k) => (limits[k]?.dailyAmount ?? 0) > 0 || (nextLimits[k]?.dailyAmount ?? 0) > 0);
  if (!rows.length) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gauge size={15} className="text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{t("lpTierLimits")}</p>
            <p className="text-[10.5px] text-muted-foreground truncate">{t("lpTierLimitsSub")}</p>
          </div>
          {tier && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${tier.gradient_from ?? tier.badge_color}, ${tier.gradient_to ?? tier.badge_color})` }}
            >
              {tier.name}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {rows.map((k) => {
            const meta = META[k];
            const cur = limits[k];
            const up = uplift[k] ?? 0;
            return (
              <div key={k} className="rounded-2xl border border-border/60 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <meta.icon size={13} className="text-primary" />
                  </div>
                  <p className="text-[13px] font-medium flex-1 truncate">{t(meta.labelKey)}</p>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold tabular-nums">৳{fmt(cur?.dailyAmount ?? 0)}</p>
                    <p className="text-[9.5px] text-muted-foreground">{t("lpPerDay")}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5 pl-9 gap-2">
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    ৳{fmt(cur?.monthlyAmount ?? 0)} {t("lpPerMonth")}
                    {(cur?.dailyCount ?? 0) > 0 && <> · {t("lpTxnPerDay").replace("{n}", fmt(cur!.dailyCount))}</>}
                  </p>
                  {up > 0 && nextTier && (
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                      {t("lpUpliftPlus").replace("{n}", fmt(up))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {nextTier && (
          <p className="text-[10px] text-muted-foreground">
            {t("lpUnlockNext").replace("{tier}", nextTier.name)} · {t("lpLimitSourceTier")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
