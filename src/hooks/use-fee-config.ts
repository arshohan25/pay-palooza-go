import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeeRule {
  id: string;
  txn_type: string;
  fee_type: "flat" | "percentage";
  fee_value: number;
  min_amount: number | null;
  max_amount: number | null;
  agent_commission: number | null;
  is_active: boolean;
}

export interface FeeConfig {
  rules: FeeRule[];
  loading: boolean;
  calcFee: (txnType: string, amount: number) => number;
  calcCashOutFee: (amount: number) => number;
  calcBankTransferFee: (amount: number) => number;
  getFeeLabel: (txnType: string) => string;
  getAgentCommission: (txnType: string, amount: number) => number;
}

export function useFeeConfig(): FeeConfig {
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from("fee_config")
      .select("*")
      .eq("is_active", true)
      .order("txn_type")
      .order("min_amount");

    if (data) {
      setRules(data as FeeRule[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const findRule = useCallback((txnType: string, amount: number): FeeRule | null => {
    const matching = rules.filter(
      (r) => r.txn_type === txnType &&
        r.is_active &&
        (r.min_amount === null || amount >= r.min_amount) &&
        (r.max_amount === null || amount <= r.max_amount)
    );
    // Return the most specific rule (smallest range)
    return matching.sort((a, b) => (a.min_amount ?? 0) - (b.min_amount ?? 0)).pop() ?? null;
  }, [rules]);

  const calcFee = useCallback((txnType: string, amount: number): number => {
    if (amount <= 0) return 0;
    const rule = findRule(txnType, amount);
    if (!rule) return 0;
    if (rule.fee_type === "percentage") {
      return parseFloat((amount * rule.fee_value / 100).toFixed(2));
    }
    return rule.fee_value;
  }, [findRule]);

  const calcCashOutFee = useCallback((amount: number) => calcFee("cashout", amount), [calcFee]);
  const calcBankTransferFee = useCallback((amount: number) => calcFee("banktransfer", amount), [calcFee]);

  const getAgentCommission = useCallback((txnType: string, amount: number): number => {
    if (amount <= 0) return 0;
    const rule = findRule(txnType, amount);
    if (!rule || !rule.agent_commission) return 0;
    return parseFloat((amount * rule.agent_commission / 100).toFixed(2));
  }, [findRule]);

  const getFeeLabel = useCallback((txnType: string): string => {
    const typeRules = rules.filter((r) => r.txn_type === txnType && r.is_active);
    if (typeRules.length === 0) return "Free";

    // Check if all rules are free
    if (typeRules.every((r) => r.fee_value === 0)) return "Free";

    // Single percentage rule
    if (typeRules.length === 1) {
      const r = typeRules[0];
      if (r.fee_type === "percentage") return `${r.fee_value}%`;
      if (r.fee_value === 0) return "Free";
      return `৳${r.fee_value}`;
    }

    // Multiple tiers (like send money)
    const labels = typeRules
      .sort((a, b) => (a.min_amount ?? 0) - (b.min_amount ?? 0))
      .map((r) => {
        if (r.fee_value === 0) return `Free ≤৳${r.max_amount?.toLocaleString()}`;
        if (r.fee_type === "percentage") return `${r.fee_value}%`;
        const minLabel = r.min_amount && r.min_amount > 0 ? `>৳${Math.floor(r.min_amount).toLocaleString()}` : "";
        const maxLabel = r.max_amount ? `–৳${r.max_amount.toLocaleString()}` : "/txn";
        return `৳${r.fee_value} ${minLabel}${maxLabel}`;
      });

    return labels.join(", ");
  }, [rules]);

  return { rules, loading, calcFee, calcCashOutFee, calcBankTransferFee, getFeeLabel, getAgentCommission };
}
