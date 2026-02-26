import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface UsageBucket {
  usedAmount: number;
  usedCount: number;
}

type TxnKey = "send" | "cashin" | "cashout" | "addmoney" | "payment" | "recharge" | "paybill" | "banktransfer";

export interface UsageStats {
  daily: Record<TxnKey, UsageBucket>;
  monthly: Record<TxnKey, UsageBucket>;
  loading: boolean;
}

const EMPTY: UsageBucket = { usedAmount: 0, usedCount: 0 };
const TXN_KEYS: TxnKey[] = ["send", "cashin", "cashout", "addmoney", "payment", "recharge", "paybill", "banktransfer"];

function emptyMap(): Record<TxnKey, UsageBucket> {
  return Object.fromEntries(TXN_KEYS.map(k => [k, { ...EMPTY }])) as Record<TxnKey, UsageBucket>;
}

export function useUsageStats(): UsageStats {
  const { user } = useAuth();
  const [daily, setDaily] = useState<Record<TxnKey, UsageBucket>>(emptyMap);
  const [monthly, setMonthly] = useState<Record<TxnKey, UsageBucket>>(emptyMap);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all completed transactions this month in one query
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

  useEffect(() => { fetch(); }, [fetch]);

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
      }, () => { fetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetch]);

  return { daily, monthly, loading };
}
