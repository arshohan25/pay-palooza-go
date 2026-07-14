import { test, expect } from "@playwright/test";

/**
 * Regression: after a full cache purge / fresh install the app must never
 * be stuck on the splash or onboarding screen. Within a few seconds the
 * user should reach either the onboarding slides or the login shell.
 */

test.describe("splash + onboarding — post cache purge", () => {
  test("fresh install does not get stuck on splash", async ({ page, context }) => {
    // Simulate a truly fresh install: no localStorage, no sessionStorage,
    // no CacheStorage, no service workers.
    await context.clearCookies();
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Purge runtime caches / service workers from inside the page too.
    await page.evaluate(async () => {
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch { /* ignore */ }
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch { /* ignore */ }
      try { localStorage.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }
    });

    // Splash has a hard cap of 1.5s; give generous headroom for CI.
    await expect
      .poll(async () => await page.locator(".splash-container").count(), {
        timeout: 8_000,
      })
      .toBe(0);

    // Some recognizable post-splash surface must be visible: either the
    // onboarding first slide ("Send Money Instantly") or the login shell
    // (EasyPay / PIN / Phone entry).
    const onboarding = page.getByText(/Send Money Instantly|তাৎক্ষণিক টাকা পাঠান/);
    const loginShell = page.getByText(/EasyPay|Login|Sign in|PIN|Phone/i);

    await expect(onboarding.or(loginShell).first()).toBeVisible({ timeout: 10_000 });
  });

  test("cache_version bump triggers auto purge and still renders app", async ({ page }) => {
    // Seed a stale cache version + junk keys, exactly what an upgraded
    // user would have. syncClientCacheVersion() should wipe them.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("app_cache_version", "1");
        localStorage.setItem("mfs_junk", "should-be-cleared");
        localStorage.setItem("splashDone", "1");
      } catch { /* ignore */ }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Splash must clear.
    await expect
      .poll(async () => await page.locator(".splash-container").count(), {
        timeout: 8_000,
      })
      .toBe(0);

    // Stale keys should be gone, version should be bumped to current.
    const state = await page.evaluate(() => ({
      junk: localStorage.getItem("mfs_junk"),
      version: localStorage.getItem("app_cache_version"),
    }));
    expect(state.junk).toBeNull();
    expect(Number(state.version)).toBeGreaterThanOrEqual(20);

    // App shell must be rendered (onboarding or login), not blank.
    const onboarding = page.getByText(/Send Money Instantly|তাৎক্ষণিক টাকা পাঠান/);
    const loginShell = page.getByText(/EasyPay|Login|Sign in|PIN|Phone/i);
    await expect(onboarding.or(loginShell).first()).toBeVisible({ timeout: 10_000 });
  });
});
