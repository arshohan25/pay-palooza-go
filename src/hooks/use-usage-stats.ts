import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface UsageBucket {
  usedAmount: number;
  usedCount: number;
}

export type TxnKey = "send" | "cashin" | "cashout" | "addmoney" | "payment" | "recharge" | "paybill" | "banktransfer";

export interface LimitConfig {
  dailyAmount: number;
  dailyCount: number;
  monthlyAmount: number;
  monthlyCount: number;
}

export interface UsageStats {
  daily: Record<TxnKey, UsageBucket>;
  monthly: Record<TxnKey, UsageBucket>;
  limits: Record<TxnKey, LimitConfig>;
  loading: boolean;
}

const EMPTY: UsageBucket = { usedAmount: 0, usedCount: 0 };
const TXN_KEYS: TxnKey[] = ["send", "cashin", "cashout", "addmoney", "payment", "recharge", "paybill", "banktransfer"];

// Hardcoded fallback limits
const FALLBACK_LIMITS: Record<TxnKey, LimitConfig> = {
  send: { dailyAmount: 50000, dailyCount: 40, monthlyAmount: 400000, monthlyCount: 100 },
  cashin: { dailyAmount: 50000, dailyCount: 20, monthlyAmount: 300000, monthlyCount: 100 },
  cashout: { dailyAmount: 35000, dailyCount: 15, monthlyAmount: 300000, monthlyCount: 100 },
  addmoney: { dailyAmount: 50000, dailyCount: 20, monthlyAmount: 300000, monthlyCount: 50 },
  payment: { dailyAmount: 0, dailyCount: 0, monthlyAmount: 0, monthlyCount: 0 },
  recharge: { dailyAmount: 50000, dailyCount: 200, monthlyAmount: 300000, monthlyCount: 2000 },
  paybill: { dailyAmount: 0, dailyCount: 0, monthlyAmount: 0, monthlyCount: 0 },
  banktransfer: { dailyAmount: 50000, dailyCount: 40, monthlyAmount: 400000, monthlyCount: 100 },
};

function emptyMap(): Record<TxnKey, UsageBucket> {
  return Object.fromEntries(TXN_KEYS.map(k => [k, { ...EMPTY }])) as Record<TxnKey, UsageBucket>;
}

export function useUsageStats(): UsageStats {
  const { user } = useAuth();
  const [daily, setDaily] = useState<Record<TxnKey, UsageBucket>>(emptyMap);
  const [monthly, setMonthly] = useState<Record<TxnKey, UsageBucket>>(emptyMap);
  const [limits, setLimits] = useState<Record<TxnKey, LimitConfig>>({ ...FALLBACK_LIMITS });
  const [loading, setLoading] = useState(true);

  const fetchLimits = useCallback(async () => {
    if (!user) return;

    const result: Record<TxnKey, LimitConfig> = { ...FALLBACK_LIMITS };

    // Fetch global defaults
    const { data: globalLimits } = await supabase
      .from("transaction_limits" as any)
      .select("txn_type, period, max_amount, max_count")
      .eq("applies_to", "user")
      .eq("is_active", true);

    for (const row of (globalLimits as any[]) ?? []) {
      const key = row.txn_type as TxnKey;
      if (!TXN_KEYS.includes(key)) continue;
      if (row.period === "daily") {
        result[key].dailyAmount = Number(row.max_amount);
        result[key].dailyCount = Number(row.max_count);
      } else if (row.period === "monthly") {
        result[key].monthlyAmount = Number(row.max_amount);
        result[key].monthlyCount = Number(row.max_count);
      }
    }

    // Fetch user-specific overrides
    const { data: overrides } = await supabase
      .from("user_limit_overrides" as any)
      .select("txn_type, period, max_amount, max_count")
      .eq("target_user_id", user.id)
      .eq("is_active", true);

    for (const row of (overrides as any[]) ?? []) {
      const key = row.txn_type as TxnKey;
      if (!TXN_KEYS.includes(key)) continue;
      if (row.period === "daily") {
        if (row.max_amount != null) result[key].dailyAmount = Number(row.max_amount);
        if (row.max_count != null) result[key].dailyCount = Number(row.max_count);
      } else if (row.period === "monthly") {
        if (row.max_amount != null) result[key].monthlyAmount = Number(row.max_amount);
        if (row.max_count != null) result[key].monthlyCount = Number(row.max_count);
      }
    }

    setLimits(result);
  }, [user]);

  const fetchUsage = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data } = await supabase
      .from("transactions")
      .select("type, amount, created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("created_at", monthStart.toISOString());

    const d = emptyMap();
    const m = emptyMap();

    for (const txn of data ?? []) {
      const key = txn.type as TxnKey;
      if (!TXN_KEYS.includes(key)) continue;
      const amt = Number(txn.amount);
      const isToday = new Date(txn.created_at) >= todayStart;

      m[key].usedAmount += amt;
      m[key].usedCount += 1;

      if (isToday) {
        d[key].usedAmount += amt;
        d[key].usedCount += 1;
      }
    }

    setDaily(d);
    setMonthly(m);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLimits();
    fetchUsage();
  }, [fetchLimits, fetchUsage]);

  // Realtime: refresh on new transactions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("limits-usage-" + user.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchUsage(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUsage]);

  return { daily, monthly, limits, loading };
}
