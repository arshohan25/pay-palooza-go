import { test, expect } from "@playwright/test";

/**
 * E2E for the CashOut amount step.
 *
 * Builds on the recipient-step contract by walking the harness from the
 * agent step into the amount step and verifying that:
 *
 *   1. Continue is disabled while the amount is empty or below the minimum.
 *   2. An invalid amount surfaces an inline error after blur.
 *   3. Entering an amount inside the [MIN, MAX] window enables Continue.
 *   4. Clicking Continue advances the wizard to the confirmation screen
 *      and the confirm screen shows the entered amount and recipient.
 */

const AGENT_ID = "AGT-10234";

test.describe("CashOut amount → confirmation screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__test/cashout-harness");
    await expect(page.getByTestId("title")).toBeVisible();

    // Walk past the recipient step so we land on the amount step.
    await page.getByTestId("agent-id-input").fill(AGENT_ID);
    await page.getByTestId("agent-continue").click();
    await expect(page.getByTestId("step")).toHaveText("step:amount");
    await expect(page.getByTestId("amount-heading")).toBeVisible();
  });

  test("invalid amount keeps Continue disabled; valid amount advances step", async ({ page }) => {
    const amount = page.getByTestId("amount-input");
    const cont = page.getByTestId("amount-continue");

    // 1. Empty: Continue disabled.
    await expect(cont).toBeDisabled();

    // 2. Below minimum: inline error after blur, Continue still disabled.
    await amount.fill("10");
    await amount.evaluate((el: HTMLInputElement) => el.blur());
    await expect(page.getByTestId("amount-error")).toBeVisible();
    await expect(cont).toBeDisabled();

    // 3. Above maximum: still disabled.
    await amount.fill("30000");
    await expect(page.getByTestId("amount-error")).toBeVisible();
    await expect(cont).toBeDisabled();

    // 4. Valid amount: error clears, Continue enabled.
    await amount.fill("500");
    await expect(page.getByTestId("amount-error")).toHaveCount(0);
    await expect(cont).toBeEnabled();

    // 5. Click Continue → wizard advances to confirmation screen.
    await cont.click();
    await expect(page.getByTestId("step")).toHaveText("step:confirm");
    await expect(page.getByTestId("confirm-heading")).toBeVisible();
    await expect(page.getByTestId("confirm-amount")).toHaveText("৳500");
    await expect(page.getByTestId("confirm-recipient")).toHaveText(AGENT_ID);
  });
});
