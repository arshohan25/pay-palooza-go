import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedSession } from "@/hooks/use-auth";
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

type SupportedTxnType = "send" | "receive" | "cashout" | "cashin" | "banktransfer" | "payment" | "recharge" | "paybill" | "addmoney";
type RawTxnType = SupportedTxnType | "deposit";

interface TransactionQueryOptions {
  from?: string;
  to?: string;
}

export interface DbTransaction {
  id: string;
  short_id: string;
  type: SupportedTxnType;
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

interface RawDbTransaction extends Omit<DbTransaction, "type"> {
  type: RawTxnType;
}

const INVESTMENT_FIX_DEPLOYED_AT = Date.parse("2026-04-16T07:14:45Z");

function normalizeTransaction(tx: RawDbTransaction): DbTransaction {
  const description = tx.description ?? "";
  const reference = tx.reference ?? "";
  const createdAt = Date.parse(tx.created_at);
  const isLegacyRow = Number.isFinite(createdAt) && createdAt < INVESTMENT_FIX_DEPLOYED_AT;

  const isInvestmentBuy =
    description.startsWith("Gold Purchase:") ||
    description.startsWith("Stock Purchase:") ||
    reference.startsWith("GOLD-BUY-") ||
    reference.startsWith("STOCK-BUY-");

  const isInvestmentSell =
    description.startsWith("Gold Sale:") ||
    description.startsWith("Stock Sale:") ||
    reference.startsWith("GOLD-SELL-") ||
    reference.startsWith("STOCK-SELL-");

  let amount = Number(tx.amount) || 0;

  if ((Number(tx.fee) || 0) > 0 && isLegacyRow && isInvestmentBuy) {
    amount = Math.max(0, amount - (Number(tx.fee) || 0));
  }

  if ((Number(tx.fee) || 0) > 0 && isLegacyRow && isInvestmentSell) {
    amount = amount + (Number(tx.fee) || 0);
  }

  return {
    ...tx,
    amount,
    type: tx.type === "deposit" ? "addmoney" : tx.type,
  };
}

export function useTransactions(limit?: number, refreshKey?: number, options: TransactionQueryOptions = {}) {
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const knownIds = useRef(new Set<string>());
  const initialLoad = useRef(true);
  const { from, to } = options;

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    const session = await getCachedSession();
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

    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
    if (limit) query = query.limit(limit);

    const { data } = await query;
    const txns = ((data as RawDbTransaction[]) ?? []).map(normalizeTransaction);

    if (initialLoad.current) {
      txns.forEach((t) => knownIds.current.add(t.id));
      initialLoad.current = false;
    }

    setTransactions(txns);
    setLoading(false);
  }, [limit, from, to]);

  useEffect(() => {
    fetchTxns();
  }, [fetchTxns, refreshKey]);

  useEffect(() => {
    const setup = async () => {
      const session = await getCachedSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const channel = supabase
        .channel(`txn-realtime-${userId}-${limit ?? "all"}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newTxn = normalizeTransaction(payload.new as RawDbTransaction);
            if (!knownIds.current.has(newTxn.id)) {
              knownIds.current.add(newTxn.id);
              haptics.notify();
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
          () => {
            fetchTxns();
          }
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    setup().then((ch) => {
      channel = ch;
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchTxns]);

  return { transactions, loading, refetch: fetchTxns };
}
