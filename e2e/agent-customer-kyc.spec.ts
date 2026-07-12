import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the Customer KYC sheet inside the agent drawer.
 *
 * Drives the dev-only `/__test/agent-kyc-harness` page, which mounts the
 * exact same sheet DOM (test IDs, layout, loading/empty/populated states,
 * and Update-button refresh behavior) that AgentMenuDrawer renders in
 * production.
 *
 * Scenarios:
 *   1. Loading state renders skeleton while data is fetching.
 *   2. Empty state renders when no KYC records exist.
 *   3. Populated: opening drawer → tapping "Customer KYC" surfaces the
 *      correct Verified / Pending / Rejected counts and the latest
 *      rejection reason.
 *   4. Tapping "Update" closes the sheet, invokes the update action, and
 *      the status counts refresh after returning (rejected count drops,
 *      verified count rises).
 */

const HARNESS = "/__test/agent-kyc-harness";

test.describe("Agent — Customer KYC sheet (E2E)", () => {
  test("loading state renders skeleton while data is fetching", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=loading`);
    await page.getByTestId("open-kyc").click();

    const loading = page.getByTestId("customer-kyc-loading");
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("aria-busy", "true");

    // Real content is not shown yet.
    await expect(page.getByTestId("customer-kyc-content")).toHaveCount(0);
    await expect(page.getByTestId("customer-kyc-empty")).toHaveCount(0);
  });

  test("empty state renders when the agent has no KYC records", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=empty`);
    await page.getByTestId("open-kyc").click();

    await expect(page.getByTestId("customer-kyc-empty")).toBeVisible();
    await expect(page.getByText("No customers yet")).toBeVisible();
    await expect(page.getByTestId("customer-kyc-content")).toHaveCount(0);
    await expect(page.getByTestId("customer-kyc-loading")).toHaveCount(0);
  });

  test("populated: counts and latest rejection reason render correctly", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await page.getByTestId("open-kyc").click();

    // Content is visible (not loading, not empty).
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();

    // Fixture A: 2 verified, 1 pending, 2 rejected → total 5.
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("1");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("2");

    // Latest rejection reason strip renders the most recent rejection.
    const reason = page.getByTestId("kyc-latest-rejection-reason");
    await expect(reason).toBeVisible();
    await expect(reason).toHaveText("Address mismatch");
  });

  test("Update button closes the sheet and refreshes counts after returning", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await page.getByTestId("open-kyc").click();
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();

    await expect(page.getByTestId("harness-update-clicks")).toHaveText("0");
    await page.getByTestId("kyc-update-btn").click();

    // Update action fired.
    await expect(page.getByTestId("harness-update-clicks")).toHaveText("1");
    // Sheet closes.
    await expect(page.getByTestId("customer-kyc-sheet")).toHaveCount(0);

    // Simulated return from update triggers a refresh; harness swaps to fixture B
    // where one previously-rejected customer became verified.
    await expect(page.getByTestId("harness-refresh-count")).not.toHaveText("0");

    // Reopen the sheet and assert counts have refreshed.
    await page.getByTestId("open-kyc").click();
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("3");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("1");
    await expect(page.getByTestId("kyc-latest-rejection-reason")).toHaveText("Address mismatch");
  });
});
