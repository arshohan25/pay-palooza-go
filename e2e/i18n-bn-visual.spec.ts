import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression snapshots for key routes in Bangla (lang=bn).
 * Catches UI regressions in headings, tabs, and buttons.
 *
 * First run: snapshots are generated under e2e/i18n-bn-visual.spec.ts-snapshots/.
 * Update locally with: npm run test:e2e -- --update-snapshots
 */

const ROUTES: Array<{ path: string; name: string }> = [
  { path: "/", name: "home" },
  { path: "/account", name: "account" },
  { path: "/savings", name: "savings" },
  { path: "/donations", name: "donations" },
  { path: "/coupons", name: "coupons" },
];

async function setBangla(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("mfs_ui_lang", "bn");
    } catch {
      /* ignore */
    }
  });
}

async function freezeUi(page: Page) {
  // Disable animations and caret blink for stable pixel diffs.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  });
}

test.describe("i18n bn — visual regression", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const { path, name } of ROUTES) {
    test(`route ${name} renders consistently in bn`, async ({ page }) => {
      await setBangla(page);
      await page.goto(path, { waitUntil: "networkidle" });
      await freezeUi(page);

      // Allow lazy-loaded chunks to settle.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      // Ensure no missing-translation fallbacks are showing.
      const fallback = await page.locator("text=/⟦.*⟧/").count();
      expect(fallback, "no ⟦missing-key⟧ fallbacks should be visible").toBe(0);

      await expect(page).toHaveScreenshot(`${name}-bn.png`, {
        fullPage: false,
        animations: "disabled",
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
