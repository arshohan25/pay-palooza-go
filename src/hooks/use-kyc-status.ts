import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type KycStatus = "none" | "pending" | "verified" | "rejected";

/**
 * Fetches the current user's KYC verification status.
 * Returns "none" if no KYC record exists.
 */
export function useKycStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<KycStatus>("none");
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus("none");
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("kyc_verifications")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const s = data.status as string;
      if (s === "verified" || s === "pending" || s === "rejected") {
        setStatus(s);
      } else {
        setStatus("pending");
      }
    } else {
      setStatus("none");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime: listen for KYC status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("kyc-status-" + user.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "kyc_verifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchStatus();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchStatus]);

  return { status, loading, refetch: fetchStatus };
}
