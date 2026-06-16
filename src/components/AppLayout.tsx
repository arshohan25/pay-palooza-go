import { forwardRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PushOptInPrompt from "@/components/PushOptInPrompt";
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
    </div>
  );
});

AppLayout.displayName = "AppLayout";

export default AppLayout;
