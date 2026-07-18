import { test, expect } from "@playwright/test";

/**
 * Verifies that /distributor/login, /super-distributor/login and /admin/login
 * render their dedicated login UIs (not the generic customer AuthPage), and
 * that signed-out visits to their protected routes redirect back to the
 * matching login page.
 */

type RoleSpec = {
  role: "distributor" | "super-distributor" | "admin";
  loginPath: string;
  heading: RegExp;
  protectedRoutes: string[];
};

const ROLES: RoleSpec[] = [
  {
    role: "distributor",
    loginPath: "/distributor/login",
    heading: /Distributor Portal/i,
    protectedRoutes: ["/distributor"],
  },
  {
    role: "super-distributor",
    loginPath: "/super-distributor/login",
    heading: /Super Distributor/i,
    protectedRoutes: ["/super-distributor"],
  },
  {
    role: "admin",
    loginPath: "/admin/login",
    heading: /Admin Console/i,
    protectedRoutes: ["/admin"],
  },
];

test.describe("Dedicated role login pages", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  for (const spec of ROLES) {
    test(`${spec.loginPath} renders dedicated ${spec.role} login UI`, async ({ page }) => {
      await page.goto(spec.loginPath);
      await expect(page).toHaveURL(new RegExp(`${spec.loginPath}$`));

      // Dedicated header copy
      await expect(page.getByRole("heading", { name: spec.heading })).toBeVisible();

      // Phone + PIN inputs (no signup / no email)
      await expect(page.getByPlaceholder("01XXXXXXXXX")).toBeVisible();
      await expect(page.getByPlaceholder("••••")).toBeVisible();

      // Forgot PIN link is present
      await expect(page.getByRole("button", { name: /Forgot PIN\?/i })).toBeVisible();

      // Generic customer AuthPage markers must NOT be present.
      await expect(page.getByText(/Welcome Back/i)).toHaveCount(0);
      await expect(page.locator('input[type="email"]')).toHaveCount(0);
    });

    test(`${spec.loginPath} validates phone before submit`, async ({ page }) => {
      await page.goto(spec.loginPath);
      await page.getByPlaceholder("01XXXXXXXXX").fill("123");
      await page.getByPlaceholder("••••").fill("1234");
      await page.getByRole("button", { name: /Sign in/i }).click();
      await expect(page.getByRole("alert")).toContainText(/valid 11-digit/i);
    });

    for (const route of spec.protectedRoutes) {
      test(`signed-out visit to ${route} redirects to ${spec.loginPath}`, async ({ page }) => {
        // Bind the PWA to the role and ensure no session exists.
        await page.goto(spec.loginPath);
        await page.evaluate((role) => {
          localStorage.setItem("mfs_app_role", role);
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
              localStorage.removeItem(k);
            }
          }
        }, spec.role);

        await page.goto(route);
        await page.waitForURL(`**${spec.loginPath}`, { timeout: 10_000 });
        await expect(page).toHaveURL(new RegExp(`${spec.loginPath}$`));
        await expect(page.getByRole("heading", { name: spec.heading })).toBeVisible();
      });
    }
  }
});
