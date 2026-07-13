import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  getBoundAppRole,
  isRoleAllowedForApp,
  computeAppRoleRedirect,
  getLoginPathForRole,
  APP_ROLE_LABEL,
} from "@/lib/appRole";

/**
 * Locks an installed role PWA to its role:
 *  - Any out-of-scope route (or wrong-role signed-in user) is redirected to
 *    the role's own login page.
 *  - A signed-in user without the required role is signed out with a toast.
 */
const AppRoleEnforcer = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const location = useLocation();
  const navigate = useNavigate();
  const kickedRef = useRef(false);

  useEffect(() => {
    let isStandalone = false;
    try {
      isStandalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        // @ts-expect-error legacy iOS
        window.navigator.standalone === true;
    } catch {}

    const target = computeAppRoleRedirect({
      path: location.pathname,
      appRole: getBoundAppRole(),
      isAuthenticated,
      rolesLoading,
      userRoles: (roles as string[]) ?? [],
      isStandalone,
    });
    if (target) navigate(target, { replace: true });
  }, [location.pathname, isAuthenticated, rolesLoading, roles, navigate]);

  // Role-matching: sign out users whose roles don't match the installed app.
  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated) {
      kickedRef.current = false;
      return;
    }
    const appRole = getBoundAppRole();
    if (!appRole || kickedRef.current) return;

    if (!isRoleAllowedForApp(appRole, roles as string[])) {
      kickedRef.current = true;
      toast.error(
        `This device is set up for ${APP_ROLE_LABEL[appRole]}. Please log in with a ${APP_ROLE_LABEL[appRole]} account.`
      );
      void signOut().then(() => {
        try {
          window.location.href = getLoginPathForRole(appRole);
        } catch {}
      });
    }
  }, [isAuthenticated, authLoading, rolesLoading, roles]);

  return null;
};

export default AppRoleEnforcer;
