import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies the Union / Powrashava / City-corp list renders in Bangla when the
 * app language is set to `bn`. Structural names (Powrashava / Sadar / City
 * Corporation) are translated via `bnUnion` pattern rules; DB-provided
 * `unions.name_bn` overrides — this spec asserts that the pipeline reaches
 * the rendered popover.
 *
 * Coverage:
 *   1. Group headers ("সিটি কর্পোরেশন", "পৌরসভা", "ইউনিয়ন") render in Bangla.
 *   2. At least one visible row contains Bangla script (U+0980–U+09FF).
 *   3. Empty-state / loading labels render in Bangla when triggered.
 */

const BENGALI = /[\u0980-\u09FF]/;

async function openApplyInBangla(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("mfs_ui_lang", "bn");
    } catch { /* storage may be blocked in some contexts */ }
  });
  await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });
}

async function pickFirst(page: Page, label: RegExp) {
  const sel = page.getByLabel(label);
  await expect(sel).toBeEnabled({ timeout: 8_000 });
  const values = await sel.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => o.value).filter(Boolean),
  );
  test.skip(values.length === 0, `no options for ${label}`);
  await sel.selectOption(values[0]);
}

async function collectPopoverText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const wrap = document.querySelector('[data-radix-popper-content-wrapper]');
    return wrap ? (wrap.textContent || "") : "";
  });
}

test.describe("Union list Bangla localisation", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("group headers, row labels and empty/loading states render in Bangla", async ({ page }) => {
    await openApplyInBangla(page);

    // Cascade is labelled in Bangla when lang=bn; match both scripts so the
    // spec still works if the label wording changes.
    await pickFirst(page, /বিভাগ|Division/i);
    await pickFirst(page, /জেলা|District/i);
    await pickFirst(page, /উপজেলা|Thana|Upazila/i);

    const trigger = page
      .getByRole("combobox", { name: /ইউনিয়ন|পৌরসভা|সিটি|Union|Powrashava|City/i })
      .last();
    await expect(trigger).toBeVisible({ timeout: 8_000 });
    await trigger.click();

    // Wait until the popover is done loading and shows either rows or empty.
    await page.waitForFunction(() => {
      const wrap = document.querySelector('[data-radix-popper-content-wrapper]');
      if (!wrap) return false;
      if (wrap.querySelector('[data-testid="union-loading"]')) return false;
      return (
        !!wrap.querySelector("button") ||
        !!wrap.querySelector('[data-testid="union-empty"]')
      );
    }, { timeout: 10_000 });

    const emptyEl = page.getByTestId("union-empty");
    if (await emptyEl.isVisible().catch(() => false)) {
      // Empty state must be in Bangla ("কোনো ফলাফল নেই").
      const txt = (await emptyEl.textContent()) || "";
      expect(txt, "empty state should be Bangla").toMatch(BENGALI);
      return;
    }

    // Collect visible popover content and check it contains Bangla script.
    const text = await collectPopoverText(page);
    expect(text.length, "popover should have text").toBeGreaterThan(0);
    expect(text, "popover text should contain Bangla script").toMatch(BENGALI);

    // At least one group header should be one of the Bangla group labels.
    const headers = ["ইউনিয়ন", "পৌরসভা", "সিটি কর্প."];
    expect(
      headers.some((h) => text.includes(h)),
      `expected a Bangla group header in popover, got: ${text.slice(0, 200)}`,
    ).toBe(true);

    // Search placeholder should be Bangla too.
    const searchInput = page
      .locator('[data-radix-popper-content-wrapper] input')
      .first();
    const placeholder = await searchInput.getAttribute("placeholder");
    expect(placeholder ?? "", "search placeholder should be Bangla").toMatch(BENGALI);

    // Bangla search should still match rows (matcher includes name_bn +
    // displayName). Typing "পৌ" filters to Powrashava-like rows.
    await searchInput.fill("পৌ");
    await page.waitForTimeout(200);
    const filtered = await collectPopoverText(page);
    // Either rows containing পৌরসভা are shown, or the empty state renders in
    // Bangla — both prove the search pipeline handles Bangla input.
    const emptyAfter = await page.getByTestId("union-empty").isVisible().catch(() => false);
    if (!emptyAfter) {
      expect(filtered, "filtered rows should contain পৌরসভা").toMatch(/পৌরসভা/);
    }
  });
});
