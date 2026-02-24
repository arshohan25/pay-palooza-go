import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureToggle {
  feature_key: string;
  is_enabled: boolean;
}

/**
 * Hook to read global feature toggles.
 * Returns `isDisabled(featureKey)` – true when an admin has turned the feature OFF.
 */
export function useGlobalToggles() {
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("global_feature_toggles")
      .select("feature_key, is_enabled");
    setToggles((data as FeatureToggle[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("global-toggles-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "global_feature_toggles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const isDisabled = useCallback(
    (featureKey: string): boolean => {
      const toggle = toggles.find(t => t.feature_key === featureKey);
      if (!toggle) return false; // feature not in toggles table → allowed
      return !toggle.is_enabled;
    },
    [toggles]
  );

  return { isDisabled, toggles, loading };
}
