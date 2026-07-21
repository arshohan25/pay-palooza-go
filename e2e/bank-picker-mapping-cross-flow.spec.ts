/**
 * End-to-end: verify bank picker mapping stays correct across customer,
 * agent, and merchant flows when selecting *different* banks (not only
 * Charlie Bank). Each flow selects a distinct bank, and we also loop
 * through every fixture bank per flow to prove id↔name mapping never
 * crosses wires.
 */
import { test, expect, type Request } from "@playwright/test";

const FIXTURE_BANKS = [
  { id: "bank-a", name: "Alpha Bank",   short_code: "ALPHA", sort_order: 1, is_active: true, is_default: false, logo_url: null },
  { id: "bank-b", name: "Bravo Bank",   short_code: "BRAVO", sort_order: 2, is_active: true, is_default: true,  logo_url: null },
  { id: "bank-c", name: "Charlie Bank", short_code: "CHRL",  sort_order: 3, is_active: true, is_default: false, logo_url: null },
  { id: "bank-d", name: "Delta Bank",   short_code: "DELTA", sort_order: 4, is_active: true, is_default: false, logo_url: null },
  { id: "bank-e", name: "Echo Bank",    short_code: "ECHO",  sort_order: 5, is_active: true, is_default: false, logo_url: null },
];

type FlowId = "customer" | "agent" | "merchant";

// Each flow picks a *different* bank to prove selections don't bleed across pickers.
const FLOW_SELECTIONS: Array<{ flow: FlowId; bankId: string }> = [
  { flow: "customer", bankId: "bank-a" }, // Alpha
  { flow: "agent",    bankId: "bank-d" }, // Delta
  { flow: "merchant", bankId: "bank-e" }, // Echo
];

test.describe("Bank picker mapping — varied selections across flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/rest/v1/platform_banks*", async route => {
      const req: Request = route.request();
      if (req.method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": `0-${FIXTURE_BANKS.length - 1}/${FIXTURE_BANKS.length}` },
        body: JSON.stringify(FIXTURE_BANKS),
      });
    });
  });

  test("each flow submits a different bank and the mapping is preserved", async ({ page }) => {
    await page.goto("/__test/bank-picker-harness");
    await expect(page.getByTestId("bank-picker-harness")).toBeVisible();

    for (const { flow, bankId } of FLOW_SELECTIONS) {
      const bank = FIXTURE_BANKS.find(b => b.id === bankId)!;
      await expect(page.getByTestId(`bank-list-${flow}`).locator("> li")).toHaveCount(FIXTURE_BANKS.length);

      await page.getByTestId(`picker-trigger-${flow}`).click();
      await page.getByTestId(`picker-option-${flow}-${bank.id}`).click();
      await expect(page.getByTestId(`picker-trigger-${flow}`)).toContainText(bank.name);

      await page.getByTestId(`picker-submit-${flow}`).click();

      const result = page.getByTestId(`picker-result-${flow}`);
      await expect(result).toBeVisible();
      await expect(result).toHaveAttribute("data-submitted-bank-id", bank.id);
      await expect(result).toHaveAttribute("data-submitted-bank-name", bank.name);
    }

    // Cross-check: each flow's result carries its own bank, not another flow's.
    for (const { flow, bankId } of FLOW_SELECTIONS) {
      const bank = FIXTURE_BANKS.find(b => b.id === bankId)!;
      const result = page.getByTestId(`picker-result-${flow}`);
      await expect(result).toHaveAttribute("data-submitted-bank-id", bank.id);
      await expect(result).toHaveAttribute("data-submitted-bank-name", bank.name);

      // And explicitly NOT any other flow's bank.
      for (const other of FLOW_SELECTIONS) {
        if (other.flow === flow) continue;
        const otherBank = FIXTURE_BANKS.find(b => b.id === other.bankId)!;
        await expect(result).not.toHaveAttribute("data-submitted-bank-id", otherBank.id);
      }
    }
  });

  // Exhaustive mapping check: for every flow, iterate every bank and confirm
  // the option's id maps to the correct name in the trigger + submit result.
  for (const flow of ["customer", "agent", "merchant"] as const) {
    test(`${flow} flow: id↔name mapping holds for every bank`, async ({ page }) => {
      await page.goto("/__test/bank-picker-harness");
      await expect(page.getByTestId("bank-picker-harness")).toBeVisible();

      for (const bank of FIXTURE_BANKS) {
        await page.getByTestId(`picker-trigger-${flow}`).click();
        await page.getByTestId(`picker-option-${flow}-${bank.id}`).click();
        await expect(page.getByTestId(`picker-trigger-${flow}`)).toContainText(bank.name);

        await page.getByTestId(`picker-submit-${flow}`).click();
        const result = page.getByTestId(`picker-result-${flow}`);
        await expect(result).toHaveAttribute("data-submitted-bank-id", bank.id);
        await expect(result).toHaveAttribute("data-submitted-bank-name", bank.name);
        await expect(result).toContainText(bank.name);
      }
    });
  }
});
