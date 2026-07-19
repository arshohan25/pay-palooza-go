import { test, expect } from "@playwright/test";

/**
 * E2E coverage for the KYC OCR "Rescan" flow:
 *
 *   1. Confirming the rescan prompt clears all OCR-dependent fields and
 *      shows the loading skeleton.
 *   2. The details step repopulates father / mother / BN name with the
 *      *new* OCR values once the async run resolves.
 *   3. Per-field confidence badges reflect the values received (BN name
 *      and father high, mother upgraded from medium → high on rescan).
 *   4. Cancelling the confirm dialog leaves the current fields intact.
 *
 * Driven through the dev-only `/__test/kyc-ocr-rescan-harness` page so
 * the spec does not depend on real camera capture, Supabase auth, or
 * the kyc-ocr edge function — while exercising the same confidence
 * helpers KycFlow uses in production.
 */
const HARNESS = "/__test/kyc-ocr-rescan-harness";

test.describe("KYC OCR — Rescan confirmation + confidence indicators", () => {
  test("rescan confirm clears fields, shows skeleton, then repopulates", async ({ page }) => {
    await page.goto(HARNESS);

    // Initial populated state.
    await expect(page.getByTestId("field-bn-name")).toHaveValue("তানভীর হাসান");
    await expect(page.getByTestId("field-father")).toHaveValue("Abdul Karim");
    await expect(page.getByTestId("field-mother")).toHaveValue("Ayesha");
    await expect(page.getByTestId("harness-run-count")).toHaveText("runs:1");

    // Accept the confirm() prompt fired by Rescan.
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("rescan-btn").click();

    // Skeleton is visible and inputs are gone while OCR re-runs.
    await expect(page.getByTestId("ocr-skeleton")).toBeVisible();
    await expect(page.getByTestId("ocr-skeleton")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("ocr-fields")).toHaveCount(0);

    // After OCR resolves, fields repopulate with the NEW rescan payload.
    await expect(page.getByTestId("ocr-skeleton")).toHaveCount(0);
    await expect(page.getByTestId("field-bn-name")).toHaveValue("মোঃ তানভীর হাসান");
    await expect(page.getByTestId("field-father")).toHaveValue("Abdul Karim Chowdhury");
    await expect(page.getByTestId("field-mother")).toHaveValue("Ayesha Begum");
    await expect(page.getByTestId("harness-run-count")).toHaveText("runs:2");
  });

  test("confidence badges reflect explicit + heuristic signals", async ({ page }) => {
    await page.goto(HARNESS);

    // Initial payload: BN name high (0.94), father high (0.9), mother medium (0.5).
    await expect(page.getByTestId("conf-bn-name")).toHaveText("high");
    await expect(page.getByTestId("conf-father")).toHaveText("high");
    await expect(page.getByTestId("conf-mother")).toHaveText("medium");

    // Rescan raises mother's provider confidence to 0.92 → high.
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("rescan-btn").click();
    await expect(page.getByTestId("ocr-skeleton")).toHaveCount(0);
    await expect(page.getByTestId("conf-mother")).toHaveText("high");
    await expect(page.getByTestId("conf-father")).toHaveText("high");
    await expect(page.getByTestId("conf-bn-name")).toHaveText("high");

    // Manually degrade the father value — the heuristic should downgrade it
    // even though the last OCR score was high, because the user has now
    // typed something clearly invalid (digits).
    const father = page.getByTestId("field-father");
    await father.fill("Ab 12");
    await expect(page.getByTestId("conf-father")).toHaveText("low");
  });

  test("cancelling the rescan confirm leaves fields untouched", async ({ page }) => {
    await page.goto(HARNESS);

    page.once("dialog", (d) => d.dismiss());
    await page.getByTestId("rescan-btn").click();

    // No skeleton, no new run — values unchanged.
    await expect(page.getByTestId("ocr-skeleton")).toHaveCount(0);
    await expect(page.getByTestId("field-bn-name")).toHaveValue("তানভীর হাসান");
    await expect(page.getByTestId("field-father")).toHaveValue("Abdul Karim");
    await expect(page.getByTestId("field-mother")).toHaveValue("Ayesha");
    await expect(page.getByTestId("harness-run-count")).toHaveText("runs:1");
  });
});
