import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface FeatureLock {
  id: string;
  feature: string;
  reason: string | null;
  expires_at: string | null;
}

let featureLocksChannel: ReturnType<typeof supabase.channel> | null = null;
let featureLocksChannelUserId: string | null = null;
let featureLocksSubscribers = 0;

async function fetchLocks(userId?: string) {
  if (!userId) return [] as FeatureLock[];

  const { data } = await supabase
    .from("feature_locks")
    .select("id, feature, reason, expires_at")
    .eq("target_user_id", userId)
    .eq("is_active", true);

  return (data as FeatureLock[] | null) ?? [];
}

export function useFeatureLocks() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["feature-locks", user?.id],
    queryFn: () => fetchLocks(user?.id),
    enabled: !!user && !authLoading,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user?.id) return;

    featureLocksSubscribers += 1;

    if (!featureLocksChannel || featureLocksChannelUserId !== user.id) {
      if (featureLocksChannel) {
        supabase.removeChannel(featureLocksChannel);
      }

      featureLocksChannelUserId = user.id;
      featureLocksChannel = supabase
        .channel(`feature-locks-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "feature_locks",
            filter: `target_user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["feature-locks", user.id] });
          }
        )
        .subscribe();
    }

    return () => {
      featureLocksSubscribers -= 1;
      if (featureLocksSubscribers <= 0 && featureLocksChannel) {
        supabase.removeChannel(featureLocksChannel);
        featureLocksChannel = null;
        featureLocksChannelUserId = null;
      }
    };
  }, [queryClient, user?.id]);

  const locks = query.data ?? [];

  const isLocked = useCallback(
    (feature: string): { locked: boolean; reason?: string | null; expiresAt?: string | null } => {
      const now = new Date();
      const activeLock = locks.find((lock) => {
        if (lock.feature !== feature && lock.feature !== "all_transactions") return false;
        if (
          lock.feature === "all_transactions" &&
          ![
            "send_money",
            "cash_out",
            "cash_in",
            "add_money",
            "payment",
            "mobile_recharge",
            "pay_bill",
            "bank_transfer",
          ].includes(feature) &&
          feature !== "all_transactions"
        ) {
          return false;
        }
        if (lock.expires_at && new Date(lock.expires_at) < now) return false;
        return true;
      });

      if (activeLock) {
        return {
          locked: true,
          reason: activeLock.reason,
          expiresAt: activeLock.expires_at,
        };
      }

      return { locked: false };
    },
    [locks]
  );

  return {
    isLocked,
    locks,
    loading: authLoading || (!!user && query.isLoading),
    refetch: () => query.refetch(),
  };
}
