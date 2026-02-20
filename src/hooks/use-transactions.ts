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

export function useTransactions(limit?: number, refreshKey?: number) {
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

  useEffect(() => { fetch(); }, [fetch, refreshKey]);

  // Realtime subscription — auto-refetch on any change to user's transactions
  useEffect(() => {
    let userId: string | null = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
      if (!userId) return;

      const channel = supabase
        .channel("txn-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${userId}`,
          },
          () => { fetch(); }
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    setup().then((ch) => { channel = ch; });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { transactions, loading, refetch: fetch };
}
