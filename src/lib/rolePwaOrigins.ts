import { getLoginPathForRole, type AppRoleKey, type InstallableRoleKey } from "@/lib/appRole";

const SMARTSHOP_ROOT = "smartshop.bd";

const ROLE_SUBDOMAIN: Record<InstallableRoleKey, string> = {
  customer: "smartshop.bd",
  agent: "agent.smartshop.bd",
  merchant: "merchant.smartshop.bd",
  distributor: "dist.smartshop.bd",
  "super-distributor": "sd.smartshop.bd",
  admin: "admin.smartshop.bd",
};

const ROLE_MANIFEST: Record<InstallableRoleKey, string> = {
  customer: "/manifest.json",
  agent: "/manifest-agent.json",
  merchant: "/manifest-merchant.json",
  distributor: "/manifest-distributor.json",
  "super-distributor": "/manifest-super-distributor.json",
  admin: "/manifest-admin.json",
};

const ROLE_ROOT_MANIFEST: Record<InstallableRoleKey, string> = {
  customer: "/manifest.json",
  agent: "/manifest-agent-root.json",
  merchant: "/manifest-merchant-root.json",
  distributor: "/manifest-distributor-root.json",
  "super-distributor": "/manifest-super-distributor-root.json",
  admin: "/manifest-admin-root.json",
};

const HOST_LABEL_ROLE: Record<string, InstallableRoleKey> = {
  agent: "agent",
  merchant: "merchant",
  dist: "distributor",
  distributor: "distributor",
  sd: "super-distributor",
  "super-distributor": "super-distributor",
  admin: "admin",
};

const getCurrentHostname = () => (typeof window === "undefined" ? "" : window.location.hostname.toLowerCase());

export function getDedicatedRoleFromHostname(hostname = getCurrentHostname()): InstallableRoleKey | null {
  const normalized = hostname.toLowerCase();
  if (!normalized.endsWith(`.${SMARTSHOP_ROOT}`)) return null;
  const firstLabel = normalized.split(".")[0];
  return HOST_LABEL_ROLE[firstLabel] ?? null;
}

export function isDedicatedRoleOrigin(role: InstallableRoleKey, hostname = getCurrentHostname()): boolean {
  return getDedicatedRoleFromHostname(hostname) === role;
}

export function getManifestHrefForRole(role: InstallableRoleKey, hostname = getCurrentHostname()): string {
  return isDedicatedRoleOrigin(role, hostname) ? ROLE_ROOT_MANIFEST[role] : ROLE_MANIFEST[role];
}

export function getExpectedManifestScopeForRole(role: InstallableRoleKey, hostname = getCurrentHostname()): string {
  return isDedicatedRoleOrigin(role, hostname) ? "/" : `/${role}/`;
}

export function getRoleInstallUrl(role: InstallableRoleKey): string {
  if (typeof window === "undefined") return `https://${ROLE_SUBDOMAIN[role]}/${role}/install`;
  const { protocol, hostname, origin } = window.location;
  const normalized = hostname.toLowerCase();
  const isLocalOrPreview =
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("id-preview--") ||
    normalized.startsWith("preview--") ||
    normalized.endsWith(".lovableproject.com") ||
    normalized.endsWith(".lovableproject-dev.com") ||
    normalized.endsWith(".beta.lovable.dev");
  if (isLocalOrPreview) return `${origin}/${role}/install`;
  return `${protocol}//${ROLE_SUBDOMAIN[role]}/${role}/install`;
}

export function getRoleLoginUrl(role: InstallableRoleKey): string {
  if (role === "customer") {
    const installUrl = new URL(getRoleInstallUrl(role));
    installUrl.pathname = "/customer/";
    installUrl.search = "?app=customer";
    return installUrl.toString();
  }
  const installUrl = new URL(getRoleInstallUrl(role));
  installUrl.pathname = getLoginPathForRole(role as AppRoleKey);
  installUrl.search = `?app=${role}`;
  return installUrl.toString();
}
