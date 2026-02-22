import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
      setLoading(false);
    };

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isAdmin, loading };
}

/** Admin-only data fetching helpers */
export async function fetchAdminStats() {
  const [profilesRes, txnRes, agentsRes, merchantsRes, alertsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
    supabase.from("agents").select("id", { count: "exact", head: true }),
    supabase.from("merchants").select("id", { count: "exact", head: true }),
    supabase.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return {
    totalUsers: profilesRes.count ?? 0,
    totalTransactions: txnRes.count ?? 0,
    totalAgents: agentsRes.count ?? 0,
    totalMerchants: merchantsRes.count ?? 0,
    openAlerts: alertsRes.count ?? 0,
  };
}

export async function fetchRecentTransactions(limit = 20) {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchAllTransactions(limit = 200) {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchAllUsers(limit = 50) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchFraudAlerts(limit = 50) {
  const { data } = await supabase
    .from("fraud_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchAllAgents(limit = 100) {
  const { data } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchAllMerchants(limit = 100) {
  const { data } = await supabase
    .from("merchants")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function toggleUserStatus(userId: string, currentStatus: string) {
  const newStatus = currentStatus === "suspended" ? "active" : "suspended";
  const { error } = await supabase
    .from("profiles")
    .update({ status: newStatus })
    .eq("user_id", userId);
  if (error) throw error;
  return newStatus;
}

export async function toggleAgentStatus(agentId: string, currentStatus: string) {
  const newStatus = currentStatus === "suspended" ? "active" : "suspended";
  const { error } = await supabase
    .from("agents")
    .update({ status: newStatus as any })
    .eq("id", agentId);
  if (error) throw error;
  return newStatus;
}

export async function toggleMerchantStatus(merchantId: string, currentStatus: string) {
  const newStatus = currentStatus === "suspended" ? "active" : "suspended";
  const { error } = await supabase
    .from("merchants")
    .update({ status: newStatus as any })
    .eq("id", merchantId);
  if (error) throw error;
  return newStatus;
}
