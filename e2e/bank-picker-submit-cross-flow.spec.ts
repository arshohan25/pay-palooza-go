/**
 * End-to-end: open the bank picker in each flow (customer, agent, merchant),
 * select a bank, click submit, and verify the flow accepted the choice.
 *
 * Uses the shared `/__test/bank-picker-harness` route so we exercise the
 * same `usePlatformBanks` hook + shadcn Select that the real customer,
 * agent, and merchant bank flows render. Supabase REST is stubbed so the
 * test is deterministic and independent of live data.
 */
import { test, expect, type Request } from "@playwright/test";

const FIXTURE_BANKS = [
  { id: "bank-a", name: "Alpha Bank", short_code: "ALPHA", sort_order: 1, is_active: true, is_default: false, logo_url: null },
  { id: "bank-b", name: "Bravo Bank", short_code: "BRAVO", sort_order: 2, is_active: true, is_default: true,  logo_url: null },
  { id: "bank-c", name: "Charlie Bank", short_code: "CHRL", sort_order: 3, is_active: true, is_default: false, logo_url: null },
];

const FLOWS = ["customer", "agent", "merchant"] as const;

test.describe("Bank picker submit — customer / agent / merchant", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/rest/v1/platform_banks*", async route => {
      const req: Request = route.request();
      if (req.method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-2/3" },
        body: JSON.stringify(FIXTURE_BANKS),
      });
    });
  });

  for (const flow of FLOWS) {
    test(`${flow} flow: open picker, select bank, submit`, async ({ page }) => {
      await page.goto("/__test/bank-picker-harness");
      await expect(page.getByTestId("bank-picker-harness")).toBeVisible();
      await expect(page.getByTestId(`bank-list-${flow}`).locator("> li")).toHaveCount(FIXTURE_BANKS.length);

      // Open the picker.
      const trigger = page.getByTestId(`picker-trigger-${flow}`);
      await expect(trigger).toBeVisible();
      await trigger.click();

      // Pick a non-default bank to prove selection changes state.
      const target = FIXTURE_BANKS[2]; // Charlie Bank
      await page.getByTestId(`picker-option-${flow}-${target.id}`).click();
      await expect(trigger).toContainText(target.name);

      // Submit the flow.
      const submit = page.getByTestId(`picker-submit-${flow}`);
      await expect(submit).toBeEnabled();
      await submit.click();

      // Confirm the flow recorded the submitted bank.
      const result = page.getByTestId(`picker-result-${flow}`);
      await expect(result).toBeVisible();
      await expect(result).toHaveAttribute("data-submitted-bank-id", target.id);
      await expect(result).toHaveAttribute("data-submitted-bank-name", target.name);
      await expect(result).toContainText(target.name);
    });
  }
});
