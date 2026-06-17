import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface AiReward {
  id: string;
  reward_type: string;
  title: string;
  description: string;
  details: any;
  status: string;
  segment: string;
  expires_at: string;
  claimed_at: string | null;
  created_at: string;
}

export function useAiRewards(rewardType?: string) {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<AiReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetch = async () => {
      let query = supabase
        .from("ai_auto_rewards")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10);

      if (rewardType) query = query.eq("reward_type", rewardType);

      const { data } = await query;
      if (data) setRewards(data as any);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel(`ai-rewards-${user.id}-${rewardType || "all"}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ai_auto_rewards",
        filter: `user_id=eq.${user.id}`,
      }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, rewardType]);

  const claimReward = async (id: string) => {
    const { error } = await supabase
      .from("ai_auto_rewards")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setRewards(prev => prev.filter(r => r.id !== id));
    }
    return !error;
  };

  return { rewards, loading, claimReward };
}
