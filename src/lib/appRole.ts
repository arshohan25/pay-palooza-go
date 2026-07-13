// Binds an installed PWA to a specific role. When the manifest's start_url
// carries `?app=<role>`, we persist it and later enforce that only users with
// a matching role can remain signed in on that installed app.

export type AppRoleKey =
  | "admin"
  | "agent"
  | "merchant"
  | "distributor"
  | "super-distributor";

const STORAGE_KEY = "mfs_app_role";

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

/** Capture `?app=` from current URL (if any) and persist it. */
export function captureAppRoleFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const app = params.get("app");
    if (isValid(app)) {
      localStorage.setItem(STORAGE_KEY, app);
    }
  } catch {}
}

/** Currently bound app role, if any. */
export function getBoundAppRole(): AppRoleKey | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isValid(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearBoundAppRole() {
  try {
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
