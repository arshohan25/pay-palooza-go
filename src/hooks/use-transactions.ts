import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbTransaction {
  id: string;
  type: "send" | "cashout" | "payment" | "recharge" | "paybill" | "addmoney";
  amount: number;
  fee: number;
  balance_after: number | null;
  recipient_phone: string | null;
  recipient_name: string | null;
  description: string | null;
  reference: string | null;
  status: "pending" | "completed" | "failed" | "reversed";
  created_at: string;
}

export function useTransactions(limit?: number) {
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (limit) query = query.limit(limit);

    const { data } = await query;
    setTransactions((data as DbTransaction[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { transactions, loading, refetch: fetch };
}
