import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code: string;
  milestone_1_paid: boolean;
  milestone_2_paid: boolean;
  milestone_3_paid: boolean;
  total_rewarded: number;
  status: string;
  created_at: string;
  updated_at: string;
  referee_name?: string;
  referee_phone?: string;
}

export interface ReferralReward {
  id: string;
  referral_id: string;
  referrer_id: string;
  milestone: string;
  amount: number;
  created_at: string;
}

export function useReferrals() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [referralCode, setReferralCode] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch user's referral code from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("user_id", user.id)
      .single();

    if (profile?.referral_code) {
      setReferralCode(profile.referral_code);
    }

    // Fetch referrals where current user is the referrer
    const { data: refs } = await supabase
      .from("referrals" as any)
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    if (refs) {
      // Fetch referee names/phones
      const refereeIds = (refs as any[]).map((r: any) => r.referee_id);
      let profileMap: Record<string, { name: string | null; phone: string }> = {};
      
      if (refereeIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name, phone")
          .in("user_id", refereeIds);
        
        if (profiles) {
          profileMap = Object.fromEntries(
            profiles.map(p => [p.user_id, { name: p.name, phone: p.phone }])
          );
        }
      }

      setReferrals((refs as any[]).map((r: any) => ({
        ...r,
        referee_name: profileMap[r.referee_id]?.name || null,
        referee_phone: profileMap[r.referee_id]?.phone || null,
      })));
    }

    // Fetch rewards
    const { data: rews } = await supabase
      .from("referral_rewards" as any)
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    if (rews) setRewards(rews as any[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Real-time subscription for referrals
    const channel = supabase
      .channel("referral-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_rewards" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const totalEarned = referrals.reduce((s, r) => s + (r.total_rewarded || 0), 0);
  const completedCount = referrals.filter(r => r.status === "completed").length;
  const activeCount = referrals.filter(r => r.status === "active").length;

  return {
    referrals,
    rewards,
    referralCode,
    loading,
    totalEarned,
    completedCount,
    activeCount,
    refetch: fetchData,
  };
}
