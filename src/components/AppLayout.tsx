import { forwardRef } from "react";
import { Outlet } from "react-router-dom";
import PushOptInPrompt from "@/components/PushOptInPrompt";

const AppLayout = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="contents">
    <Outlet />
    <PushOptInPrompt />
  </div>
));

AppLayout.displayName = "AppLayout";

export default AppLayout;
