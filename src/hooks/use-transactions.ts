import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showTxnToast } from "@/components/TxnToast";
import { haptics } from "@/lib/haptics";

const TXN_LABELS: Record<string, string> = {
  send: "Send Money",
  receive: "Received",
  cashout: "Cash Out",
  cashin: "Cash In",
  banktransfer: "Bank Transfer",
  payment: "Payment",
  recharge: "Recharge",
  paybill: "Bill Pay",
  addmoney: "Add Money",
};

const TXN_GRADIENTS: Record<string, string> = {
  send: "bg-gradient-to-b from-pink-500 to-rose-500",
  receive: "bg-gradient-to-b from-emerald-500 to-green-500",
  cashout: "bg-gradient-to-b from-orange-500 to-amber-500",
  cashin: "bg-gradient-to-b from-emerald-500 to-green-500",
  banktransfer: "bg-gradient-to-b from-indigo-500 to-blue-600",
  payment: "bg-gradient-to-b from-purple-500 to-violet-500",
  recharge: "bg-gradient-to-b from-cyan-500 to-teal-500",
  paybill: "bg-gradient-to-b from-amber-500 to-yellow-500",
  addmoney: "bg-gradient-to-b from-blue-500 to-indigo-500",
};

export interface DbTransaction {
  id: string;
  type: "send" | "receive" | "cashout" | "cashin" | "banktransfer" | "payment" | "recharge" | "paybill" | "addmoney";
  amount: number;
  fee: number;
  commission: number;
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
  const knownIds = useRef(new Set<string>());
  const initialLoad = useRef(true);

  const fetchTxns = useCallback(async () => {
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
    const txns = (data as DbTransaction[]) ?? [];
    // Seed known IDs on first load so we don't toast existing transactions
    if (initialLoad.current) {
      txns.forEach((t) => knownIds.current.add(t.id));
      initialLoad.current = false;
    }
    setTransactions(txns);
    setLoading(false);
  }, [limit]);

  useEffect(() => { fetchTxns(); }, [fetchTxns, refreshKey]);

  // Realtime subscription — auto-refetch + toast on new inserts
  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const channel = supabase
        .channel("txn-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newTxn = payload.new as DbTransaction;
            // Only toast if we haven't seen this ID before
            if (!knownIds.current.has(newTxn.id)) {
              knownIds.current.add(newTxn.id);
              haptics.notify();
              showTxnToast({
                type: TXN_LABELS[newTxn.type] ?? newTxn.type,
                amount: `৳${newTxn.amount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`,
                gradient: TXN_GRADIENTS[newTxn.type] ?? "bg-gradient-to-b from-gray-500 to-gray-600",
              });
            }
            fetchTxns();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${userId}`,
          },
          () => { fetchTxns(); }
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    setup().then((ch) => { channel = ch; });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchTxns]);

  return { transactions, loading, refetch: fetchTxns };
}
