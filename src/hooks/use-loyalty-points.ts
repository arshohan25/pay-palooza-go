import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLoyaltyTiers } from "@/hooks/use-loyalty";
import { useLoyaltyPerks } from "@/hooks/use-loyalty-perks";

/** ৳ value of one point (100 points = ৳10) — mirrors `redeem_loyalty_points`. */
export const POINT_VALUE_BDT = 0.1;
export const MIN_REDEEM_POINTS = 500;
export const REDEEM_STEP = 100;

export interface PointsBalance {
  points_balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
}

export interface PointLedgerRow {
  id: string;
  kind: string;
  points: number;
  balance_after: number;
  txn_type: string | null;
  amount: number | null;
  tier_code: string | null;
  description: string | null;
  created_at: string;
}

export interface PointRule {
  id: string;
  tier_id: string;
  txn_type: string;
  points_per_100: number;
  min_amount: number;
  is_active: boolean;
}

export function useMyPoints() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loyalty-points", user?.id],
    enabled: !!user?.id,
    staleTime: 15_000,
    queryFn: async (): Promise<PointsBalance> => {
      const { data, error } = await supabase
        .from("user_loyalty_points" as any)
        .select("points_balance, lifetime_earned, lifetime_redeemed")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const row = data as any;
      return {
        points_balance: Number(row?.points_balance ?? 0),
        lifetime_earned: Number(row?.lifetime_earned ?? 0),
        lifetime_redeemed: Number(row?.lifetime_redeemed ?? 0),
      };
    },
  });
}

export function useMyPointLedger(limit = 10) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loyalty-point-ledger", user?.id, limit],
    enabled: !!user?.id,
    staleTime: 15_000,
    queryFn: async (): Promise<PointLedgerRow[]> => {
      const { data, error } = await supabase
        .from("loyalty_point_ledger" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as PointLedgerRow[]).map((r) => ({
        ...r,
        points: Number(r.points),
        balance_after: Number(r.balance_after),
        amount: r.amount == null ? null : Number(r.amount),
      }));
    },
  });
}

export function usePointRules() {
  return useQuery({
    queryKey: ["loyalty-point-rules"],
    staleTime: 60_000,
    queryFn: async (): Promise<PointRule[]> => {
      const { data, error } = await supabase.from("loyalty_point_rules" as any).select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as PointRule[]).map((r) => ({
        ...r,
        points_per_100: Number(r.points_per_100),
        min_amount: Number(r.min_amount),
      }));
    },
  });
}

/** Earn rate for the user's effective tier, and the next tier's rate. */
export function useSendPointRates(txnType = "send") {
  const { data: rules } = usePointRules();
  const { data: tiers } = useLoyaltyTiers();
  const perks = useLoyaltyPerks();

  const sorted = (tiers ?? []).slice().sort((a, b) => a.rank - b.rank);
  const tier = perks.tier ?? sorted.find((t) => t.is_active) ?? null;
  const nextTier = tier ? sorted.find((t) => t.rank > tier.rank && t.is_active) ?? null : null;
  const rateFor = (tierId?: string | null) =>
    Number(rules?.find((r) => r.tier_id === tierId && r.txn_type === txnType)?.points_per_100 ?? 0);

  return { tier, nextTier, rate: rateFor(tier?.id), nextRate: rateFor(nextTier?.id) };
}

export function useRedeemPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (points: number) => {
      const { data, error } = await supabase.rpc("redeem_loyalty_points" as any, {
        _points: points,
      });
      if (error) throw error;
      const res = typeof data === "string" ? JSON.parse(data) : (data as any);
      return res as { points_redeemed: number; cash_credited: number; points_balance: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-points"] });
      qc.invalidateQueries({ queryKey: ["loyalty-point-ledger"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
