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
import { logRoleRedirect, type RedirectReason } from "@/lib/roleRedirectLog";
import { supabase } from "@/integrations/supabase/client";

/**
 * Locks an installed role PWA to its role:
 *  - Any out-of-scope route (or wrong-role signed-in user) is redirected to
 *    the role's own login page.
 *  - A signed-in user without the required role is signed out with a toast.
 *  - Every unauthorized redirect is logged (client console + role_redirect_logs
 *    table) so admins can review misuse.
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

    const appRole = getBoundAppRole();
    const userRoles = (roles as string[]) ?? [];
    const target = computeAppRoleRedirect({
      path: location.pathname,
      appRole,
      isAuthenticated,
      rolesLoading,
      userRoles,
      isStandalone,
    });
    if (target) {
      if (appRole) {
        const reason: RedirectReason = !isAuthenticated
          ? "unauthenticated"
          : !isRoleAllowedForApp(appRole, userRoles)
            ? "role_mismatch"
            : "out_of_scope";
        // Fire-and-forget: fetch current user id for the log entry.
        void supabase.auth.getUser().then(({ data }) => {
          logRoleRedirect({
            attemptedAppRole: appRole,
            path: location.pathname,
            reason,
            isAuthenticated,
            userId: data.user?.id ?? null,
            userRoles,
          });
        });
      }
      navigate(target, { replace: true });
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
      void supabase.auth.getUser().then(({ data }) => {
        logRoleRedirect({
          attemptedAppRole: appRole,
          path: window.location.pathname,
          reason: "role_mismatch",
          isAuthenticated: true,
          userId: data.user?.id ?? null,
          userRoles: (roles as string[]) ?? [],
        });
      });
      void signOut().then(() => {
        try {
          window.location.href = getLoginPathForRole(appRole);
        } catch {}
      });
    }
  }, [isAuthenticated, authLoading, rolesLoading, roles]);

  // Customer-app scope guard: if a signed-in user holds an elevated role
  // (merchant / agent / distributor / super_distributor / admin) and is
  // browsing the customer surface, we do NOT silently redirect anymore —
  // the <ElevatedRoleBlockOverlay /> renders a clear, actionable message
  // instead. We still log the event for admin auditing.
  const loggedElevatedRef = useRef(false);
  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated) { loggedElevatedRef.current = false; return; }
    if (loggedElevatedRef.current) return;
    if (getBoundAppRole()) return;

    const path = location.pathname;
    const rolePortalPrefixes = [
      "/agent", "/merchant", "/admin",
      "/distributor", "/super-distributor", "/sd",
      "/install", "/staff", "/team",
    ];
    if (rolePortalPrefixes.some((p) => path === p || path.startsWith(`${p}/`))) return;

    const ELEVATED = ["agent", "merchant", "distributor", "super_distributor", "admin"] as const;
    const elevated = ((roles as string[]) ?? []).find((r) => (ELEVATED as readonly string[]).includes(r));
    if (!elevated) return;

    loggedElevatedRef.current = true;
    void supabase.auth.getUser().then(({ data }) => {
      logRoleRedirect({
        attemptedAppRole: null as any,
        path,
        reason: "role_mismatch",
        isAuthenticated: true,
        userId: data.user?.id ?? null,
        userRoles: (roles as string[]) ?? [],
      });
    });
  }, [isAuthenticated, authLoading, rolesLoading, roles, location.pathname]);



  return null;
};

export default AppRoleEnforcer;
