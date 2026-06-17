import { test, expect } from "@playwright/test";

/**
 * Full E2E for the recipient validation flow.
 *
 * Drives the dev-only `/__test/recipient-harness` page, which mounts the
 * `useRecipientField` hook against the centralized recipient validation
 * schema. Verifies the contract every money-movement flow relies on:
 *
 *   1. Continue is disabled while the recipient is empty.
 *   2. While typing an invalid recipient (e.g. wrong prefix or too short)
 *      the inline error appears and Continue stays disabled.
 *   3. Once the recipient matches the expected format, the error clears
 *      and Continue becomes enabled.
 *   4. Blurring an empty field surfaces the "required" message.
 */

const HARNESS = "/__test/recipient-harness";

test.describe("recipient validation harness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await expect(page.getByTestId("title")).toBeVisible();
  });

  test("agentId: empty -> invalid -> valid toggles Continue", async ({ page }) => {
    await page.getByTestId("kind").selectOption("agentId");

    const input = page.getByTestId("recipient-input");
    const cont = page.getByTestId("continue");

    // 1. Empty: Continue disabled, no inline error yet.
    await expect(cont).toBeDisabled();
    await expect(page.getByTestId("error")).toHaveCount(0);

    // 2. Invalid (too short): error visible, Continue still disabled.
    await input.fill("AG1");
    await expect(page.getByTestId("error")).toBeVisible();
    await expect(cont).toBeDisabled();

    // 3. Valid: error gone, Continue enabled.
    await input.fill("AG12345");
    await expect(page.getByTestId("error")).toHaveCount(0);
    await expect(cont).toBeEnabled();

    // 4. Clear -> invalid empty after blur surfaces the required message.
    await input.fill("");
    await input.blur();
    await expect(page.getByTestId("error")).toBeVisible();
    await expect(cont).toBeDisabled();
  });

  test("phone: must start with 01 and be 11 digits", async ({ page }) => {
    await page.getByTestId("kind").selectOption("phone");
    const input = page.getByTestId("recipient-input");
    const cont = page.getByTestId("continue");

    await input.fill("02123456789");
    await expect(page.getByTestId("error")).toContainText(/01/);
    await expect(cont).toBeDisabled();

    await input.fill("0171-234-5678");
    await expect(page.getByTestId("error")).toHaveCount(0);
    await expect(cont).toBeEnabled();
    await expect(page.getByTestId("state")).toContainText('"normalized": "01712345678"');
  });

  test("billAccount: custom label appears in the inline error", async ({ page }) => {
    await page.getByTestId("kind").selectOption("billAccount");
    const input = page.getByTestId("recipient-input");

    await input.fill("12");
    await expect(page.getByTestId("error")).toContainText("Meter No");
  });
});
