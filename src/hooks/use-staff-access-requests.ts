import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RequestStatus = "pending" | "granted" | "denied" | "cancelled" | "revoked";
export type RequestablePermissionKey = "payouts" | "store_settings" | "settlements";

export interface StaffAccessRequest {
  id: string;
  merchant_id: string;
  staff_id: string;
  requested_by: string;
  permission_key: RequestablePermissionKey;
  display_label: string;
  note: string | null;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  deny_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Map a UI tile name to the underlying permission key. */
export const TILE_TO_PERMISSION: Record<string, RequestablePermissionKey> = {
  "Send Money": "payouts",
  "Cash Out": "payouts",
  "Bank Transfer": "payouts",
  "Payouts": "payouts",
  "Add Bank": "store_settings",
  "Store Settings": "store_settings",
  "Settlement": "settlements",
  "Settlements": "settlements",
};

export function useStaffAccessRequests(merchantId: string | null | undefined) {
  const [requests, setRequests] = useState<StaffAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!merchantId) { setRequests([]); setLoading(false); return; }
    const { data } = await supabase
      .from("merchant_staff_permission_requests")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    setRequests((data || []) as StaffAccessRequest[]);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => {
    fetchAll();
    if (!merchantId) return;
    const ch = supabase
      .channel(`staff_perm_req_${merchantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_staff_permission_requests", filter: `merchant_id=eq.${merchantId}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, fetchAll]);

  const pending = requests.filter(r => r.status === "pending");
  const history = requests.filter(r => r.status !== "pending");

  const grant = async (id: string) => {
    const { error } = await supabase
      .from("merchant_staff_permission_requests")
      .update({ status: "granted" })
      .eq("id", id);
    return { error };
  };

  const deny = async (id: string, reason?: string) => {
    const { error } = await supabase
      .from("merchant_staff_permission_requests")
      .update({ status: "denied", deny_reason: reason ?? null })
      .eq("id", id);
    return { error };
  };

  const revoke = async (params: { staffId: string; permissionKey: RequestablePermissionKey; displayLabel: string }) => {
    if (!merchantId) return { error: new Error("No merchant") };
    // Insert a record then immediately mark it revoked so the trigger flips the permission off.
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error: insErr } = await supabase
      .from("merchant_staff_permission_requests")
      .insert({
        merchant_id: merchantId,
        staff_id: params.staffId,
        requested_by: user?.id ?? "00000000-0000-0000-0000-000000000000",
        permission_key: params.permissionKey,
        display_label: params.displayLabel,
        status: "pending",
        note: "Owner-initiated revoke",
      })
      .select()
      .single();
    if (insErr) {
      // Likely a unique-pending conflict — fall through and just flip the perm directly via update on existing pending row.
      const { data: existing } = await supabase
        .from("merchant_staff_permission_requests")
        .select("id")
        .eq("merchant_id", merchantId)
        .eq("staff_id", params.staffId)
        .eq("permission_key", params.permissionKey)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("merchant_staff_permission_requests")
          .update({ status: "revoked" })
          .eq("id", existing.id);
        return { error };
      }
      return { error: insErr };
    }
    const { error } = await supabase
      .from("merchant_staff_permission_requests")
      .update({ status: "revoked" })
      .eq("id", inserted!.id);
    return { error };
  };

  return { requests, pending, history, loading, grant, deny, revoke, refresh: fetchAll };
}

export function useMyStaffAccessRequests(staffId: string | null | undefined) {
  const [requests, setRequests] = useState<StaffAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!staffId) { setRequests([]); setLoading(false); return; }
    const { data } = await supabase
      .from("merchant_staff_permission_requests")
      .select("*")
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false });
    setRequests((data || []) as StaffAccessRequest[]);
    setLoading(false);
  }, [staffId]);

  useEffect(() => {
    fetchAll();
    if (!staffId) return;
    const ch = supabase
      .channel(`my_staff_perm_req_${staffId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_staff_permission_requests", filter: `staff_id=eq.${staffId}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [staffId, fetchAll]);

  const submit = async (params: {
    merchantId: string;
    permissionKey: RequestablePermissionKey;
    displayLabel: string;
    note?: string;
  }) => {
    if (!staffId) return { error: new Error("No staff") };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not signed in") };
    const { error } = await supabase
      .from("merchant_staff_permission_requests")
      .insert({
        merchant_id: params.merchantId,
        staff_id: staffId,
        requested_by: user.id,
        permission_key: params.permissionKey,
        display_label: params.displayLabel,
        note: params.note?.trim() || null,
        status: "pending",
      });
    return { error };
  };

  const cancel = async (id: string) => {
    const { error } = await supabase
      .from("merchant_staff_permission_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    return { error };
  };

  const pendingForKey = (key: RequestablePermissionKey) =>
    requests.find(r => r.permission_key === key && r.status === "pending") || null;

  return { requests, loading, submit, cancel, pendingForKey };
}
