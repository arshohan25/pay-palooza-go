import { test, expect } from "@playwright/test";

/**
 * Verifies that signing out from the AgentMenuDrawer (or any signed-out
 * visit to an agent route while the PWA is bound to `?app=agent`) always
 * lands on `/agent/login` — never on the customer home page.
 *
 * Since a real signed-in agent session requires backend credentials that
 * aren't available in CI, we exercise the same code path the drawer uses:
 *   1. Bind the PWA to the agent role (localStorage `mfs_app_role`).
 *   2. Ensure no Supabase session is present (signed out).
 *   3. Compute the post-signout redirect exactly like `handleLogout` in
 *      `AgentMenuDrawer` does, then verify AppRoleEnforcer also lands on
 *      `/agent/login` for every agent-scoped route.
 */

const AGENT_ROUTES = ["/agent", "/agent/cashin", "/agent/cashout", "/agent/statement"];

test.describe("agent sign-out → /agent/login", () => {
  test.beforeEach(async ({ context }) => {
    // Clear any prior session/state so we truly start signed out.
    await context.clearCookies();
  });

  test("handleLogout redirect target resolves to /agent/login", async ({ page }) => {
    // Establish the localhost origin so localStorage writes land here.
    await page.goto("/agent/login");
    await page.evaluate(() => {
      localStorage.setItem("mfs_app_role", "agent");
    });

    // Reproduce the exact target computation from AgentMenuDrawer.handleLogout.
    const target = await page.evaluate(async () => {
      const { getBoundAppRole, getLoginPathForRole } = await import(
        "/src/lib/appRole.ts"
      );
      const appRole = getBoundAppRole();
      return appRole ? getLoginPathForRole(appRole) : "/agent/login";
    });

    expect(target).toBe("/agent/login");
  });

  for (const route of AGENT_ROUTES) {
    test(`signed-out visit to ${route} lands on /agent/login`, async ({ page }) => {
      await page.goto("/agent/login");
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
      await page.waitForURL("**/agent/login", { timeout: 10_000 });
      await expect(page).toHaveURL(/\/agent\/login$/);
      await expect(page.getByText(/EasyPay Agent/i).first()).toBeVisible();
    });
  }
});
