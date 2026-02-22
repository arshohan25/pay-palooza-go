import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface FeatureLock {
  id: string;
  feature: string;
  reason: string | null;
  expires_at: string | null;
}

/**
 * Hook to check if the current user has any active feature locks.
 * Returns a function `isLocked(feature)` that checks if a specific feature is locked.
 */
export function useFeatureLocks() {
  const { user } = useAuth();
  const [locks, setLocks] = useState<FeatureLock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocks = useCallback(async () => {
    if (!user) { setLocks([]); setLoading(false); return; }
    const { data } = await supabase
      .from("feature_locks")
      .select("id, feature, reason, expires_at")
      .eq("target_user_id", user.id)
      .eq("is_active", true);
    setLocks((data as FeatureLock[] | null) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLocks();
  }, [fetchLocks]);

  // Realtime subscription for instant lock/unlock
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("feature-locks-" + user.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "feature_locks",
        filter: `target_user_id=eq.${user.id}`,
      }, () => {
        fetchLocks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchLocks]);

  const isLocked = useCallback(
    (feature: string): { locked: boolean; reason?: string | null; expiresAt?: string | null } => {
      const now = new Date();
      const activeLock = locks.find(l => {
        if (l.feature !== feature && l.feature !== "all_transactions") return false;
        // If feature is "all_transactions", it blocks all transaction features
        if (l.feature === "all_transactions" && ![
          "send_money", "cash_out", "cash_in", "add_money", "payment",
          "mobile_recharge", "pay_bill", "bank_transfer",
        ].includes(feature) && feature !== "all_transactions") return false;
        // Check expiry
        if (l.expires_at && new Date(l.expires_at) < now) return false;
        return true;
      });

      if (activeLock) {
        return { locked: true, reason: activeLock.reason, expiresAt: activeLock.expires_at };
      }
      return { locked: false };
    },
    [locks]
  );

  return { isLocked, locks, loading, refetch: fetchLocks };
}
