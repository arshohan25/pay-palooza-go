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
        .in("role", ["admin","compliance","finance","support","operations","marketing","hr","audit","risk","developer","manager"]);

      setIsAdmin((data?.length ?? 0) > 0);
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
  const [profilesRes, txnRes, agentsRes, merchantsRes, alertsRes, referralsRes, rewardsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
    supabase.from("agents").select("id", { count: "exact", head: true }),
    supabase.from("merchants").select("id", { count: "exact", head: true }),
    supabase.from("fraud_alerts").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("referrals").select("id", { count: "exact", head: true }),
    supabase.from("referral_rewards").select("amount"),
  ]);

  const totalRewardsPaid = (rewardsRes.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    totalUsers: profilesRes.count ?? 0,
    totalTransactions: txnRes.count ?? 0,
    totalAgents: agentsRes.count ?? 0,
    totalMerchants: merchantsRes.count ?? 0,
    openAlerts: alertsRes.count ?? 0,
    totalReferrals: referralsRes.count ?? 0,
    totalRewardsPaid,
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
    .not("phone", "like", "staff-%")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Audit log: record admin viewing user list
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "view_all_profiles",
      entity_type: "user_list",
      entity_id: session.user.id,
      details: { count: data?.length ?? 0 },
    }).then(); // fire-and-forget
  }

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

export async function fetchAllReferrals(limit = 200) {
  const { data } = await supabase
    .from("referrals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchAllDeviceRegistrations(limit = 200) {
  const { data } = await supabase
    .from("device_registrations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function softDeleteUser(targetUserId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soft-delete-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to deactivate user");
  return result;
}

export async function reactivateUser(targetUserId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soft-delete-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ target_user_id: targetUserId, action: "reactivate" }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Failed to reactivate user");
  return result;
}

export async function bulkSuspendUsers(userIds: string[], currentStatuses: Record<string, string>) {
  const results = await Promise.allSettled(
    userIds.map(id => toggleUserStatus(id, currentStatuses[id] || "active"))
  );
  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  return { succeeded, failed };
}

export async function bulkDeleteUsers(userIds: string[], force = false) {
  const { data: { session } } = await supabase.auth.getSession();
  let succeeded = 0;
  let failed = 0;
  for (const userId of userIds) {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ target_user_id: userId, force }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      succeeded++;
    } catch {
      failed++;
    }
  }
  return { succeeded, failed };
}

export async function bulkSoftDeleteUsers(userIds: string[]) {
  const results = await Promise.allSettled(
    userIds.map(id => softDeleteUser(id))
  );
  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  return { succeeded, failed };
}

export function exportUsersCSV(users: any[]) {
  const headers = ["Name", "Phone", "Balance", "Status", "Created At"];
  const rows = users.map(u => [
    u.name || "",
    u.phone || "",
    u.balance?.toString() || "0",
    u.status || "active",
    u.created_at || "",
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchUserDetails(userId: string) {
  const [profileRes, rolesRes, kycRes, txnRes, overridesRes, globalLimitsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role, created_at").eq("user_id", userId),
    supabase.from("kyc_verifications").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("user_limit_overrides").select("*").eq("target_user_id", userId).eq("is_active", true),
    supabase.from("transaction_limits").select("*").eq("is_active", true),
  ]);

  // Audit log: record admin viewing user profile
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "view_user_profile",
      entity_type: "user",
      entity_id: userId,
      details: {
        viewed_user_name: profileRes.data?.name,
        viewed_user_phone: profileRes.data?.phone,
      },
    }).then(); // fire-and-forget
  }

  return {
    profile: profileRes.data,
    roles: rolesRes.data ?? [],
    kyc: kycRes.data,
    transactions: txnRes.data ?? [],
    limitOverrides: overridesRes.data ?? [],
    globalLimits: globalLimitsRes.data ?? [],
  };
}

export async function fetchDeletedUsers(limit = 100) {
  const { data } = await supabase
    .from("deleted_users")
    .select("id, user_id, name, phone, avatar_url, balance_at_deletion, deleted_by, deleted_at, deletion_reason, balance_recovered")
    .order("deleted_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchDeletedUserDetail(id: string) {
  const { data } = await supabase
    .from("deleted_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}
