import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export interface MerchantPlan {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  billing_interval: "daily" | "weekly" | "monthly" | "yearly";
  interval_count: number;
  trial_days: number;
  is_active: boolean;
  created_at: string;
}

export interface MerchantSubscription {
  id: string;
  plan_id: string;
  merchant_id: string;
  customer_id: string;
  status: "trialing" | "active" | "paused" | "past_due" | "cancelled";
  mandate_max_amount: number | null;
  next_charge_at: string;
  last_charge_at: string | null;
  charges_count: number;
  failed_count: number;
  created_at: string;
  merchant_plans?: Pick<MerchantPlan, "name" | "amount" | "currency" | "billing_interval" | "interval_count"> | null;
}

export interface SubscriptionCharge {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  status: "success" | "failed";
  failure_reason: string | null;
  charged_at: string;
}

export const INTERVAL_LABEL: Record<string, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

/** Merchant-side: manage plans and view subscribers. */
export function useMerchantPlans(merchantId?: string) {
  const [plans, setPlans] = useState<MerchantPlan[]>([]);
  const [subs, setSubs] = useState<MerchantSubscription[]>([]);
  const [charges, setCharges] = useState<SubscriptionCharge[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!merchantId) { setLoading(false); return; }
    const [p, s, c] = await Promise.all([
      supabase.from("merchant_plans" as any).select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      supabase.from("merchant_subscriptions" as any).select("*, merchant_plans(name,amount,currency,billing_interval,interval_count)").eq("merchant_id", merchantId).order("created_at", { ascending: false }),
      supabase.from("subscription_charges" as any).select("*").eq("merchant_id", merchantId).order("charged_at", { ascending: false }).limit(50),
    ]);
    setPlans(((p as any).data ?? []) as MerchantPlan[]);
    setSubs(((s as any).data ?? []) as MerchantSubscription[]);
    setCharges(((c as any).data ?? []) as SubscriptionCharge[]);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!merchantId) return;
    const ch = supabase
      .channel(`merchant-billing-${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_plans" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_subscriptions" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "subscription_charges" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, reload]);

  const savePlan = async (plan: Partial<MerchantPlan> & { name: string; amount: number }) => {
    if (!merchantId) return;
    const { error } = await supabase.from("merchant_plans" as any).upsert({ merchant_id: merchantId, ...plan } as any);
    if (error) { toast.error(error.message); throw error; }
    toast.success("Plan saved");
    await reload();
  };

  const togglePlan = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("merchant_plans" as any).update({ is_active } as any).eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    await reload();
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("merchant_plans" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    toast.success("Plan removed");
    await reload();
  };

  const mrr = subs
    .filter((s) => s.status === "active" || s.status === "trialing")
    .reduce((sum, s) => {
      const p = s.merchant_plans;
      if (!p) return sum;
      const perMonth =
        p.billing_interval === "daily" ? Number(p.amount) * 30 / p.interval_count :
        p.billing_interval === "weekly" ? Number(p.amount) * 4.33 / p.interval_count :
        p.billing_interval === "yearly" ? Number(p.amount) / (12 * p.interval_count) :
        Number(p.amount) / p.interval_count;
      return sum + perMonth;
    }, 0);

  return { plans, subs, charges, loading, savePlan, togglePlan, deletePlan, reload, mrr };
}

/** Customer-side: my subscriptions across all merchants. */
export function useMySubscriptions() {
  const { user } = useAuth();
  const uid = user?.id;
  const [subs, setSubs] = useState<MerchantSubscription[]>([]);
  const [charges, setCharges] = useState<SubscriptionCharge[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    const [s, c] = await Promise.all([
      supabase.from("merchant_subscriptions" as any).select("*, merchant_plans(name,amount,currency,billing_interval,interval_count)").eq("customer_id", uid).order("created_at", { ascending: false }),
      supabase.from("subscription_charges" as any).select("*").eq("customer_id", uid).order("charged_at", { ascending: false }).limit(50),
    ]);
    setSubs(((s as any).data ?? []) as MerchantSubscription[]);
    setCharges(((c as any).data ?? []) as SubscriptionCharge[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`my-subs-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_subscriptions" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "subscription_charges" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, reload]);

  const subscribe = async (planId: string, mandateMax?: number) => {
    const { data, error } = await supabase.rpc("subscribe_to_plan" as any, {
      p_plan_id: planId,
      p_mandate_max: mandateMax ?? null,
    });
    if (error) { toast.error(error.message); throw error; }
    toast.success("Subscription started");
    await reload();
    return data as string;
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc("cancel_subscription" as any, { p_subscription_id: id });
    if (error) { toast.error(error.message); throw error; }
    toast.success("Subscription cancelled");
    await reload();
  };

  return { subs, charges, loading, subscribe, cancel, reload };
}
