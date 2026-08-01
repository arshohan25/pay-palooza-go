import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface TxnLimitPeriodStatus {
  period: "daily" | "monthly";
  maxAmount: number;
  maxCount: number;
  source: string;
  tierCode: string | null;
  usedAmount: number;
  usedCount: number;
  remainingAmount: number | null;
  remainingCount: number | null;
}

export interface TxnLimitStatus {
  daily: TxnLimitPeriodStatus | null;
  monthly: TxnLimitPeriodStatus | null;
}

/**
 * Server-resolved limit status (limit, used, remaining) for a transaction type.
 * Mirrors the exact numbers the `enforce_txn_limit` guard uses at creation time,
 * so the UI can never disagree with the server.
 */
export function useTxnLimitStatus(txnType: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["txn-limit-status", txnType, user?.id],
    enabled: !!user?.id,
    staleTime: 20_000,
    queryFn: async (): Promise<TxnLimitStatus> => {
      const { data, error } = await supabase.rpc("get_txn_limit_status" as any, {
        _txn_type: txnType,
      });
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []) as any[];
      const map = (p: "daily" | "monthly"): TxnLimitPeriodStatus | null => {
        const r = rows.find((x) => x.period === p);
        if (!r) return null;
        return {
          period: p,
          maxAmount: Number(r.max_amount ?? 0),
          maxCount: Number(r.max_count ?? 0),
          source: String(r.source ?? "unknown"),
          tierCode: r.tier_code ?? null,
          usedAmount: Number(r.used_amount ?? 0),
          usedCount: Number(r.used_count ?? 0),
          remainingAmount: r.remaining_amount == null ? null : Number(r.remaining_amount),
          remainingCount: r.remaining_count == null ? null : Number(r.remaining_count),
        };
      };
      return { daily: map("daily"), monthly: map("monthly") };
    },
  });
}
