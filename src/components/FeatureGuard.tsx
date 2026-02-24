import { useEffect } from "react";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import { toast } from "sonner";

interface FeatureGuardProps {
  featureKey: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a flow modal — if the feature is globally disabled or locked for the user,
 * it auto-closes the modal and shows a toast. Renders children otherwise.
 */
const FeatureGuard = ({ featureKey, onClose, children }: FeatureGuardProps) => {
  const { isDisabled } = useGlobalToggles();
  const { isLocked } = useFeatureLocks();

  const globalOff = isDisabled(featureKey);
  const lockStatus = isLocked(featureKey);
  const blocked = globalOff || lockStatus.locked;

  useEffect(() => {
    if (blocked) {
      const reason = lockStatus.locked
        ? lockStatus.reason || "This feature is currently restricted for your account."
        : "This feature is currently unavailable.";
      toast.error(reason);
      onClose();
    }
  }, [blocked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (blocked) return null;
  return <>{children}</>;
};

export default FeatureGuard;
