import { test, expect, type Page } from "@playwright/test";

/**
 * For every /<role>/install entry, verify:
 *   1. The manifest <link> is swapped to the role-specific manifest file.
 *   2. That manifest JSON exists, has the correct `name`, `display: standalone`,
 *      and a `start_url` that carries `?app=<role>` under the role's home path.
 *   3. Launching that `start_url` from a signed-out browser (simulating a fresh
 *      PWA cold-start) binds the app role in localStorage and redirects to the
 *      matching role login page — never to the generic customer app.
 */

type RoleKey = "admin" | "agent" | "distributor" | "super-distributor" | "merchant";

interface RoleSpec {
  role: RoleKey;
  manifest: string;
  manifestName: RegExp;
  home: string;
  scope: string;
  loginPath: string;
  loginHeading: RegExp;
}

const ROLES: RoleSpec[] = [
  {
    role: "admin",
    manifest: "/manifest-admin.json",
    manifestName: /EasyPay Admin/i,
    home: "/admin",
    scope: "/admin/",
    loginPath: "/admin/login",
    loginHeading: /Admin Console/i,
  },
  {
    role: "agent",
    manifest: "/manifest-agent.json",
    manifestName: /EasyPay Agent/i,
    home: "/agent",
    scope: "/agent/",
    loginPath: "/agent/login",
    loginHeading: /Agent/i,
  },
  {
    role: "distributor",
    manifest: "/manifest-distributor.json",
    manifestName: /EasyPay Distributor/i,
    home: "/distributor",
    scope: "/distributor/",
    loginPath: "/distributor/login",
    loginHeading: /Distributor Portal/i,
  },
  {
    role: "super-distributor",
    manifest: "/manifest-super-distributor.json",
    manifestName: /EasyPay Super Distributor/i,
    home: "/super-distributor",
    scope: "/super-distributor/",
    loginPath: "/super-distributor/login",
    loginHeading: /Super Distributor/i,
  },
  {
    role: "merchant",
    manifest: "/manifest-merchant.json",
    manifestName: /EasyPay Merchant/i,
    home: "/merchant",
    scope: "/merchant/",
    loginPath: "/merchant/login",
    loginHeading: /Merchant Portal/i,
  },
];

async function clearAppState(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
}

test.describe("/<role>/install — correct PWA entry state + redirect", () => {
  for (const spec of ROLES) {
    test(`${spec.role}: install page swaps manifest link to ${spec.manifest}`, async ({ page }) => {
      await clearAppState(page);
      await page.goto(`/${spec.role}/install`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Manifest link should point at the role-specific file.
      const href = await page.locator('link[rel="manifest"]').getAttribute("href");
      expect(href).toBe(spec.manifest);
    });

    test(`${spec.role}: manifest JSON has correct name/start_url/display`, async ({ request }) => {
      const res = await request.get(spec.manifest);
      expect(res.status(), `${spec.manifest} must be served`).toBe(200);
      const body = await res.json();
      expect(body.name).toMatch(spec.manifestName);
      expect(body.display).toBe("standalone");
      expect(body.scope).toBe(spec.scope);
      // start_url must live under the role's home AND carry ?app=<role> so the
      // installed app rebinds its role on every cold launch.
      expect(String(body.start_url)).toContain(spec.home);
      expect(String(body.start_url)).toContain(`app=${spec.role}`);
    });

    test(`${spec.role}: launching manifest start_url (signed out) lands on ${spec.loginPath}`, async ({
      page,
      request,
    }) => {
      await clearAppState(page);
      const manifest = await (await request.get(spec.manifest)).json();
      const startUrl: string = manifest.start_url;

      // Simulate opening the installed PWA cold: navigate straight to start_url.
      await page.goto(startUrl);

      // AppRoleEnforcer + RoleGuard must funnel the signed-out user to the
      // role's dedicated login (never the generic customer AuthPage).
      await page.waitForURL(`**${spec.loginPath}**`, { timeout: 10_000 });
      expect(new URL(page.url()).pathname).toBe(spec.loginPath);
      await expect(page.getByText(spec.loginHeading).first()).toBeVisible();

      // ?app=<role> should have been captured and persisted for later launches.
      const bound = await page.evaluate(() => localStorage.getItem("mfs_app_role"));
      expect(bound).toBe(spec.role);
    });
  }
});
