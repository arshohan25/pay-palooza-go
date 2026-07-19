import { useMemo } from "react";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";

export interface LoyaltyPerks {
  tier: LoyaltyTier | null;
  limitMultiplier: number;
  feeDiscountPct: number;
  cashbackBonusPct: number;
  prioritySupport: boolean;
  isOverride: boolean;
  overrideUntil: string | null;
}

/**
 * Returns the perks of the user's *effective* loyalty tier (override if active
 * and not expired, else current_tier_id). All figures fall back to no-op values
 * so callers can multiply/subtract safely.
 */
export function useLoyaltyPerks(): LoyaltyPerks {
  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty } = useMyLoyalty();

  return useMemo<LoyaltyPerks>(() => {
    const overrideActive =
      !!loyalty?.override_tier_id &&
      (!loyalty.override_until || new Date(loyalty.override_until) > new Date());

    const effectiveId = overrideActive
      ? loyalty!.override_tier_id
      : loyalty?.current_tier_id ?? null;

    const tier = effectiveId ? tiers?.find((t) => t.id === effectiveId) ?? null : null;

    return {
      tier,
      limitMultiplier: tier?.limit_multiplier ?? 1,
      feeDiscountPct: tier?.fee_discount_pct ?? 0,
      cashbackBonusPct: tier?.cashback_bonus_pct ?? 0,
      prioritySupport: tier?.priority_support ?? false,
      isOverride: overrideActive,
      overrideUntil: loyalty?.override_until ?? null,
    };
  }, [tiers, loyalty]);
}
