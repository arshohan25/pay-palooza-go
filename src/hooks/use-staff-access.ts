import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedSession } from "@/hooks/use-auth";

interface StaffAccess {
  staffId: string;
  merchantId: string;
  merchantName: string;
  staffRole: string;
  permissions: Record<string, boolean>;
}

// Module-level cache so re-mounts on the same session don't re-hit the RPC.
let _cachedAccess: StaffAccess | null | undefined; // undefined = not resolved yet
let _cachedForUserId: string | null = null;

export function useStaffAccess() {
  const [access, setAccess] = useState<StaffAccess | null>(_cachedAccess ?? null);
  const [resolved, setResolved] = useState<boolean>(_cachedAccess !== undefined);
  const [loading, setLoading] = useState<boolean>(_cachedAccess === undefined);
  const inflightRef = useRef(false);
  const didInitialFetchRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const runRpc = async (uid: string) => {
      const { data, error } = await supabase.rpc("get_staff_merchant_access", {
        p_user_id: uid,
      });
      if (error) return null;
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    };

    const fetch = async (uid: string | null) => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        if (!uid) {
          _cachedAccess = null;
          _cachedForUserId = null;
          if (!cancelled) {
            setAccess(null);
            setResolved(true);
            setLoading(false);
          }
          return;
        }

        // Serve from cache if same user already resolved.
        if (_cachedForUserId === uid && _cachedAccess !== undefined) {
          if (!cancelled) {
            setAccess(_cachedAccess);
            setResolved(true);
            setLoading(false);
          }
          return;
        }

        const row = await runRpc(uid);
        if (cancelled) return;
        const next: StaffAccess | null = row
          ? {
              staffId: row.staff_id as string,
              merchantId: row.merchant_id as string,
              merchantName: row.business_name as string,
              staffRole: row.staff_role as string,
              permissions: ((row as any).permissions ?? {}) as Record<string, boolean>,
            }
          : null;
        _cachedAccess = next;
        _cachedForUserId = uid;
        setAccess(next);
        setResolved(true);
        setLoading(false);
      } finally {
        inflightRef.current = false;
      }
    };

    // Kick off using cached session (no extra getSession round-trip if already resolved).
    (async () => {
      const session = await getCachedSession();
      didInitialFetchRef.current = true;
      void fetch(session?.user?.id ?? null);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip the noisy INITIAL_SESSION + TOKEN_REFRESHED that fire on every mount.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;

      if (event === "SIGNED_OUT") {
        _cachedAccess = null;
        _cachedForUserId = null;
        if (!cancelled) {
          setAccess(null);
          setResolved(true);
          setLoading(false);
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        const uid = session?.user?.id ?? null;
        // Only refetch if the user actually changed.
        if (uid !== _cachedForUserId) {
          _cachedAccess = undefined;
          if (!cancelled) {
            setResolved(false);
            setLoading(true);
          }
          setTimeout(() => { if (!cancelled) void fetch(uid); }, 0);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const permissions = access?.permissions ?? {};
  const can = (key: string) => {
    if (!access) return true; // owner / non-staff: full access
    if (key === "" ) return true;
    if (key === "__owner_only__") return false;
    return !!permissions[key];
  };

  return {
    staffId: access?.staffId ?? null,
    merchantId: access?.merchantId ?? null,
    merchantName: access?.merchantName ?? null,
    staffRole: access?.staffRole ?? null,
    permissions,
    can,
    isStaff: !!access,
    loading,
    resolved,
  };
}
