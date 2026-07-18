import { test, expect, type Page } from "@playwright/test";

/**
 * Switching between /<role>/install entries must fully rebind the PWA shell:
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
  scope: string;
}

const ROLES: Record<RoleKey, RoleSpec> = {
  admin: { role: "admin", manifest: "/manifest-admin.json", home: "/admin", loginPath: "/admin/login", scope: "/admin/" },
  agent: { role: "agent", manifest: "/manifest-agent.json", home: "/agent", loginPath: "/agent/login", scope: "/agent/" },
  distributor: {
    role: "distributor",
    manifest: "/manifest-distributor.json",
    home: "/distributor",
    loginPath: "/distributor/login",
    scope: "/distributor/",
  },
  "super-distributor": {
    role: "super-distributor",
    manifest: "/manifest-super-distributor.json",
    home: "/super-distributor",
    loginPath: "/super-distributor/login",
    scope: "/super-distributor/",
  },
  merchant: {
    role: "merchant",
    manifest: "/manifest-merchant.json",
    home: "/merchant",
    loginPath: "/merchant/login",
    scope: "/merchant/",
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

test.describe("/<role>/install — switching rebinds manifest + app role", () => {
  for (const [from, to] of SWITCH_PAIRS) {
    test(`switching from ${from} → ${to} updates manifest link and mfs_app_role`, async ({ page }) => {
      const src = ROLES[from];
      const dst = ROLES[to];

      await clearAppState(page);

      // 1. Visit first install page, confirm manifest + bind role manually
      //    (production capture happens via ?app= on start_url; simulate here).
      await page.goto(`/${from}/install`, { waitUntil: "domcontentloaded" });
      await expect
        .poll(async () => readManifestHref(page), { timeout: 5_000 })
        .toBe(src.manifest);
      await page.evaluate((r) => localStorage.setItem("mfs_app_role", r), from);

      // 2. Navigate to the second install page in the SAME tab.
      await page.goto(`/${to}/install`, { waitUntil: "domcontentloaded" });
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
      expect(m.scope).toBe(spec.scope);
      expect(seen.has(m.start_url), `duplicate start_url ${m.start_url}`).toBe(false);
      seen.add(m.start_url);
      expect(m.display).toBe("standalone");
    }
  });
});

/**
 * Service-worker + app-shell rebind invariants.
 *
 * The app ships a kill-switch `/sw.js` only; role PWAs are separated by manifest
 * scope/id, not by cached app shells. Switching /<role>/install must therefore:
 *   1. NEVER produce a per-role SW file (would create a stale, role-scoped
 *      precache that survives relaunch of a different role).
 *   2. Keep at most one active registration whose scriptURL is `/sw.js`, so
 *      switching does not accumulate registrations retaining old assets.
 *   3. On preview/iframe hosts, register no SW at all (guard in main.tsx),
 *      so the switching UI never installs a shell that would be reused.
 */
test.describe("/<role>/install — service worker & app shell rebind on switch", () => {
  test("no role-scoped sw.js files exist — one shared /sw.js only", async ({ request }) => {
    const forbidden = [
      "/sw-admin.js",
      "/sw-agent.js",
      "/sw-distributor.js",
      "/sw-super-distributor.js",
      "/sw-merchant.js",
    ];
    for (const path of forbidden) {
      const res = await request.get(path);
      expect(res.status(), `${path} must not be served`).toBe(404);
    }
  });

  test("switching install pages does not accumulate service worker registrations", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "SW API only reliable in chromium on localhost");

    await clearAppState(page);
    await page.goto("/agent/install", { waitUntil: "domcontentloaded" });
    await page.goto("/merchant/install", { waitUntil: "domcontentloaded" });
    await page.goto("/admin/install", { waitUntil: "domcontentloaded" });

    const regs = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return [];
      const list = await navigator.serviceWorker.getRegistrations();
      return list.map((r) => ({
        scope: r.scope,
        scriptURL: r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? null,
      }));
    });

    // Preview/localhost guard in main.tsx skips registration entirely; in
    // production a single shared /sw.js registration is the only valid state.
    expect(regs.length).toBeLessThanOrEqual(1);
    for (const r of regs) {
      expect(r.scriptURL ?? "").toMatch(/\/sw\.js(\?|$)/);
    }
  });

  test("no automatic role-scoped cache buckets are created when switching install pages", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CacheStorage API test scoped to chromium");

    await clearAppState(page);
    await page.goto("/agent/install", { waitUntil: "domcontentloaded" });
    await page.goto("/merchant/install", { waitUntil: "domcontentloaded" });
    await page.goto("/admin/install", { waitUntil: "domcontentloaded" });

    const keys = await page.evaluate(async () => {
      if (!("caches" in window)) return [];
      return caches.keys();
    });

    // No app code should be creating role-tagged cache buckets — the shared
    // Workbox precache owns all roles. Anything else risks a stale shell.
    const roleTagged = keys.filter((k) =>
      /(^|[-_])(admin|agent|distributor|super-distributor|merchant)([-_]|$)/.test(k),
    );
    expect(roleTagged, `unexpected role-scoped cache buckets: ${roleTagged.join(", ")}`).toEqual([]);
  });
});
