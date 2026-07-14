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
    // Inline success confirmation banner surfaces after the update.
    await expect(page.getByTestId("kyc-updated-banner")).toBeVisible();
    await expect(page.getByTestId("kyc-updated-banner")).toContainText(/updated successfully/i);
  });

  test("error state renders with a working Retry action", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=error`);
    await page.getByTestId("open-kyc").click();

    const errorBlock = page.getByTestId("customer-kyc-error");
    await expect(errorBlock).toBeVisible();
    await expect(errorBlock).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("kyc-error-message")).toContainText(/network/i);

    // Neither loading skeleton nor real content is shown while errored.
    await expect(page.getByTestId("customer-kyc-loading")).toHaveCount(0);
    await expect(page.getByTestId("customer-kyc-content")).toHaveCount(0);

    // Retry recovers → real content and correct counts appear.
    await page.getByTestId("kyc-retry-btn").click();
    await expect(page.getByTestId("customer-kyc-error")).toHaveCount(0);
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
  });

  test("switching agents never leaks the previous agent's counts or rejection reasons", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated&agent=A`);
    await page.getByTestId("open-kyc").click();
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();

    // Agent A snapshot: 2 verified, 1 pending, 2 rejected, latest reason "Address mismatch".
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("1");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-latest-rejection-reason")).toHaveText("Address mismatch");

    // Close sheet before interacting with the harness controls behind it.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("customer-kyc-sheet")).toHaveCount(0);

    // Switch to Agent B.
    await page.getByTestId("switch-agent-b").click();
    await expect(page.getByTestId("harness-agent")).toHaveText("B");

    // Reopen the sheet — DOM must reflect ONLY Agent B's dataset.
    await page.getByTestId("open-kyc").click();
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();
    await expect(page.getByTestId("kyc-total-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("0");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("1");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("1");

    // Agent A's rejection reasons must NOT appear anywhere in the sheet.
    const sheet = page.getByTestId("customer-kyc-sheet");
    await expect(sheet).not.toContainText("Blurry NID photo");
    await expect(sheet).not.toContainText("Address mismatch");
    await expect(sheet).not.toContainText("Alice");
    await expect(sheet).not.toContainText("Erin");

    // Agent B's own rejection reason IS shown.
    await expect(page.getByTestId("kyc-latest-rejection-reason")).toHaveText(
      "Selfie doesn't match NID",
    );

    // Switching back to A doesn't carry Agent B's rows over either.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("customer-kyc-sheet")).toHaveCount(0);
    await page.getByTestId("switch-agent-a").click();
    await expect(page.getByTestId("harness-agent")).toHaveText("A");
    await page.getByTestId("open-kyc").click();
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
    const sheetA = page.getByTestId("customer-kyc-sheet");
    await expect(sheetA).not.toContainText("Selfie doesn't match NID");
    await expect(sheetA).not.toContainText("Zed");
    await expect(sheetA).not.toContainText("Yara");
  });

  test("very long rejection reasons truncate by default and expand on tap", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${HARNESS}?fixture=long-reason`);
    await page.getByTestId("open-kyc").click();
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();

    const strip = page.getByTestId("kyc-latest-rejection");
    await expect(strip).toHaveAttribute("data-long", "true");
    await expect(strip).toHaveAttribute("data-expanded", "false");

    // Truncated form ends with an ellipsis and is bounded in height.
    const reason = page.getByTestId("kyc-latest-rejection-reason");
    const truncatedText = (await reason.textContent()) ?? "";
    expect(truncatedText.endsWith("…")).toBe(true);
    expect(truncatedText.length).toBeLessThan(160);

    // Full reason is preserved on the `title` attribute for hover/a11y.
    const fullReason = await reason.getAttribute("title");
    expect(fullReason && fullReason.length).toBeGreaterThan(160);

    // Truncated strip must be shorter than the fully expanded strip.
    const collapsedBox = await strip.boundingBox();

    // Toggle → expands to full text, ellipsis is gone.
    await page.getByTestId("kyc-rejection-toggle").click();
    await expect(strip).toHaveAttribute("data-expanded", "true");
    const expandedText = (await reason.textContent()) ?? "";
    expect(expandedText.endsWith("…")).toBe(false);
    expect(expandedText.length).toBeGreaterThan(truncatedText.length);

    const expandedBox = await strip.boundingBox();
    expect((expandedBox?.height ?? 0)).toBeGreaterThan((collapsedBox?.height ?? 0));

    // Toggle back → collapses again.
    await page.getByTestId("kyc-rejection-toggle").click();
    await expect(strip).toHaveAttribute("data-expanded", "false");
    const recollapsed = (await reason.textContent()) ?? "";
    expect(recollapsed.endsWith("…")).toBe(true);
  });
});

