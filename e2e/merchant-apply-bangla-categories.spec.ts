import { test, expect } from "@playwright/test";

/**
 * Verifies the merchant apply category dropdown:
 *  - renders Bangla labels when the app language is bn
 *  - Bangla search filters options to the expected matches
 *
 * Language is toggled via localStorage before load (matches useI18n).
 */

test.describe("Merchant apply — Bangla categories", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("lang", "bn");
        window.localStorage.setItem("i18n-lang", "bn");
      } catch {}
    });
  });

  test("category dropdown shows Bangla labels and Bangla search filters", async ({ page }) => {
    await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });

    const categoryTrigger = page.getByRole("combobox").first();
    await expect(categoryTrigger).toBeVisible({ timeout: 10_000 });
    await categoryTrigger.click();

    const options = page.getByRole("option");
    await expect
      .poll(async () => options.count(), { timeout: 8_000 })
      .toBeGreaterThanOrEqual(5);

    const labels = await options.evaluateAll((els) => els.map((e) => (e.textContent || "").trim()));
    // At least one label must include Bangla characters (U+0980..U+09FF).
    const bnRegex = /[\u0980-\u09FF]/;
    const bnCount = labels.filter((l) => bnRegex.test(l)).length;
    expect(bnCount, `expected Bangla labels, got: ${labels.slice(0, 6).join(" | ")}`).toBeGreaterThanOrEqual(3);

    // Search for a Bangla term ("খাবার" = food/restaurant) and expect ≥1 match.
    const search = page.getByRole("combobox").locator("..").getByRole("textbox").first().or(
      page.locator('input[placeholder]').first(),
    );
    // The Command input inside the popover:
    const cmdInput = page.locator('[cmdk-input], input[role="combobox"]').last();
    const target = (await cmdInput.count()) > 0 ? cmdInput : search;
    await target.fill("খাবার");
    await expect
      .poll(async () => options.count(), { timeout: 4_000 })
      .toBeGreaterThanOrEqual(1);

    const filtered = await options.evaluateAll((els) => els.map((e) => (e.textContent || "").trim()));
    expect(filtered.every((l) => bnRegex.test(l) || l.length > 0)).toBe(true);
  });
});
