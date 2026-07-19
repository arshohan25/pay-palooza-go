import { forwardRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PushOptInPrompt from "@/components/PushOptInPrompt";
import AuthErrorOverlay from "@/components/AuthErrorOverlay";
import LoyaltyUpgradeReminder from "@/hooks/use-loyalty-upgrade-reminder";
import { activityTracker } from "@/lib/activityTracker";

const AppLayout = forwardRef<HTMLDivElement>((_, ref) => {
  const location = useLocation();

  useEffect(() => {
    activityTracker.enable();
  }, []);

  useEffect(() => {
    activityTracker.setRoute(location.pathname);
  }, [location.pathname]);

  return (
    <div ref={ref} className="contents">
      <Outlet />
      <PushOptInPrompt />
      <AuthErrorOverlay />
      <LoyaltyUpgradeReminder />
    </div>
  );
});

AppLayout.displayName = "AppLayout";

export default AppLayout;
