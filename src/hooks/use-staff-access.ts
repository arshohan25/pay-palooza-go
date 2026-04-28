import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StaffAccess {
  merchantId: string;
  merchantName: string;
  staffRole: string;
}

export function useStaffAccess() {
  const [access, setAccess] = useState<StaffAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const inflightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const resolveUserId = async (): Promise<string | null> => {
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session?.user?.id) return sess.session.user.id;
      // Fallback: getUser() can succeed during the INITIAL_SESSION race
      // when getSession() momentarily returns null.
      const { data: u } = await supabase.auth.getUser();
      return u?.user?.id ?? null;
    };

    const runRpc = async (uid: string) => {
      const { data, error } = await supabase.rpc("get_staff_merchant_access", {
        p_user_id: uid,
      });
      if (error) {
        console.info("[useStaffAccess] RPC error", error.message);
        return null;
      }
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return row;
    };

    const fetch = async () => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        setLoading(true);
        const uid = await resolveUserId();
        if (!uid) {
          if (!cancelled) {
            setAccess(null);
            setResolved(true);
            setLoading(false);
          }
          return;
        }

        let row = await runRpc(uid);

        // Retry once if the first call returned no row — absorbs the brief
        // window where the JWT may not yet be attached to PostgREST requests.
        if (!row) {
          await new Promise((r) => setTimeout(r, 300));
          row = await runRpc(uid);
        }

        if (cancelled) return;
        if (row) {
          setAccess({
            merchantId: row.merchant_id,
            merchantName: row.business_name,
            staffRole: row.staff_role,
          });
        } else {
          setAccess(null);
        }
        setResolved(true);
        setLoading(false);
        console.info("[useStaffAccess] resolved", { uid, isStaff: !!row });
      } finally {
        inflightRef.current = false;
      }
    };

    fetch();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // NEVER await inside this callback (Supabase deadlock guidance).
      // Re-arm loading state then schedule the refetch on the next tick.
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        if (event === "SIGNED_OUT") {
          setAccess(null);
          setResolved(true);
          setLoading(false);
          return;
        }
        setResolved(false);
        setLoading(true);
        setTimeout(() => {
          if (!cancelled) void fetch();
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    merchantId: access?.merchantId ?? null,
    merchantName: access?.merchantName ?? null,
    staffRole: access?.staffRole ?? null,
    isStaff: !!access,
    loading,
    resolved,
  };
}
