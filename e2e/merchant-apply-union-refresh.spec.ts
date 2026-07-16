import { test, expect } from "@playwright/test";

/**
 * Verifies that when the user changes Upazila / Thana the Union / Powrashava /
 * City Corp. dropdown fully refreshes (no stale grouped results from the
 * previous upazila leak into the new list).
 */

async function openApplyForm(page: import("@playwright/test").Page) {
  await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });
  // Division / District / Upazila selects are native <select>s rendered by
  // DivisionDistrictUpazilaPicker with aria-labels.
  await expect(page.getByLabel(/^Division/i)).toBeVisible({ timeout: 10_000 });
}

async function selectFirstNonEmpty(page: import("@playwright/test").Page, label: RegExp) {
  const sel = page.getByLabel(label);
  await expect(sel).toBeEnabled({ timeout: 8_000 });
  const values = await sel.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options)
      .map((o) => o.value)
      .filter((v) => v !== ""),
  );
  expect(values.length).toBeGreaterThan(0);
  await sel.selectOption(values[0]);
  return values[0];
}

async function readUnionOptions(page: import("@playwright/test").Page) {
  const trigger = page.getByRole("combobox", { name: /Union|ইউনিয়ন/i }).first();
  await trigger.click();
  const buttons = page.locator('[role="dialog"], [data-radix-popper-content-wrapper]').getByRole("button");
  // Wait for at least one option button to render.
  await expect
    .poll(async () => buttons.count(), { timeout: 5_000 })
    .toBeGreaterThan(0);
  const names = await buttons.evaluateAll((els) =>
    els.map((el) => (el.textContent || "").trim()).filter(Boolean),
  );
  // Close the popover.
  await page.keyboard.press("Escape");
  return names;
}

test("union dropdown refreshes when upazila changes", async ({ page }) => {
  await openApplyForm(page);
  await selectFirstNonEmpty(page, /^Division/i);
  await selectFirstNonEmpty(page, /^District/i);

  const upazilaSel = page.getByLabel(/Upazila|Thana/i);
  const upazilas = await upazilaSel.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => o.value).filter(Boolean),
  );
  test.skip(upazilas.length < 2, "Need >=2 upazilas to test refresh");

  await upazilaSel.selectOption(upazilas[0]);
  const firstList = await readUnionOptions(page);

  await upazilaSel.selectOption(upazilas[1]);
  const secondList = await readUnionOptions(page);

  // The second list must differ from the first — otherwise stale results.
  expect(secondList.join("|")).not.toBe(firstList.join("|"));
  // And should not contain every item from the first list (some overlap OK,
  // but full equality means we never refreshed).
  const stale = firstList.filter((n) => secondList.includes(n));
  expect(stale.length).toBeLessThan(firstList.length);
});
