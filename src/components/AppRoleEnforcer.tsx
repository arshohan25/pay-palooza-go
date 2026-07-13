import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  getBoundAppRole,
  isRoleAllowedForApp,
  APP_ROLE_LABEL,
  APP_ROLE_HOME,
} from "@/lib/appRole";

/**
 * Locks an installed role PWA to its role:
 *  - Any route outside the role's own scope (or the role's login/install pages)
 *    is redirected to `/login/<role>`.
 *  - A signed-in user without the required role is signed out with a toast.
 */
const AppRoleEnforcer = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const location = useLocation();
  const navigate = useNavigate();
  const kickedRef = useRef(false);

  // Route-scoping: keep the user inside the installed role's surface area.
  useEffect(() => {
    const appRole = getBoundAppRole();
    if (!appRole) return;

    const path = location.pathname;
    const home = APP_ROLE_HOME[appRole]; // e.g. "/agent"
    const loginPath = `/login/${appRole}`;

    const allowedPrefixes = [
      home,
      loginPath,
      "/install",
      "/forgot-pin",
      "/.lovable",
      "/payment-popup",
      "/payment-return",
      "/addmoney/status",
      "/r/",
      "/merchant-login",
      "/merchant-manager-login",
      "/team-login",
    ];

    const inScope = allowedPrefixes.some(
      (p) => path === p || path.startsWith(p + "/") || path.startsWith(p)
    );

    // If signed-in user is bounced to home ("/") by a guard's unauthorizedRedirect,
    // AND their roles don't match this app, funnel them to /login/<role> instead
    // of the customer app.
    const rolesMismatch =
      isAuthenticated &&
      !rolesLoading &&
      !isRoleAllowedForApp(appRole, roles as string[]);

    if (!inScope || rolesMismatch) {
      const target = rolesMismatch || !isAuthenticated ? loginPath : home;
      if (path !== target) navigate(target, { replace: true });
    }
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
          window.location.href = `/login/${appRole}`;
        } catch {}
      });
    }
  }, [isAuthenticated, authLoading, rolesLoading, roles]);

  return null;
};

export default AppRoleEnforcer;
