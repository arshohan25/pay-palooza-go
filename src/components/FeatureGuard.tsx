import { useEffect } from "react";
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
 */
const FeatureGuard = ({ featureKey, onClose, children }: FeatureGuardProps) => {
  const { isDisabled } = useGlobalToggles();
  const { isLocked } = useFeatureLocks();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();

  const globalOff = isDisabled(featureKey);
  const lockStatus = isLocked(featureKey);
  const kycBlocked = !kycLoading && kycStatus !== "verified";
  const blocked = globalOff || lockStatus.locked || kycBlocked;

  useEffect(() => {
    if (kycLoading) return; // Wait for KYC status to load
    if (blocked) {
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
    }
  }, [blocked, kycLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (kycLoading) return null; // Don't render children while checking KYC
  if (blocked) return null;
  return <>{children}</>;
};

export default FeatureGuard;
