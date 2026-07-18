// Binds an installed PWA to a specific role. When the manifest's start_url
// carries `?app=<role>`, we persist it and later enforce that only users with
// a matching role can remain signed in on that installed app.

export type AppRoleKey =
  | "admin"
  | "agent"
  | "merchant"
  | "distributor"
  | "super-distributor";

export type InstallableRoleKey = "customer" | AppRoleKey;

const STORAGE_KEY = "mfs_app_role";
const SESSION_STORAGE_KEY = "mfs_active_app_role";
export const INSTALLABLE_ROLE_KEYS: readonly InstallableRoleKey[] = [
  "customer",
  "admin",
  "agent",
  "merchant",
  "distributor",
  "super-distributor",
] as const;

export const APP_ROLE_ALLOWED: Record<AppRoleKey, string[]> = {
  admin: [
    "admin",
    "compliance",
    "finance",
    "support",
    "operations",
    "marketing",
    "hr",
    "audit",
    "risk",
    "developer",
    "manager",
  ],
  agent: ["agent", "admin"],
  merchant: ["merchant", "admin"],
  distributor: ["distributor", "admin"],
  "super-distributor": ["super_distributor", "admin"],
};

export const APP_ROLE_LABEL: Record<AppRoleKey, string> = {
  admin: "EasyPay Admin",
  agent: "EasyPay Agent",
  merchant: "EasyPay Merchant",
  distributor: "EasyPay Distributor",
  "super-distributor": "EasyPay Super Distributor",
};

export const APP_ROLE_HOME: Record<AppRoleKey, string> = {
  admin: "/admin",
  agent: "/agent",
  merchant: "/merchant",
  distributor: "/distributor",
  "super-distributor": "/super-distributor",
};

const isValid = (v: string | null): v is AppRoleKey =>
  !!v && v in APP_ROLE_ALLOWED;

const isInstallable = (v: string | null): v is InstallableRoleKey =>
  !!v && (INSTALLABLE_ROLE_KEYS as readonly string[]).includes(v);

const HOST_LABEL_ROLE: Record<string, AppRoleKey> = {
  admin: "admin",
  agent: "agent",
  merchant: "merchant",
  dist: "distributor",
  distributor: "distributor",
  sd: "super-distributor",
  "super-distributor": "super-distributor",
};

const getAppRoleFromHostname = (hostname: string): AppRoleKey | null => {
  const normalized = hostname.toLowerCase();
  if (!normalized.endsWith(".smartshop.bd")) return null;
  const firstLabel = normalized.split(".")[0];
  return HOST_LABEL_ROLE[firstLabel] ?? null;
};

export function isInstallRoute(path: string): boolean {
  return (
    path === "/install" ||
    path.startsWith("/install/") ||
    INSTALLABLE_ROLE_KEYS.some((role) => path === `/${role}/install` || path.startsWith(`/${role}/install/`))
  );
}

export function isCustomerScopeRoute(path: string): boolean {
  return path === "/customer" || path.startsWith("/customer/");
}

/** Capture `?app=` from current URL (if any) and persist it. */
export function captureAppRoleFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const hostRole = getAppRoleFromHostname(window.location.hostname);
    if (hostRole) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, hostRole);
      localStorage.setItem(STORAGE_KEY, hostRole);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const app = params.get("app");
    if (app === "customer") {
      sessionStorage.setItem(SESSION_STORAGE_KEY, app);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (isValid(app)) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, app);
      localStorage.setItem(STORAGE_KEY, app);
    }
  } catch {}
}

/** Currently bound app role, if any. */
export function getBoundAppRole(): AppRoleKey | null {
  if (typeof window === "undefined") return null;
  try {
    const sessionValue = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionValue === "customer") return null;
    if (isValid(sessionValue)) return sessionValue;
    const v = localStorage.getItem(STORAGE_KEY);
    return isValid(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearBoundAppRole() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function isRoleAllowedForApp(
  appRole: AppRoleKey,
  userRoles: string[]
): boolean {
  const allowed = APP_ROLE_ALLOWED[appRole];
  return userRoles.some((r) => allowed.includes(r));
}

export function getInstallPathForRole(role: InstallableRoleKey): string {
  return `/${role}/install`;
}

export function getLaunchPathForRole(role: InstallableRoleKey): string {
  return role === "customer" ? "/customer/" : APP_ROLE_HOME[role];
}

/** In-scope login path per installed role app. Legacy `/login/:role` routes remain supported. */
export function getLoginPathForRole(appRole: AppRoleKey): string {
  return `/${appRole}/login`;
}

export interface EnforcerInput {
  path: string;
  appRole: AppRoleKey | null;
  isAuthenticated: boolean;
  rolesLoading: boolean;
  userRoles: string[];
  isStandalone: boolean;
}

/**
 * Pure redirect decision for AppRoleEnforcer. Returns the target path to
 * navigate to, or null when the current path is already correct.
 */
export function computeAppRoleRedirect(input: EnforcerInput): string | null {
  const { path, appRole, isAuthenticated, rolesLoading, userRoles, isStandalone } = input;

  // Installer pages must always stay reachable. If one role PWA is already
  // installed, its stored role binding must not capture/redirect another
  // role's installer link.
  if (isInstallRoute(path)) return null;

  // No bound app role: only intervene if launched from an installed PWA
  // that lost its role context.
  if (!appRole) {
    const isRoleScopedEntry = Object.keys(APP_ROLE_ALLOWED).some(
      (role) => path === `/${role}/install` || path === `/${role}/login`,
    );
    if (isStandalone && !path.startsWith("/install") && !path.startsWith("/login/") && !isRoleScopedEntry && !isCustomerScopeRoute(path) && path !== "/merchant-login") {
      return "/install";
    }
    return null;
  }

  const home = APP_ROLE_HOME[appRole];
  const loginPath = getLoginPathForRole(appRole);

  const allowedPrefixes = [
    home,
    loginPath,
    `/${appRole}/install`,
    `/login/${appRole}`,
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

  const rolesMismatch =
    isAuthenticated && !rolesLoading && !isRoleAllowedForApp(appRole, userRoles);

  if (!inScope || rolesMismatch) {
    const target = rolesMismatch || !isAuthenticated ? loginPath : home;
    if (path !== target) return target;
  }
  return null;
}
