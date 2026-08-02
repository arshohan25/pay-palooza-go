import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoyaltyTiers, type LoyaltyTier } from "@/hooks/use-loyalty";
import { useLoyaltyPerks } from "@/hooks/use-loyalty-perks";

export type TierTxnKey =
  | "send" | "cashin" | "cashout" | "addmoney"
  | "payment" | "recharge" | "paybill" | "banktransfer";

export const TIER_TXN_KEYS: TierTxnKey[] = [
  "send", "cashin", "cashout", "addmoney", "payment", "recharge", "paybill", "banktransfer",
];

export interface TierLimitRow {
  id: string;
  tier_id: string;
  txn_type: string;
  period: "daily" | "monthly";
  max_amount: number;
  max_count: number;
}

export interface TierLimitConfig {
  dailyAmount: number;
  dailyCount: number;
  monthlyAmount: number;
  monthlyCount: number;
}

export type TierLimitMap = Partial<Record<TierTxnKey, TierLimitConfig>>;

/** Raw catalog of every tier × txn type × period limit (public program benefits). */
export function useLoyaltyTierLimits() {
  return useQuery({
    queryKey: ["loyalty-tier-limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_tier_limits" as any)
        .select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as TierLimitRow[]).map((r) => ({
        ...r,
        max_amount: Number(r.max_amount),
        max_count: Number(r.max_count),
      }));
    },
    staleTime: 60_000,
  });
}

/** Fold raw rows into a per-txn-type map for one tier. */
export function buildTierLimitMap(rows: TierLimitRow[] | undefined, tierId: string | null | undefined): TierLimitMap {
  if (!rows || !tierId) return {};
  const map: TierLimitMap = {};
  for (const r of rows) {
    if (r.tier_id !== tierId) continue;
    const key = r.txn_type as TierTxnKey;
    if (!TIER_TXN_KEYS.includes(key)) continue;
    const entry = (map[key] ??= { dailyAmount: 0, dailyCount: 0, monthlyAmount: 0, monthlyCount: 0 });
    if (r.period === "daily") {
      entry.dailyAmount = r.max_amount;
      entry.dailyCount = r.max_count;
    } else {
      entry.monthlyAmount = r.max_amount;
      entry.monthlyCount = r.max_count;
    }
  }
  return map;
}

export interface MyTierLimits {
  tier: LoyaltyTier | null;
  nextTier: LoyaltyTier | null;
  limits: TierLimitMap;
  nextLimits: TierLimitMap;
  /** Daily-amount uplift per txn type when moving to the next tier. */
  uplift: Partial<Record<TierTxnKey, number>>;
  isLoading: boolean;
}

/**
 * Limits attached to the user's *effective* loyalty tier, plus the next tier's
 * limits so the UI can show exactly what an upgrade unlocks.
 */
export function useMyTierLimits(): MyTierLimits {
  const { data: rows, isLoading } = useLoyaltyTierLimits();
  const { data: tiers } = useLoyaltyTiers();
  const perks = useLoyaltyPerks();

  return useMemo(() => {
    const sorted = (tiers ?? []).slice().sort((a, b) => a.rank - b.rank);
    const tier = perks.tier ?? sorted.find((t) => t.is_active) ?? null;
    const nextTier = tier ? sorted.find((t) => t.rank > tier.rank && t.is_active) ?? null : null;

    const limits = buildTierLimitMap(rows, tier?.id);
    const nextLimits = buildTierLimitMap(rows, nextTier?.id);

    const uplift: Partial<Record<TierTxnKey, number>> = {};
    for (const k of TIER_TXN_KEYS) {
      // Headline ladder is the MONTHLY ceiling (৳150k → ৳400k for Send Money),
      // so tier uplift is advertised on the monthly allowance.
      const cur = limits[k]?.monthlyAmount ?? 0;
      const nxt = nextLimits[k]?.monthlyAmount ?? 0;
      if (nxt > cur) uplift[k] = nxt - cur;
    }

    return { tier, nextTier, limits, nextLimits, uplift, isLoading };
  }, [rows, tiers, perks.tier, isLoading]);
}
