import { useMemo } from "react";
import { useGlobalToggles } from "@/hooks/use-global-toggles";

export const FUTURE_FEATURE_KEYS = [
  "future_ai_copilot",
  "future_scam_shield",
  "future_easypay_score",
  "future_compliance_center",
  "future_agent_liquidity_intel",
  "future_merchant_growth_os",
  "future_identity_wallet",
  "future_partner_qr_api",
  "future_predictive_loan_eligibility",
  "future_ai_fraud_investigator",
  "future_smart_rewards_engine",
  "future_bangla_voice_assistant",
  "future_open_finance_hub",
  "future_predictive_support",
  "future_dynamic_risk_limits",
] as const;

export type FutureFeatureKey = (typeof FUTURE_FEATURE_KEYS)[number];

export function useFutureFeatures() {
  const { isDisabled, isHidden, loading } = useGlobalToggles();

  return useMemo(() => {
    const visibility = FUTURE_FEATURE_KEYS.reduce<Record<FutureFeatureKey, "hidden" | "disabled" | "visible">>((acc, key) => {
      acc[key] = isHidden(key) ? "hidden" : isDisabled(key) ? "disabled" : "visible";
      return acc;
    }, {} as Record<FutureFeatureKey, "hidden" | "disabled" | "visible">);

    return {
      loading,
      visibility,
      isLive: (key: FutureFeatureKey) => visibility[key] === "visible",
      isPreview: (key: FutureFeatureKey) => visibility[key] === "disabled",
      isDormant: (key: FutureFeatureKey) => visibility[key] === "hidden",
    };
  }, [isDisabled, isHidden, loading]);
}