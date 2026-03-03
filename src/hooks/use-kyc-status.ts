import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { toast } from "sonner";

export type KycStatus = "none" | "pending" | "verified" | "rejected";

export function useKycStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<KycStatus>("none");
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef<KycStatus | null>(null);

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

  // Detect pending → verified transition for celebration
  useEffect(() => {
    if (prevStatusRef.current === "pending" && status === "verified") {
      fireSuccessConfetti();
      haptics.success();
      toast.success("Your identity has been verified! All features are now unlocked. 🎉");
    }
    if (status !== "none" || prevStatusRef.current !== null) {
      prevStatusRef.current = status;
    }
  }, [status]);

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
