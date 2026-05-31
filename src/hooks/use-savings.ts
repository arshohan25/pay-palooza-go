import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  target_amount: number;
  saved_amount: number;
  status: "active" | "completed" | "cancelled" | "withdrawn";
  created_at: string;
  withdrawn_at: string | null;
  withdrawn_amount: number | null;
}

export interface AutoSavePlan {
  id: string;
  user_id: string;
  goal_id: string;
  frequency: "daily" | "weekly" | "monthly";
  amount: number;
  is_active: boolean;
  settled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  ends_at: string | null;
  total_installments: number | null;
  total_paid: number | null;
  missed_count: number | null;
  strategy: string | null;
  created_at: string;
}

export interface MissedPayment {
  id: string;
  schedule_id: string;
  user_id: string;
  amount: number;
  due_date: string;
  repaid: boolean;
  repaid_at: string | null;
}

export interface GoldHolding {
  id: string;
  karat: "22k" | "24k";
  grams: number;
  avg_buy_price: number;
  current_price?: number | null;
  last_price_update?: string | null;
}

export interface StockHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  current_price?: number | null;
  last_price_update?: string | null;
}

/**
 * Unified savings data hook with realtime subscriptions on all six tables.
 * Zero-refresh: any insert/update/delete pushed by Postgres re-syncs locally.
 */
export function useSavings() {
  const { user } = useAuth();
  const uid = user?.id;

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [plans, setPlans] = useState<AutoSavePlan[]>([]);
  const [missed, setMissed] = useState<MissedPayment[]>([]);
  const [gold, setGold] = useState<GoldHolding[]>([]);
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!uid) {
      setGoals([]); setPlans([]); setMissed([]); setGold([]); setStocks([]); setLoading(false);
      return;
    }
    setLoading(true);
    const [g, p, m, gh, sh] = await Promise.all([
      supabase.from("savings_goals").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("savings_auto_save").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("dps_missed_payments").select("*").eq("user_id", uid).eq("repaid", false).order("due_date", { ascending: true }),
      supabase.from("gold_holdings").select("*").eq("user_id", uid),
      supabase.from("stock_holdings").select("*").eq("user_id", uid),
    ]);
    setGoals((g.data ?? []) as SavingsGoal[]);
    setPlans((p.data ?? []) as AutoSavePlan[]);
    setMissed((m.data ?? []) as MissedPayment[]);
    setGold((gh.data ?? []) as GoldHolding[]);
    setStocks((sh.data ?? []) as StockHolding[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!uid) return;
    const tables = [
      "savings_goals",
      "savings_auto_save",
      "savings_deposits",
      "dps_missed_payments",
      "gold_holdings",
      "stock_holdings",
    ];
    const channel = supabase.channel(`savings-rt-${uid}`);
    tables.forEach((t) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter: `user_id=eq.${uid}` },
        () => reload(),
      );
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, reload]);

  return { goals, plans, missed, gold, stocks, loading, reload };
}
