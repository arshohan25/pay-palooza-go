import { forwardRef } from "react";
import { Outlet } from "react-router-dom";

const AppLayout = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="contents">
    <Outlet />
  </div>
));

AppLayout.displayName = "AppLayout";

export default AppLayout;
