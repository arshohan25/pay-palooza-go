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
  onClick?: () => void;
}


/**
 * Displays the user's current EasyPay Club tier as a gradient badge.
 */
export default function LoyaltyBadge({
  size = "md",
  showName = true,
  className,
  tier: tierProp,
  onClick,
}: LoyaltyBadgeProps) {
  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty } = useMyLoyalty();

  const tier = useMemo(() => {
    if (tierProp) return tierProp;
    if (!tiers || tiers.length === 0) return null;
    const activeTiers = tiers.filter((t) => t.is_active);
    const pool = activeTiers.length ? activeTiers : tiers;
    // Prefer override, then current tier, then fallback to lowest-rank (Starter)
    const overrideId = (loyalty as any)?.override_tier_id;
    const currentId = loyalty?.current_tier_id;
    const byId = (id?: string | null) => (id ? pool.find((t) => t.id === id) : null);
    const fallback = [...pool].sort((a, b) => a.rank - b.rank)[0] ?? null;
    return byId(overrideId) ?? byId(currentId) ?? fallback;
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

  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full font-semibold text-white shadow-sm border border-white/20",
        dims,
        onClick && "active:scale-95 transition-transform cursor-pointer",
        className
      )}
      style={{ background: bg }}
      title={tier.description ?? tier.name}
    >
      <Icon size={iconSize} className="shrink-0" />
      {showName && <span className="truncate">{tier.name}</span>}
    </Wrapper>
  );
}
