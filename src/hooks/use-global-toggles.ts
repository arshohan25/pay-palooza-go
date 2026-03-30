import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface FeatureToggle {
  feature_key: string;
  is_enabled: boolean;
  label: string;
  visibility: string; // 'visible' | 'disabled' | 'hidden'
}

interface FeatureOverride {
  feature_key: string;
  visibility: string;
  user_id: string | null;
  group_type: string | null;
  group_value: string | null;
}

/**
 * Hook to read global feature toggles + per-user/group overrides.
 * Resolution order: user-specific override → group override → global toggle
 */
export function useGlobalToggles() {
  const { user } = useAuth();
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [overrides, setOverrides] = useState<FeatureOverride[]>([]);
  const [userBadge, setUserBadge] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadToggles = useCallback(async () => {
    const { data } = await supabase
      .from("global_feature_toggles")
      .select("feature_key, is_enabled, label, visibility");
    setToggles((data as FeatureToggle[] | null) ?? []);
  }, []);

  const loadOverrides = useCallback(async () => {
    if (!user) { setOverrides([]); setUserBadge(null); return; }

    // Fetch user-specific + group overrides (RLS allows user_id = own or NULL)
    const { data } = await supabase
      .from("user_feature_overrides")
      .select("feature_key, visibility, user_id, group_type, group_value");
    setOverrides((data as FeatureOverride[] | null) ?? []);

    // Fetch usage badge via RPC
    const { data: badge } = await supabase.rpc("get_user_usage_badge", { p_user_id: user.id });
    setUserBadge(badge as string | null);
  }, [user]);

  const load = useCallback(async () => {
    await Promise.all([loadToggles(), loadOverrides()]);
    setLoading(false);
  }, [loadToggles, loadOverrides]);

  useEffect(() => { load(); }, [load]);

  // Realtime for global toggles
  useEffect(() => {
    const ch = supabase
      .channel("global-toggles-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "global_feature_toggles" }, () => loadToggles())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadToggles]);

  // Realtime for overrides
  useEffect(() => {
    const ch = supabase
      .channel("user-feature-overrides")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_feature_overrides" }, () => loadOverrides())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadOverrides]);

  /**
   * Resolve effective visibility for a feature key.
   * Priority: user-specific override → usage_badge group → role group → global toggle
   */
  const resolveVisibility = useCallback(
    (featureKey: string): string => {
      // 1. User-specific override
      const userOverride = overrides.find(
        (o) => o.feature_key === featureKey && o.user_id != null
      );
      if (userOverride) return userOverride.visibility;

      // 2. Usage badge group override
      if (userBadge) {
        const badgeOverride = overrides.find(
          (o) =>
            o.feature_key === featureKey &&
            o.user_id == null &&
            o.group_type === "usage_badge" &&
            o.group_value === userBadge
        );
        if (badgeOverride) return badgeOverride.visibility;
      }

      // 3. Role group override (check all role overrides - if any match user's roles)
      // Role overrides are already filtered by RLS to group rows (user_id IS NULL)
      const roleOverride = overrides.find(
        (o) =>
          o.feature_key === featureKey &&
          o.user_id == null &&
          o.group_type === "role"
      );
      if (roleOverride) return roleOverride.visibility;

      // 4. Global toggle
      const toggle = toggles.find((t) => t.feature_key === featureKey);
      if (!toggle) return "visible";
      return toggle.visibility || (toggle.is_enabled ? "visible" : "disabled");
    },
    [toggles, overrides, userBadge]
  );

  const isDisabled = useCallback(
    (featureKey: string): boolean => {
      const vis = resolveVisibility(featureKey);
      return vis === "disabled" || vis === "hidden";
    },
    [resolveVisibility]
  );

  const isHidden = useCallback(
    (featureKey: string): boolean => {
      return resolveVisibility(featureKey) === "hidden";
    },
    [resolveVisibility]
  );

  return { isDisabled, isHidden, toggles, loading, userBadge };
}
