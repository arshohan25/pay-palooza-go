import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies that each per-role install page:
 *   1. Exposes copy + share buttons for the /install/<role> and login URLs.
 *   2. Copy writes the correct URL to the clipboard.
 *   3. Opening the copied /login URL (with matching ?app=<role>) lands on
 *      that role's login page; opening the same URL without ?app also
 *      lands on the same login page (never the customer app).
 */

type RoleKey = "admin" | "agent" | "distributor" | "super-distributor" | "merchant";

const ROLES: { role: RoleKey; loginPath: string; heading: RegExp }[] = [
  { role: "admin", loginPath: "/login/admin", heading: /EasyPay Admin/i },
  { role: "agent", loginPath: "/login/agent", heading: /EasyPay Agent/i },
  { role: "distributor", loginPath: "/login/distributor", heading: /EasyPay Distributor/i },
  {
    role: "super-distributor",
    loginPath: "/login/super-distributor",
    heading: /EasyPay Super Distributor/i,
  },
  { role: "merchant", loginPath: "/merchant-login", heading: /Merchant/i },
];

async function grantClipboard(page: Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
}

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe("role install page — copy/share links", () => {
  for (const { role, loginPath, heading } of ROLES) {
    test(`${role}: copy install link → visiting it renders the correct install page`, async ({
      page,
    }) => {
      await grantClipboard(page);
      await page.goto(`/install/${role}`);
      await expect(page.getByTestId("share-links")).toBeVisible();

      await page.getByRole("button", { name: /Copy .* install page link/i }).click();
      const copied = await readClipboard(page);
      expect(copied).toContain(`/install/${role}`);

      await page.goto(copied.replace(/^https?:\/\/[^/]+/, ""));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(page.url()).toContain(`/install/${role}`);
    });

    test(`${role}: copied login link with ?app=${role} lands on the role login`, async ({
      page,
    }) => {
      await grantClipboard(page);
      await page.goto(`/install/${role}`);

      await page.getByRole("button", { name: /Copy .* login link/i }).click();
      const copied = await readClipboard(page);
      const rel = copied.replace(/^https?:\/\/[^/]+/, "");
      expect(rel).toContain(loginPath);
      expect(rel).toContain(`app=${role}`);

      await page.goto(rel);
      // AppRoleEnforcer must keep us on the login page (never customer app).
      await expect.poll(() => new URL(page.url()).pathname).toBe(loginPath);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    });

    test(`${role}: opening the login link WITHOUT ?app also stays on ${loginPath}`, async ({
      page,
    }) => {
      // No prior install visit → localStorage has no bound app role.
      await page.goto(loginPath);
      await expect.poll(() => new URL(page.url()).pathname).toBe(loginPath);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    });
  }
});
