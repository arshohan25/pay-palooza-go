import { useState } from "react";
import { Gift, Sparkles, ArrowUpRight, Coins } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  useMyPoints,
  useMyPointLedger,
  useRedeemPoints,
  useSendPointRates,
  POINT_VALUE_BDT,
  MIN_REDEEM_POINTS,
  REDEEM_STEP,
} from "@/hooks/use-loyalty-points";

/**
 * EasyPay points: tier-based accrual on Send Money plus redemption into wallet
 * balance. All figures come from the server (`user_loyalty_points`,
 * `loyalty_point_rules`, `redeem_loyalty_points`).
 */
export default function LoyaltyPointsCard() {
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmt = (n: number) => Math.round(n).toLocaleString(locale);

  const { data: points } = useMyPoints();
  const { data: ledger } = useMyPointLedger(6);
  const { tier, nextTier, rate, nextRate } = useSendPointRates("send");
  const redeem = useRedeemPoints();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(MIN_REDEEM_POINTS));

  const balance = points?.points_balance ?? 0;
  const pts = parseInt(amount, 10);
  const invalid =
    !Number.isFinite(pts) ||
    pts < MIN_REDEEM_POINTS ||
    pts % REDEEM_STEP !== 0 ||
    pts > balance;

  const handleRedeem = async () => {
    try {
      const res = await redeem.mutateAsync(pts);
      toast.success(
        t("lpPointsRedeemed")
          .replace("{points}", fmt(res.points_redeemed))
          .replace("{cash}", res.cash_credited.toFixed(2)),
      );
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Redemption failed");
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Coins size={15} className="text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{t("lpPointsTitle")}</p>
            <p className="text-[10.5px] text-muted-foreground truncate">{t("lpPointsSub")}</p>
          </div>
          {tier && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white shrink-0"
              style={{
                background: `linear-gradient(135deg, ${tier.gradient_from ?? tier.badge_color}, ${tier.gradient_to ?? tier.badge_color})`,
              }}
            >
              {tier.name}
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 px-3 py-3">
          <p className="text-[10.5px] text-muted-foreground">{t("lpPointsBalance")}</p>
          <p className="text-2xl font-extrabold tabular-nums leading-tight">{fmt(balance)}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("lpPointsWorth").replace("{n}", (balance * POINT_VALUE_BDT).toFixed(2))}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[10.5px] text-muted-foreground">
            <span>
              {t("lpPointsEarned")}: <b className="text-foreground">{fmt(points?.lifetime_earned ?? 0)}</b>
            </span>
            <span>
              {t("lpPointsRedeemedTotal")}:{" "}
              <b className="text-foreground">{fmt(points?.lifetime_redeemed ?? 0)}</b>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-primary shrink-0" />
          <p className="text-[11.5px] flex-1">
            {t("lpPointsEarnRate").replace("{n}", String(rate || 0))}
          </p>
          <Button size="sm" disabled={balance < MIN_REDEEM_POINTS} onClick={() => setOpen(true)}>
            <Gift className="w-3.5 h-3.5 mr-1" /> {t("lpPointsRedeem")}
          </Button>
        </div>

        {nextTier && nextRate > rate && (
          <p className="text-[10px] font-semibold text-emerald-600">
            {t("lpPointsNextTierRate")
              .replace("{tier}", nextTier.name)
              .replace("{n}", String(nextRate))}
          </p>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold">{t("lpPointsHistory")}</p>
          {!ledger?.length ? (
            <p className="text-[10.5px] text-muted-foreground">{t("lpPointsEmpty")}</p>
          ) : (
            ledger.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px]">
                <ArrowUpRight
                  size={12}
                  className={r.points >= 0 ? "text-emerald-600" : "text-destructive rotate-90"}
                />
                <span className="flex-1 truncate text-muted-foreground">{r.description}</span>
                <span
                  className={`font-bold tabular-nums shrink-0 ${r.points >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {r.points >= 0 ? "+" : ""}
                  {fmt(r.points)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("lpPointsRedeem")}</DialogTitle>
            <DialogDescription>{t("lpPointsRedeemHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="redeem-points">{t("lpPointsBalance")}: {fmt(balance)}</Label>
            <Input
              id="redeem-points"
              type="number"
              step={REDEEM_STEP}
              min={MIN_REDEEM_POINTS}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {invalid ? (
              <p className="text-[11px] text-destructive">
                {pts > balance
                  ? `Maximum ${fmt(balance)} points`
                  : `Enter a multiple of ${REDEEM_STEP}, at least ${MIN_REDEEM_POINTS}`}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("lpPointsWorth").replace("{n}", (pts * POINT_VALUE_BDT).toFixed(2))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button disabled={invalid || redeem.isPending} onClick={handleRedeem}>
              {redeem.isPending ? "…" : t("lpPointsRedeem")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
