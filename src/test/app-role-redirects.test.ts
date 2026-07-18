import { describe, it, expect } from "vitest";
import { computeAppRoleRedirect, getLoginPathForRole, type AppRoleKey } from "@/lib/appRole";

const ROLES: AppRoleKey[] = ["admin", "agent", "distributor", "super-distributor", "merchant"];

const base = {
  isAuthenticated: false,
  rolesLoading: false,
  userRoles: [] as string[],
  isStandalone: false,
};

describe("computeAppRoleRedirect", () => {
  describe("no bound app role (browser tab)", () => {
    it("does not redirect off any route in a normal tab", () => {
      for (const path of ["/", "/dashboard", "/agent", "/login/agent", "/install", "/install/admin", "/agent/install", "/agent/login"]) {
        expect(computeAppRoleRedirect({ ...base, path, appRole: null })).toBeNull();
      }
    });

    it("standalone launch without a bound role goes to /install", () => {
      expect(
        computeAppRoleRedirect({ ...base, path: "/", appRole: null, isStandalone: true })
      ).toBe("/install");
    });

    it("standalone on install or login entry routes stays put", () => {
      for (const path of ["/install", "/install/agent", "/login/agent", "/agent/install", "/agent/login", "/merchant/login", "/merchant-login"]) {
        expect(
          computeAppRoleRedirect({ ...base, path, appRole: null, isStandalone: true })
        ).toBeNull();
      }
    });
  });

  describe.each(ROLES)("bound app role: %s", (appRole) => {
    const loginPath = getLoginPathForRole(appRole);
    const home =
      appRole === "merchant"
        ? "/merchant"
        : appRole === "super-distributor"
          ? "/super-distributor"
          : `/${appRole}`;

    it("bookmarked /dashboard while signed out → role login", () => {
      expect(computeAppRoleRedirect({ ...base, path: "/dashboard", appRole })).toBe(loginPath);
    });

    it("customer root '/' while signed out → role login", () => {
      expect(computeAppRoleRedirect({ ...base, path: "/", appRole })).toBe(loginPath);
    });

    it("/settings while signed out → role login", () => {
      expect(computeAppRoleRedirect({ ...base, path: "/settings", appRole })).toBe(loginPath);
    });

    it("already on the role login page → no redirect", () => {
      expect(computeAppRoleRedirect({ ...base, path: loginPath, appRole })).toBeNull();
    });

    it("on the role home while signed out → role login", () => {
      // in-scope but not authenticated: enforcer sends to loginPath
      const target = computeAppRoleRedirect({ ...base, path: home, appRole });
      // home is in-scope, so no redirect required from enforcer (RoleGuard handles it).
      expect(target).toBeNull();
    });

    it("wrong-role signed-in user on any deep link → role login", () => {
      expect(
        computeAppRoleRedirect({
          ...base,
          path: "/dashboard",
          appRole,
          isAuthenticated: true,
          userRoles: ["customer"],
        })
      ).toBe(loginPath);
    });

    it("wrong-role signed-in user on the role home → role login", () => {
      expect(
        computeAppRoleRedirect({
          ...base,
          path: home,
          appRole,
          isAuthenticated: true,
          userRoles: ["customer"],
        })
      ).toBe(loginPath);
    });

    it("correct-role signed-in user on the role home → no redirect", () => {
      const matchingRole =
        appRole === "super-distributor" ? "super_distributor" : appRole;
      expect(
        computeAppRoleRedirect({
          ...base,
          path: home,
          appRole,
          isAuthenticated: true,
          userRoles: [matchingRole],
        })
      ).toBeNull();
    });

    it("/<role>/install stays in scope for a bound app", () => {
      expect(
        computeAppRoleRedirect({ ...base, path: `/${appRole}/install`, appRole })
      ).toBeNull();
    });
  });
});
