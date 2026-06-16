import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/use-user-roles";

const ADMIN_ROLES = new Set([
  "admin", "compliance", "finance", "support", "operations",
  "marketing", "hr", "audit", "risk", "developer", "manager",
]);

/**
 * Admin-side role check. Delegates to the cached `useUserRoles` hook
 * (single source of truth) so it cannot diverge from <RoleGuard /> route guards.
 */
export function useAdmin() {
  const { roles, loading } = useUserRoles();
  const isAdmin = roles.some((r) => ADMIN_ROLES.has(r as string));
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

  const users = data ?? [];

  const userIds = users.map((u: any) => u.user_id);
  let kycMap: Record<string, string> = {};
  let uidMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: kycData } = await supabase
      .from("kyc_verifications")
      .select("user_id, status")
      .in("user_id", userIds);
    if (kycData) {
      kycMap = Object.fromEntries(kycData.map((k: any) => [k.user_id, k.status]));
    }
    // EasyPay UIDs are admin-only — fetched via SECURITY DEFINER RPC, never via direct column read.
    const { data: uidData } = await supabase.rpc("admin_get_easypay_uids" as any, { _user_ids: userIds });
    if (uidData) {
      uidMap = Object.fromEntries((uidData as any[]).map((u: any) => [u.user_id, u.easypay_uid]));
    }
  }

  const enriched = users.map((u: any) => ({
    ...u,
    easypay_uid: uidMap[u.user_id] ?? null,
    kyc_status: u.kyc_exempt ? "exempt" : (kycMap[u.user_id] || "not_started"),
  }));

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "view_all_profiles",
      entity_type: "user_list",
      entity_id: session.user.id,
      details: { count: enriched.length },
    }).then();
  }

  return enriched;
}

export async function fetchUserByEasypayUid(uid: string) {
  const { data, error } = await supabase.rpc("admin_get_user_by_easypay_uid" as any, { _uid: uid });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  // Audit also recorded server-side inside the RPC; mirror client-side for completeness
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "lookup_by_easypay_uid",
      entity_type: "user",
      entity_id: row?.user_id ?? null,
      details: { requested_uid: uid, found: !!row },
    }).then();
  }
  return row || null;
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
  const headers = ["Name", "Phone", "Balance", "KYC Status", "Status", "Created At"];
  const rows = users.map(u => [
    u.name || "",
    u.phone || "",
    u.balance?.toString() || "0",
    u.kyc_status || "not_started",
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
