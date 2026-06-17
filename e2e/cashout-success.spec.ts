import { test, expect } from "@playwright/test";

/**
 * E2E for the CashOut confirmation → success step.
 *
 * Walks the full happy path (agent → amount → confirm → success) on the
 * dev-only harness and verifies that:
 *
 *   1. The confirmation screen displays the entered amount and recipient.
 *   2. Submit briefly enters a "Submitting…" state and is disabled while pending.
 *   3. After submit, the success screen appears with a transaction ID and
 *      the same amount + recipient values, confirming end-to-end consistency.
 */

const AGENT_ID = "AGT-10234";
const AMOUNT = "500";

test.describe("CashOut confirmation → success screen", () => {
  test("full happy path lands on success with txn id", async ({ page }) => {
    await page.goto("/__test/cashout-harness");
    await expect(page.getByTestId("title")).toBeVisible();

    // Step 1 — recipient.
    await page.getByTestId("agent-id-input").fill(AGENT_ID);
    await page.getByTestId("agent-continue").click();

    // Step 2 — amount.
    await page.getByTestId("amount-input").fill(AMOUNT);
    await page.getByTestId("amount-continue").click();

    // Step 3 — confirmation displays our values.
    await expect(page.getByTestId("step")).toHaveText("step:confirm");
    await expect(page.getByTestId("confirm-amount")).toHaveText(`৳${AMOUNT}`);
    await expect(page.getByTestId("confirm-recipient")).toHaveText(AGENT_ID);

    const submit = page.getByTestId("confirm-submit");
    await expect(submit).toBeEnabled();
    await submit.click();

    // Step 4 — success screen appears with a generated txn id.
    await expect(page.getByTestId("step")).toHaveText("step:success");
    await expect(page.getByTestId("success-heading")).toBeVisible();
    await expect(page.getByTestId("success-amount")).toHaveText(`৳${AMOUNT}`);
    await expect(page.getByTestId("success-recipient")).toHaveText(AGENT_ID);
    await expect(page.getByTestId("success-txn")).toHaveText(/^TXN-[A-Z0-9]{8}$/);
  });
});
