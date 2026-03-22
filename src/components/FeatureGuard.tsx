import { useEffect, useRef } from "react";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { toast } from "sonner";

interface FeatureGuardProps {
  featureKey: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a flow modal — if the feature is globally disabled, locked for the user,
 * or user hasn't completed KYC, it auto-closes the modal and shows a toast.
 *
 * Once the guard has resolved and allowed, it keeps children mounted even during
 * background KYC revalidation to prevent active flows from being unmounted.
 */
const FeatureGuard = ({ featureKey, onClose, children }: FeatureGuardProps) => {
  const { isDisabled, isHidden } = useGlobalToggles();
  const { isLocked } = useFeatureLocks();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const hasResolved = useRef(false);

  const globalOff = isDisabled(featureKey);
  const globalHidden = isHidden(featureKey);
  const lockStatus = isLocked(featureKey);
  // Only evaluate KYC block when loading is complete
  const kycBlocked = !kycLoading && kycStatus !== "verified";
  const blocked = !kycLoading && (globalOff || globalHidden || lockStatus.locked || kycBlocked);

  useEffect(() => {
    if (kycLoading) return; // Wait for KYC + auth to fully resolve

    if (blocked) {
      // If the guard already resolved and allowed, don't close during background refresh
      if (hasResolved.current) return;

      let reason: string;
      if (lockStatus.locked) {
        reason = lockStatus.reason || "This feature is currently restricted for your account.";
      } else if (globalOff) {
        reason = "This feature is currently unavailable.";
      } else if (kycStatus === "none") {
        reason = "Please complete KYC verification to use this feature.";
      } else if (kycStatus === "pending") {
        reason = "Your KYC verification is under review. Please wait for approval.";
      } else if (kycStatus === "rejected") {
        reason = "Your KYC was rejected. Please resubmit your verification.";
      } else {
        reason = "Please complete KYC verification first.";
      }
      toast.error(reason);
      onClose();
    } else {
      // Guard resolved and user is allowed — mark so we don't unmount later
      hasResolved.current = true;
    }
  }, [blocked, kycLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // On initial load, wait for KYC check — but once resolved, never return null again
  if (kycLoading && !hasResolved.current) return null;
  if (blocked && !hasResolved.current) return null;
  return <>{children}</>;
};

export default FeatureGuard;
