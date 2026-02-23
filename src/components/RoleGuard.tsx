import { useUserRoles } from "@/hooks/use-user-roles";
import { Navigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  roles: AppRole[];
  children: React.ReactNode;
}

/**
 * Route guard that redirects unauthorized users to home.
 * Renders children only if the user has at least one of the required roles.
 */
const RoleGuard = ({ roles, children }: RoleGuardProps) => {
  const { roles: userRoles, loading } = useUserRoles();

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasAccess = roles.some((r) => userRoles.includes(r));

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
