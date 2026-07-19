import { Outlet } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardLayoutProps {
  roles: AppRole[];
  allowStaff?: boolean;
  unauthenticatedRedirect?: string;
  unauthorizedRedirect?: string;
  /** Optional CSS class applied to a wrapper around the outlet — used to scope role-specific theme tokens. */
  themeClass?: string;
}

const RoleGuardLayout = ({
  roles,
  allowStaff,
  unauthenticatedRedirect,
  unauthorizedRedirect,
  themeClass,
}: RoleGuardLayoutProps) => (
  <RoleGuard
    roles={roles}
    allowStaff={allowStaff}
    unauthenticatedRedirect={unauthenticatedRedirect}
    unauthorizedRedirect={unauthorizedRedirect}
  >
    {themeClass ? (
      <div className={themeClass}>
        <Outlet />
      </div>
    ) : (
      <Outlet />
    )}
  </RoleGuard>
);

export default RoleGuardLayout;

