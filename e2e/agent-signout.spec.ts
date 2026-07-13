import { test, expect } from "@playwright/test";

/**
 * Verifies that signing out from the AgentMenuDrawer (or any signed-out
 * visit to an agent route while the PWA is bound to `?app=agent`) always
 * lands on `/login/agent` — never on the customer home page.
 *
 * Since a real signed-in agent session requires backend credentials that
 * aren't available in CI, we exercise the same code path the drawer uses:
 *   1. Bind the PWA to the agent role (localStorage `mfs_app_role`).
 *   2. Ensure no Supabase session is present (signed out).
 *   3. Compute the post-signout redirect exactly like `handleLogout` in
 *      `AgentMenuDrawer` does, then verify AppRoleEnforcer also lands on
 *      `/login/agent` for every agent-scoped route.
 */

const AGENT_ROUTES = ["/agent", "/agent/cash-in", "/agent/cash-out", "/agent/statement"];

test.describe("agent sign-out → /login/agent", () => {
  test.beforeEach(async ({ context }) => {
    // Clear any prior session/state so we truly start signed out.
    await context.clearCookies();
  });

  test("handleLogout redirect target resolves to /login/agent", async ({ page }) => {
    // Establish the localhost origin so localStorage writes land here.
    await page.goto("/login/agent");
    await page.evaluate(() => {
      localStorage.setItem("mfs_app_role", "agent");
    });

    // Reproduce the exact target computation from AgentMenuDrawer.handleLogout.
    const target = await page.evaluate(async () => {
      const { getBoundAppRole, getLoginPathForRole } = await import(
        "/src/lib/appRole.ts"
      );
      const appRole = getBoundAppRole();
      return appRole ? getLoginPathForRole(appRole) : "/login/agent";
    });

    expect(target).toBe("/login/agent");
  });

  for (const route of AGENT_ROUTES) {
    test(`signed-out visit to ${route} lands on /login/agent`, async ({ page }) => {
      await page.goto("/login/agent");
      await page.evaluate(() => {
        localStorage.setItem("mfs_app_role", "agent");
        // Wipe any Supabase auth token so the enforcer sees an unauthenticated user.
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
            localStorage.removeItem(k);
          }
        }
      });

      await page.goto(route);
      await page.waitForURL("**/login/agent", { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login\/agent$/);
      await expect(page.getByText(/EasyPay Agent/i).first()).toBeVisible();
    });
  }
});
