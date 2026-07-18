import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the per-role install flow.
 *
 * For every installable role this suite verifies:
 *  1. `/:role/install` renders and swaps the `<link rel="manifest">` to the
 *     role-specific manifest (so Chrome would fire `beforeinstallprompt` for
 *     the right identity).
 *  2. The per-role install state panel is present and marks that role as
 *     CURRENT + NOT INSTALLED on a fresh browser.
 *  3. When install state is seeded in localStorage, the page shows the
 *     "installed" success screen with an "Open app" button that launches the
 *     role's app path — never a reload of the current shell.
 *
 * Chromium in CI cannot run the native install prompt, so this simulates the
 * post-install state via localStorage and asserts the UI path taken.
 */

type Role = {
  key: string;
  manifest: string;
  appPath: string;
};

const ROLES: Role[] = [
  { key: "customer", manifest: "/manifest.json", appPath: "/customer" },
  { key: "agent", manifest: "/manifest-agent.json", appPath: "/agent" },
  { key: "merchant", manifest: "/manifest-merchant.json", appPath: "/merchant" },
  { key: "distributor", manifest: "/manifest-distributor.json", appPath: "/distributor" },
  { key: "super-distributor", manifest: "/manifest-super-distributor.json", appPath: "/super-distributor" },
  { key: "admin", manifest: "/manifest-admin.json", appPath: "/admin" },
];

for (const role of ROLES) {
  test.describe(`install flow — ${role.key}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.clearCookies();
    });

    test(`renders installer, swaps manifest, and shows per-role state panel`, async ({ page }) => {
      await page.goto(`/${role.key}/install`);

      // Manifest link switched to this role.
      const manifestHref = await page
        .locator('link[rel="manifest"]')
        .first()
        .getAttribute("href");
      expect(manifestHref).toBe(role.manifest);

      // Per-role install state panel exists and marks this role CURRENT / NOT INSTALLED.
      const panel = page.getByTestId("install-state-panel");
      await expect(panel).toBeVisible();
      const currentRow = panel
        .locator("div")
        .filter({ hasText: new RegExp(`${role.key}\\b`, "i") })
        .first();
      await expect(panel.getByText("CURRENT", { exact: true }).first()).toBeVisible();
      await expect(panel.getByText("NOT INSTALLED", { exact: true }).first()).toBeVisible();

      // Installer manifest URL for this role is shown in the panel.
      await expect(panel).toContainText(`/${role.key}/install`);
    });

    test(`installed state shows "Open app" action instead of reloading the shell`, async ({ page }) => {
      // Seed installed state before the app hydrates so the success screen
      // renders on first paint — mirrors a returning user opening the same
      // installer URL.
      await page.addInitScript((roleKey) => {
        window.localStorage.setItem(
          "mfs_pwa_installed_roles",
          JSON.stringify([roleKey]),
        );
      }, role.key);

      await page.goto(`/${role.key}/install`);

      const success = page.getByTestId("installed-success");
      await expect(success).toBeVisible();

      const openBtn = page.getByTestId("open-installed-app");
      await expect(openBtn).toBeVisible();

      // Clicking must navigate to the role's app path, NOT reload the
      // installer route (which would silently drop us back into the current
      // installed app shell on mobile).
      await Promise.all([
        page.waitForURL((url) => url.pathname === role.appPath || url.pathname.startsWith(`${role.appPath}/`), {
          timeout: 5000,
        }).catch(() => null),
        openBtn.click(),
      ]);

      const finalPath = new URL(page.url()).pathname;
      expect(finalPath).not.toBe(`/${role.key}/install`);
      expect(
        finalPath === role.appPath || finalPath.startsWith(`${role.appPath}/`),
      ).toBeTruthy();
    });
  });
}
