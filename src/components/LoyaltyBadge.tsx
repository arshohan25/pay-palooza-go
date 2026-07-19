import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** True on devices whose primary input cannot hover (phones/tablets). */
function useIsTouchDevice() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return touch;
}

interface LoyaltyBadgeProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
  /** Pass a specific tier to render (skips fetching current user tier) */
  tier?: LoyaltyTier;
  onClick?: () => void;
  /** Disable tooltip (e.g., when placed inside another tooltip/popover) */
  disableTooltip?: boolean;
}

const METRIC_KEYS: Array<[keyof LoyaltyTier, keyof any]> = [
  ["min_volume_30d", "volume_30d"],
  ["min_lifetime_txn_count", "lifetime_txn_count"],
  ["min_wallet_balance", "wallet_balance"],
  ["min_addmoney_lifetime", "addmoney_lifetime"],
  ["min_savings_balance", "savings_balance"],
];

/**
 * Displays the user's current EasyPay Club tier as a gradient badge.
 * On hover/tap, shows a tooltip with tier name and next-tier progress %.
 */
export default function LoyaltyBadge({
  size = "md",
  showName = true,
  className,
  tier: tierProp,
  onClick,
  disableTooltip,
}: LoyaltyBadgeProps) {
  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty } = useMyLoyalty();
  const isTouch = useIsTouchDevice();

  const sortedTiers = useMemo(
    () => (tiers ?? []).filter((t) => t.is_active).slice().sort((a, b) => a.rank - b.rank),
    [tiers]
  );

  const tier = useMemo(() => {
    if (tierProp) return tierProp;
    if (!sortedTiers.length) return null;
    const overrideId = (loyalty as any)?.override_tier_id;
    const currentId = loyalty?.current_tier_id;
    const byId = (id?: string | null) => (id ? sortedTiers.find((t) => t.id === id) : null);
    return byId(overrideId) ?? byId(currentId) ?? sortedTiers[0];
  }, [tierProp, loyalty, sortedTiers]);

  const nextTier = useMemo(() => {
    if (!tier) return null;
    return sortedTiers.find((t) => t.rank > tier.rank) ?? null;
  }, [tier, sortedTiers]);

  const progress = useMemo(() => {
    if (!nextTier || !loyalty) return null;
    const parts = METRIC_KEYS.map(([tKey, lKey]) => {
      const target = Number((nextTier as any)[tKey] ?? 0);
      if (target <= 0) return null;
      const current = Number((loyalty as any)[lKey as any] ?? 0);
      return Math.min(100, (current / target) * 100);
    }).filter((v): v is number => v !== null);
    if (!parts.length) return 100;
    return parts.reduce((s, v) => s + v, 0) / parts.length;
  }, [nextTier, loyalty]);

  if (!tier) return null;

  const Icon = (Icons as any)[tier.badge_icon] ?? Icons.Award;
  const dims =
    size === "sm" ? "h-6 px-2 text-[10px] gap-1" :
    size === "lg" ? "h-9 px-3.5 text-sm gap-1.5" :
    "h-7 px-2.5 text-xs gap-1";
  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

  const bg = tier.gradient_from && tier.gradient_to
    ? `linear-gradient(135deg, ${tier.gradient_from}, ${tier.gradient_to})`
    : tier.badge_color;

  const pctLabel = progress == null ? null : `${Math.round(progress)}%`;
  const ariaLabel = nextTier && pctLabel
    ? `EasyPay Club tier: ${tier.name}. ${pctLabel} progress toward ${nextTier.name}.`
    : `EasyPay Club tier: ${tier.name}. Top tier reached.`;

  const Wrapper: any = onClick ? "button" : "div";
  const interactive = !!onClick;

  const badge = (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full font-semibold text-white shadow-sm border border-white/25",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        dims,
        interactive && "active:scale-95 transition-transform cursor-pointer hover:brightness-110",
        className
      )}
      style={{ background: bg }}
    >
      <Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      {showName && <span className="truncate">{tier.name}</span>}
    </Wrapper>
  );

  if (disableTooltip) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="px-3 py-2 max-w-[220px]">
          <div className="flex items-center gap-2 mb-1">
            <Icon size={12} aria-hidden="true" style={{ color: tier.gradient_from ?? tier.badge_color }} />
            <span className="text-xs font-bold">{tier.name}</span>
          </div>
          {nextTier ? (
            <>
              <p className="text-[11px] text-muted-foreground mb-1.5">
                {pctLabel} toward <span className="font-semibold text-foreground">{nextTier.name}</span>
              </p>
              <div
                className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress ?? 0)}
                aria-label={`Progress toward ${nextTier.name}`}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress ?? 0}%`,
                    background: nextTier.gradient_from && nextTier.gradient_to
                      ? `linear-gradient(90deg, ${nextTier.gradient_from}, ${nextTier.gradient_to})`
                      : nextTier.badge_color,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">Top tier reached — enjoy every perk.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
