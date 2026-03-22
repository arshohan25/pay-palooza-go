import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureToggle {
  feature_key: string;
  is_enabled: boolean;
  label: string;
  visibility: string; // 'visible' | 'disabled' | 'hidden'
}

/**
 * Hook to read global feature toggles.
 * - `isDisabled(key)` – true when visibility is 'disabled' or legacy is_enabled=false
 * - `isHidden(key)` – true when visibility is 'hidden' (completely removed from UI)
 */
export function useGlobalToggles() {
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("global_feature_toggles")
      .select("feature_key, is_enabled, label, visibility");
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
      if (!toggle) return false;
      // disabled state = visibility 'disabled' OR legacy is_enabled=false
      return toggle.visibility === 'disabled' || toggle.visibility === 'hidden' || !toggle.is_enabled;
    },
    [toggles]
  );

  const isHidden = useCallback(
    (featureKey: string): boolean => {
      const toggle = toggles.find(t => t.feature_key === featureKey);
      if (!toggle) return false;
      return toggle.visibility === 'hidden';
    },
    [toggles]
  );

  return { isDisabled, isHidden, toggles, loading };
}
