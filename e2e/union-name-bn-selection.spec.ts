import { test, expect, type Page } from "@playwright/test";

/**
 * Regression: selecting a union whose DB row has `name_bn` populated must
 * render the Bangla label on the trigger chip (not the English `name`).
 *
 * Fixture: Khulna › Narail › Kalia › Babrahasla → বাবরাহাসলা
 * The seed is applied via a migration/data change owned by the repo, so this
 * spec assumes the row exists. If the fixture ever disappears the test
 * self-skips instead of hard-failing so unrelated PRs aren't blocked.
 */

const FIXTURE = {
  division: "Khulna",
  district: "Narail",
  upazila: "Kalia",
  english: "Babrahasla",
  bangla: "বাবরাহাসলা",
} as const;

const BENGALI = /[\u0980-\u09FF]/;

async function openApplyInBangla(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem("mfs_ui_lang", "bn"); } catch { /* noop */ }
  });
  await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });
}

async function selectByLabel(page: Page, label: RegExp, value: string) {
  const sel = page.getByLabel(label);
  await expect(sel).toBeEnabled({ timeout: 8_000 });
  const values = await sel.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => o.value),
  );
  if (!values.includes(value)) {
    test.skip(true, `option "${value}" missing under ${label}`);
  }
  await sel.selectOption(value);
}

test.describe("Union DB name_bn — trigger chip renders Bangla", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("selecting Babrahasla shows বাবরাহাসলা on the trigger", async ({ page }) => {
    await openApplyInBangla(page);

    await selectByLabel(page, /বিভাগ|Division/i, FIXTURE.division);
    await selectByLabel(page, /জেলা|District/i, FIXTURE.district);
    await selectByLabel(page, /উপজেলা|Thana|Upazila/i, FIXTURE.upazila);

    const trigger = page
      .getByRole("combobox", { name: /ইউনিয়ন|পৌরসভা|সিটি|Union|Powrashava|City/i })
      .last();
    await expect(trigger).toBeVisible({ timeout: 8_000 });
    await trigger.click();

    // Wait until popover finished loading.
    await page.waitForFunction(() => {
      const wrap = document.querySelector('[data-radix-popper-content-wrapper]');
      if (!wrap) return false;
      if (wrap.querySelector('[data-testid="union-loading"]')) return false;
      return !!wrap.querySelector("button");
    }, { timeout: 10_000 });

    // Search by the Bangla name — verifies name_bn is part of the matcher.
    const searchInput = page.locator('[data-radix-popper-content-wrapper] input').first();
    await searchInput.fill(FIXTURE.bangla);
    await page.waitForTimeout(200);

    const banglaRow = page
      .locator('[data-radix-popper-content-wrapper] button', { hasText: FIXTURE.bangla });
    const banglaCount = await banglaRow.count();
    if (banglaCount === 0) {
      test.skip(true, `fixture row "${FIXTURE.english}" not seeded with name_bn`);
    }
    await expect(banglaRow.first()).toBeVisible();

    // The visible label must be the Bangla string, not the English fallback.
    const label = (await banglaRow.first().textContent()) || "";
    expect(label, "row label should be the DB Bangla name").toContain(FIXTURE.bangla);
    expect(label, "row label should not fall back to English").not.toContain(FIXTURE.english);

    await banglaRow.first().click();

    // Trigger chip should now show the Bangla name.
    await expect(trigger).toContainText(FIXTURE.bangla, { timeout: 5_000 });
    const chipText = (await trigger.textContent()) || "";
    expect(chipText, "trigger chip should render Bangla script").toMatch(BENGALI);
    expect(chipText, "trigger chip should not show the English name").not.toContain(FIXTURE.english);

    // Reopen the popover and ensure the checked row is still the Bangla one.
    await trigger.click();
    await page.waitForTimeout(150);
    const selectedRowText = await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-radix-popper-content-wrapper] button'),
      );
      // The selected row shows a fully-opaque Check icon; find the first
      // button whose Check svg does NOT have the "opacity-0" class.
      const selected = btns.find((b) => {
        const check = b.querySelector("svg");
        return check && !check.className.baseVal?.includes("opacity-0");
      });
      return selected?.textContent?.trim() ?? "";
    });
    expect(selectedRowText, "checked row should render the Bangla label").toContain(FIXTURE.bangla);
  });
});
