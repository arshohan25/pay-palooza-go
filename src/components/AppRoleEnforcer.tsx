import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  getBoundAppRole,
  isRoleAllowedForApp,
  APP_ROLE_LABEL,
} from "@/lib/appRole";

/**
 * When the PWA has been installed for a specific role (e.g. Agent app),
 * this component signs out any user whose roles don't match that app.
 * Users who don't have the required role simply cannot log in to another
 * role's installed app.
 */
const AppRoleEnforcer = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const kickedRef = useRef(false);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated) {
      kickedRef.current = false;
      return;
    }
    const appRole = getBoundAppRole();
    if (!appRole) return;
    if (kickedRef.current) return;

    // Wait until roles have actually loaded for this user
    if (roles.length === 0) {
      // Give the query one tick; if still empty, treat as no matching role.
    }

    if (!isRoleAllowedForApp(appRole, roles as string[])) {
      kickedRef.current = true;
      toast.error(
        `This device is set up for ${APP_ROLE_LABEL[appRole]}. Please log in with a ${APP_ROLE_LABEL[appRole]} account.`
      );
      void signOut().then(() => {
        try {
          window.location.href = "/";
        } catch {}
      });
    }
  }, [isAuthenticated, authLoading, rolesLoading, roles]);

  return null;
};

export default AppRoleEnforcer;
