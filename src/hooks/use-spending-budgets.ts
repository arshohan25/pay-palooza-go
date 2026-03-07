import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  is_recurring: boolean;
  last_reset_month: string | null;
}

export interface CategorySpending {
  [category: string]: number;
}

const CATEGORY_MAP: Record<string, string> = {
  send: "Send Money",
  cashout: "Cash Out",
  payment: "Payment",
  recharge: "Recharge",
  paybill: "Bill Pay",
};

export const BUDGET_CATEGORIES = Object.entries(CATEGORY_MAP).map(([key, label]) => ({ key, label }));

export function useSpendingBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spending, setSpending] = useState<CategorySpending>({});
  const [loading, setLoading] = useState(true);

  const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const fetchAll = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const uid = session.user.id;
    const month = currentMonth();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // Fetch budgets & spending in parallel
    const [budgetRes, txnRes] = await Promise.all([
      supabase.from("spending_budgets").select("*").eq("user_id", uid),
      supabase
        .from("transactions")
        .select("type, amount")
        .eq("user_id", uid)
        .eq("status", "completed")
        .gte("created_at", monthStart),
    ]);

    const rawBudgets = (budgetRes.data ?? []) as any[];

    // Auto-delete non-recurring budgets from previous months
    const toDelete: string[] = [];
    const kept: Budget[] = [];
    for (const b of rawBudgets) {
      if (!b.is_recurring && b.last_reset_month && b.last_reset_month !== month) {
        toDelete.push(b.id);
      } else {
        kept.push({
          id: b.id,
          category: b.category,
          monthly_limit: Number(b.monthly_limit),
          is_recurring: b.is_recurring ?? true,
          last_reset_month: b.last_reset_month,
        });
      }
    }
    if (toDelete.length) {
      await supabase.from("spending_budgets").delete().in("id", toDelete);
    }

    setBudgets(kept);

    // Aggregate spending by type
    const agg: CategorySpending = {};
    for (const t of txnRes.data ?? []) {
      agg[t.type] = (agg[t.type] || 0) + Number(t.amount);
    }
    setSpending(agg);
    setLoading(false);

    // Budget alert notifications
    const month = currentMonth();
    for (const b of kept) {
      const spent = agg[b.category] || 0;
      const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
      const thresholds = pct >= 100 ? [100, 80] : pct >= 80 ? [80] : [];

      for (const threshold of thresholds) {
        const key = `budget_alert_${b.category}_${threshold}_${month}`;
        if (sessionStorage.getItem(key)) continue;

        // Check if notification already exists this month
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", uid)
          .eq("category", "budget")
          .contains("metadata", { category: b.category, threshold, month })
          .limit(1);

        if (existing && existing.length > 0) {
          sessionStorage.setItem(key, "1");
          continue;
        }

        const label = CATEGORY_MAP[b.category] || b.category;
        const title = threshold >= 100 ? "Budget Exceeded" : "Budget Warning";
        const body = threshold >= 100
          ? `You've exceeded your ৳${b.monthly_limit.toLocaleString()} ${label} budget this month`
          : `You've used 80% of your ৳${b.monthly_limit.toLocaleString()} ${label} budget this month`;

        await supabase.from("notifications").insert({
          user_id: uid,
          title,
          body,
          category: "budget",
          metadata: { category: b.category, threshold, month },
        });
        sessionStorage.setItem(key, "1");
      }
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setBudget = async (category: string, monthlyLimit: number, isRecurring = true) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const uid = session.user.id;
    const month = currentMonth();

    const existing = budgets.find((b) => b.category === category);
    if (existing) {
      await supabase
        .from("spending_budgets")
        .update({ monthly_limit: monthlyLimit, is_recurring: isRecurring, last_reset_month: month } as any)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("spending_budgets")
        .insert({ user_id: uid, category, monthly_limit: monthlyLimit, is_recurring: isRecurring, last_reset_month: month } as any);
    }
    await fetchAll();
  };

  const toggleRecurring = async (id: string, value: boolean) => {
    await supabase.from("spending_budgets").update({ is_recurring: value } as any).eq("id", id);
    await fetchAll();
  };

  const removeBudget = async (id: string) => {
    await supabase.from("spending_budgets").delete().eq("id", id);
    await fetchAll();
  };

  return { budgets, spending, loading, setBudget, toggleRecurring, removeBudget, categoryLabel: (k: string) => CATEGORY_MAP[k] || k };
}
