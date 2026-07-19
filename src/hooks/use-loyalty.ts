import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface LoyaltyTier {
  id: string;
  code: string;
  name: string;
  name_bn: string | null;
  rank: number;
  min_volume_30d: number;
  min_lifetime_txn_count: number;
  min_wallet_balance: number;
  min_addmoney_lifetime: number;
  min_savings_balance: number;
  min_combined_score: number;
  limit_multiplier: number;
  fee_discount_pct: number;
  cashback_bonus_pct: number;
  priority_support: boolean;
  badge_color: string;
  badge_icon: string;
  gradient_from: string | null;
  gradient_to: string | null;
  description: string | null;
  is_active: boolean;
}

export interface UserLoyalty {
  user_id: string;
  current_tier_id: string | null;
  override_tier_id: string | null;
  override_reason: string | null;
  override_until: string | null;
  score: number;
  volume_30d: number;
  lifetime_txn_count: number;
  wallet_balance: number;
  addmoney_lifetime: number;
  savings_balance: number;
  last_recalculated_at: string;
}

export function useLoyaltyTiers() {
  return useQuery({
    queryKey: ["loyalty-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_tiers" as any)
        .select("*")
        .order("rank", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LoyaltyTier[];
    },
    staleTime: 60_000,
  });
}

export function useMyLoyalty() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-loyalty", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Trigger a recompute so metrics stay fresh
      await supabase.rpc("recalculate_user_loyalty" as any, { _user_id: user!.id });
      const { data, error } = await supabase
        .from("user_loyalty" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as UserLoyalty | null;
    },
    staleTime: 30_000,
  });
}
