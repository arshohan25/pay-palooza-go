import { useUserRoles } from "@/hooks/use-user-roles";
import { useStaffAccess } from "@/hooks/use-staff-access";
import { Navigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  roles: AppRole[];
  /** Also allow merchant staff access (for /merchant route) */
  allowStaff?: boolean;
  children: React.ReactNode;
}

/**
 * Route guard that redirects unauthorized users to home.
 * Renders children only if the user has at least one of the required roles,
 * or (when allowStaff is true) has an active staff link to a merchant.
 */
const RoleGuard = ({ roles, allowStaff = false, children }: RoleGuardProps) => {
  const { roles: userRoles, loading: rolesLoading } = useUserRoles();
  const { isStaff, loading: staffLoading } = useStaffAccess();

  const loading = rolesLoading || (allowStaff && staffLoading);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasRoleAccess = roles.some((r) => userRoles.includes(r));
  const hasStaffAccess = allowStaff && isStaff;

  if (!hasRoleAccess && !hasStaffAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
