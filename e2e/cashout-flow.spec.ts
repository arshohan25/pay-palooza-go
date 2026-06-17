import { test, expect } from "@playwright/test";

/**
 * E2E for the CashOut recipient step.
 *
 * Drives the dev-only `/__test/cashout-harness` page, which mounts a
 * minimal CashOut wizard using the same `useRecipientField("agentId")`
 * hook the real CashOutFlow uses. Verifies:
 *
 *   1. Continue is hidden / not clickable until the agent ID is valid.
 *   2. An invalid agent ID surfaces the centralized inline error.
 *   3. Entering a valid agent ID enables Continue.
 *   4. Clicking Continue advances the wizard to the next screen.
 */

test.describe("CashOut recipient → next screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__test/cashout-harness");
    await expect(page.getByTestId("title")).toBeVisible();
    await expect(page.getByTestId("step")).toHaveText("step:agent");
  });

  test("invalid agent ID keeps Continue hidden; valid ID advances step", async ({ page }) => {
    const input = page.getByTestId("agent-id-input");

    // Continue button not yet rendered.
    await expect(page.getByTestId("agent-continue")).toHaveCount(0);

    // Invalid (too short): inline error appears, Continue still hidden.
    await input.fill("AG1");
    await expect(page.getByTestId("agent-error")).toBeVisible();
    await expect(page.getByTestId("agent-continue")).toHaveCount(0);

    // Valid agent ID (>=5 chars): error clears, Continue appears and is enabled.
    await input.fill("AGT-10234");
    await expect(page.getByTestId("agent-error")).toHaveCount(0);
    const cont = page.getByTestId("agent-continue");
    await expect(cont).toBeVisible();
    await expect(cont).toBeEnabled();

    // Click Continue → wizard advances to amount step.
    await cont.click();
    await expect(page.getByTestId("step")).toHaveText("step:amount");
    await expect(page.getByTestId("amount-heading")).toBeVisible();
    await expect(page.getByTestId("recipient-normalized")).toHaveText("AGT-10234");
  });
});
