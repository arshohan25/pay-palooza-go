import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface FeatureToggle {
  feature_key: string;
  is_enabled: boolean;
  label: string;
  visibility: string;
}

interface FeatureOverride {
  feature_key: string;
  visibility: string;
  user_id: string | null;
  group_type: string | null;
  group_value: string | null;
}

interface OverrideData {
  overrides: FeatureOverride[];
  userBadge: string | null;
}

let globalTogglesChannel: ReturnType<typeof supabase.channel> | null = null;
let userOverridesChannel: ReturnType<typeof supabase.channel> | null = null;
let toggleSubscribers = 0;

async function fetchGlobalToggles() {
  const { data } = await supabase
    .from("global_feature_toggles")
    .select("feature_key, is_enabled, label, visibility");

  return (data as FeatureToggle[] | null) ?? [];
}

async function fetchOverrideData(userId?: string): Promise<OverrideData> {
  if (!userId) {
    return { overrides: [], userBadge: null };
  }

  const [{ data: overrides }, { data: badge }] = await Promise.all([
    supabase
      .from("user_feature_overrides")
      .select("feature_key, visibility, user_id, group_type, group_value"),
    supabase.rpc("get_user_usage_badge", { p_user_id: userId }),
  ]);

  return {
    overrides: (overrides as FeatureOverride[] | null) ?? [],
    userBadge: (badge as string | null) ?? null,
  };
}

export function useGlobalToggles() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const togglesQuery = useQuery({
    queryKey: ["global-feature-toggles"],
    queryFn: fetchGlobalToggles,
    staleTime: 60_000,
  });

  const overridesQuery = useQuery({
    queryKey: ["user-feature-overrides", user?.id ?? null],
    queryFn: () => fetchOverrideData(user?.id),
    enabled: !authLoading,
    staleTime: 60_000,
  });

  useEffect(() => {
    toggleSubscribers += 1;

    if (!globalTogglesChannel) {
      globalTogglesChannel = supabase
        .channel("global-toggles-user")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "global_feature_toggles" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["global-feature-toggles"] });
          }
        )
        .subscribe();
    }

    if (!userOverridesChannel) {
      userOverridesChannel = supabase
        .channel("user-feature-overrides")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_feature_overrides" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["user-feature-overrides"] });
          }
        )
        .subscribe();
    }

    return () => {
      toggleSubscribers -= 1;
      if (toggleSubscribers <= 0) {
        if (globalTogglesChannel) {
          supabase.removeChannel(globalTogglesChannel);
          globalTogglesChannel = null;
        }
        if (userOverridesChannel) {
          supabase.removeChannel(userOverridesChannel);
          userOverridesChannel = null;
        }
      }
    };
  }, [queryClient]);

  const toggles = togglesQuery.data ?? [];
  const overrides = overridesQuery.data?.overrides ?? [];
  const userBadge = overridesQuery.data?.userBadge ?? null;

  const resolveVisibility = useCallback(
    (featureKey: string): string => {
      const userOverride = overrides.find(
        (override) => override.feature_key === featureKey && override.user_id != null
      );
      if (userOverride) return userOverride.visibility;

      if (userBadge) {
        const badgeOverride = overrides.find(
          (override) =>
            override.feature_key === featureKey &&
            override.user_id == null &&
            override.group_type === "usage_badge" &&
            override.group_value === userBadge
        );
        if (badgeOverride) return badgeOverride.visibility;
      }

      const roleOverride = overrides.find(
        (override) =>
          override.feature_key === featureKey &&
          override.user_id == null &&
          override.group_type === "role"
      );
      if (roleOverride) return roleOverride.visibility;

      const toggle = toggles.find((item) => item.feature_key === featureKey);
      if (!toggle) return "visible";
      return toggle.visibility || (toggle.is_enabled ? "visible" : "disabled");
    },
    [overrides, toggles, userBadge]
  );

  const isDisabled = useCallback(
    (featureKey: string): boolean => {
      const visibility = resolveVisibility(featureKey);
      return visibility === "disabled" || visibility === "hidden";
    },
    [resolveVisibility]
  );

  const isHidden = useCallback(
    (featureKey: string): boolean => resolveVisibility(featureKey) === "hidden",
    [resolveVisibility]
  );

  return {
    isDisabled,
    isHidden,
    toggles,
    loading:
      authLoading || togglesQuery.isLoading || (!authLoading && !!user && overridesQuery.isLoading),
    userBadge,
  };
}
