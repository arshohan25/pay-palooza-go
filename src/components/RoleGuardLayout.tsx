import { Outlet } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardLayoutProps {
  roles: AppRole[];
  allowStaff?: boolean;
}

const RoleGuardLayout = ({ roles, allowStaff }: RoleGuardLayoutProps) => (
  <RoleGuard roles={roles} allowStaff={allowStaff}>
    <Outlet />
  </RoleGuard>
);

export default RoleGuardLayout;
