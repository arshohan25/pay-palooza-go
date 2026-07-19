import { useMemo } from "react";
import * as Icons from "lucide-react";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";
import { cn } from "@/lib/utils";

interface LoyaltyBadgeProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
  /** Pass a specific tier to render (skips fetching current user tier) */
  tier?: LoyaltyTier;
}

/**
 * Displays the user's current EasyPay Club tier as a gradient badge.
 */
export default function LoyaltyBadge({
  size = "md",
  showName = true,
  className,
  tier: tierProp,
}: LoyaltyBadgeProps) {
  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty } = useMyLoyalty();

  const tier = useMemo(() => {
    if (tierProp) return tierProp;
    if (!loyalty?.current_tier_id || !tiers) return null;
    return tiers.find((t) => t.id === loyalty.current_tier_id) ?? null;
  }, [tierProp, loyalty, tiers]);

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

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-semibold text-white shadow-sm border border-white/20",
        dims,
        className
      )}
      style={{ background: bg }}
      title={tier.description ?? tier.name}
    >
      <Icon size={iconSize} className="shrink-0" />
      {showName && <span className="truncate">{tier.name}</span>}
    </div>
  );
}
