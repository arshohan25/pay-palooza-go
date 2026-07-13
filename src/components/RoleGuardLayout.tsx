import { Outlet } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardLayoutProps {
  roles: AppRole[];
  allowStaff?: boolean;
  unauthenticatedRedirect?: string;
  unauthorizedRedirect?: string;
}

const RoleGuardLayout = ({
  roles,
  allowStaff,
  unauthenticatedRedirect,
  unauthorizedRedirect,
}: RoleGuardLayoutProps) => (
  <RoleGuard
    roles={roles}
    allowStaff={allowStaff}
    unauthenticatedRedirect={unauthenticatedRedirect}
    unauthorizedRedirect={unauthorizedRedirect}
  >
    <Outlet />
  </RoleGuard>
);

export default RoleGuardLayout;
