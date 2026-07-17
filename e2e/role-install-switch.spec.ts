import { test, expect, type Page } from "@playwright/test";

/**
 * Switching between /install/<role> entries must fully rebind the PWA shell:
 *   1. The <link rel="manifest"> href swaps to the newly requested role.
 *   2. The stored app role (`mfs_app_role`) is overwritten — never stale.
 *   3. A cold relaunch of the newer manifest's `start_url` binds the new role,
 *      not the previous one, and lands on the correct login/home path.
 *
 * This catches regressions where a second install would reuse the first
 * role's manifest link or leave `mfs_app_role` pointing at the old role.
 */

type RoleKey = "admin" | "agent" | "distributor" | "super-distributor" | "merchant";

interface RoleSpec {
  role: RoleKey;
  manifest: string;
  home: string;
  loginPath: string;
}

const ROLES: Record<RoleKey, RoleSpec> = {
  admin: { role: "admin", manifest: "/manifest-admin.json", home: "/admin", loginPath: "/login/admin" },
  agent: { role: "agent", manifest: "/manifest-agent.json", home: "/agent", loginPath: "/login/agent" },
  distributor: {
    role: "distributor",
    manifest: "/manifest-distributor.json",
    home: "/distributor",
    loginPath: "/login/distributor",
  },
  "super-distributor": {
    role: "super-distributor",
    manifest: "/manifest-super-distributor.json",
    home: "/super-distributor",
    loginPath: "/login/super-distributor",
  },
  merchant: {
    role: "merchant",
    manifest: "/manifest-merchant.json",
    home: "/merchant",
    loginPath: "/merchant-login",
  },
};

async function clearAppState(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
}

async function readManifestHref(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null
  );
}

async function readBoundRole(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("mfs_app_role"));
}

// Ordered switch pairs — exhaustive would be N*N; these cover the meaningful
// role-family transitions (customer→admin, agent→merchant, distributor→SD, etc.).
const SWITCH_PAIRS: Array<[RoleKey, RoleKey]> = [
  ["agent", "admin"],
  ["admin", "merchant"],
  ["distributor", "super-distributor"],
  ["super-distributor", "distributor"],
  ["merchant", "agent"],
  ["agent", "distributor"],
];

test.describe("/install/<role> — switching rebinds manifest + app role", () => {
  for (const [from, to] of SWITCH_PAIRS) {
    test(`switching from ${from} → ${to} updates manifest link and mfs_app_role`, async ({ page }) => {
      const src = ROLES[from];
      const dst = ROLES[to];

      await clearAppState(page);

      // 1. Visit first install page, confirm manifest + bind role manually
      //    (production capture happens via ?app= on start_url; simulate here).
      await page.goto(`/install/${from}`, { waitUntil: "domcontentloaded" });
      await expect
        .poll(async () => readManifestHref(page), { timeout: 5_000 })
        .toBe(src.manifest);
      await page.evaluate((r) => localStorage.setItem("mfs_app_role", r), from);

      // 2. Navigate to the second install page in the SAME tab.
      await page.goto(`/install/${to}`, { waitUntil: "domcontentloaded" });
      await expect
        .poll(async () => readManifestHref(page), { timeout: 5_000 })
        .toBe(dst.manifest);
      // Manifest link must not be the previous role's.
      expect(await readManifestHref(page)).not.toBe(src.manifest);

      // 3. Simulate PWA cold relaunch by hitting the new manifest's start_url.
      const manifestRes = await page.request.get(dst.manifest);
      expect(manifestRes.ok(), `${dst.manifest} must be served`).toBe(true);
      const manifest = await manifestRes.json();
      expect(manifest.start_url, `${dst.manifest} missing start_url`).toBeTruthy();

      await clearAppState(page);
      await page.goto(manifest.start_url, { waitUntil: "domcontentloaded" });

      // Role rebind: mfs_app_role must now match the NEW role, never the old.
      await expect
        .poll(async () => readBoundRole(page), { timeout: 5_000 })
        .toBe(dst.role);
      expect(await readBoundRole(page)).not.toBe(from);

      // Cold-start navigation must land on the new role's login (signed-out),
      // never on the previous role's home or login.
      await page.waitForURL((url) => {
        const p = new URL(url).pathname;
        return p.startsWith(dst.loginPath) || p.startsWith(dst.home);
      }, { timeout: 10_000 });

      const finalPath = new URL(page.url()).pathname;
      expect(finalPath.startsWith(src.home) || finalPath.startsWith(src.loginPath))
        .toBe(false);
    });
  }
});

test.describe("/install/<role> — manifest files have distinct start_urls", () => {
  test("every role manifest carries its own ?app=<role> so relaunch cannot cross-bind", async ({ request }) => {
    const seen = new Set<string>();
    for (const spec of Object.values(ROLES)) {
      const res = await request.get(spec.manifest);
      expect(res.ok()).toBe(true);
      const m = await res.json();
      expect(m.start_url, `${spec.manifest} missing start_url`).toBeTruthy();
      expect(m.start_url).toContain(`app=${spec.role}`);
      expect(seen.has(m.start_url), `duplicate start_url ${m.start_url}`).toBe(false);
      seen.add(m.start_url);
      expect(m.display).toBe("standalone");
    }
  });
});
