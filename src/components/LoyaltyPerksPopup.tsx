import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as Icons from "lucide-react";
import { Sparkles, TrendingUp, Percent, Gift, Headphones, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLoyaltyPerks } from "@/hooks/use-loyalty-perks";

interface LoyaltyPerksPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dynamic popup summarising the user's current EasyPay Club perks.
 * All values are read live from `useLoyaltyPerks`.
 */
export default function LoyaltyPerksPopup({ open, onOpenChange }: LoyaltyPerksPopupProps) {
  const perks = useLoyaltyPerks();
  const navigate = useNavigate();
  const t = perks.tier;

  const Icon = (t && ((Icons as any)[t.badge_icon] ?? Icons.Award)) ?? Icons.Award;
  const bg = t
    ? `linear-gradient(135deg, ${t.gradient_from ?? t.badge_color}, ${t.gradient_to ?? t.badge_color})`
    : "linear-gradient(135deg, #64748b, #334155)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl border-0">
        {/* Hero */}
        <div className="p-5 text-white relative" style={{ background: bg }}>
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/10" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles size={16} /> EasyPay Club
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center gap-3 mt-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Icon size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider opacity-80">Your tier</p>
              <p className="text-xl font-bold truncate">{t?.name ?? "Not enrolled"}</p>
              {t?.description && <p className="text-[11px] opacity-90 line-clamp-2">{t.description}</p>}
            </div>
          </div>
          {perks.isOverride && (
            <div className="relative mt-3 rounded-lg bg-white/15 backdrop-blur px-2.5 py-1.5 flex items-center gap-1.5 text-[11px]">
              <Crown size={12} />
              <span className="truncate">
                Admin-granted tier{perks.overrideUntil ? ` · until ${new Date(perks.overrideUntil).toLocaleDateString()}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Perks grid */}
        <div className="p-4 space-y-2 bg-background">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1">
            Active perks
          </p>

          <PerkRow icon={TrendingUp} label="Transaction limits" value={`×${perks.limitMultiplier.toFixed(2)}`} tone="text-primary" />
          <PerkRow icon={Percent} label="Fee discount" value={perks.feeDiscountPct > 0 ? `−${perks.feeDiscountPct}%` : "—"} tone="text-emerald-600" />
          <PerkRow icon={Gift} label="Cashback bonus" value={perks.cashbackBonusPct > 0 ? `+${perks.cashbackBonusPct}%` : "—"} tone="text-amber-600" />
          <PerkRow icon={Headphones} label="Priority support" value={perks.prioritySupport ? "Yes" : "No"} tone={perks.prioritySupport ? "text-primary" : "text-muted-foreground"} />

          <Button
            className="w-full mt-3 h-11 rounded-2xl"
            onClick={() => { onOpenChange(false); navigate("/loyalty"); }}
          >
            See tier progress <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PerkRow({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3.5 py-2.5">
      <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
        <Icon size={15} className={tone} />
      </div>
      <p className="flex-1 text-[13px] font-medium">{label}</p>
      <span className={`text-[13px] font-bold ${tone}`}>{value}</span>
    </div>
  );
}
