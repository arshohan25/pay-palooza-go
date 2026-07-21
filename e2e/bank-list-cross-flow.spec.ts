/**
 * Bank ordering, logo rendering, and default flag — cross-flow contract.
 *
 * The customer bank-transfer, agent bank-transfer, and merchant bank-link
 * flows all consume the same `usePlatformBanks` hook. This spec renders the
 * shared bank picker harness (`/__test/bank-picker-harness`), which mirrors
 * that hook into three "flow" columns, and verifies:
 *
 *   1. Every flow shows banks in the admin-configured `sort_order`.
 *   2. Every flow renders the uploaded logo (or the color-code fallback)
 *      consistently.
 *   3. The admin-marked default bank surfaces as `data-bank-default="true"`
 *      in every flow — the source of the "auto-select for first-time users"
 *      behavior in the real screens.
 *
 * Supabase REST is stubbed so the test does not depend on live data.
 */
import { test, expect, type Request } from "@playwright/test";

const FIXTURE_BANKS = [
  {
    id: "bank-a",
    name: "Alpha Bank",
    short_code: "ALPHA",
    sort_order: 1,
    is_active: true,
    is_default: false,
    logo_url: "https://example.test/logos/alpha.png",
  },
  {
    id: "bank-b",
    name: "Bravo Bank",
    short_code: "BRAVO",
    sort_order: 2,
    is_active: true,
    is_default: true,
    logo_url: null,
  },
  {
    id: "bank-c",
    name: "Charlie Bank",
    short_code: "CHRL",
    sort_order: 3,
    is_active: true,
    is_default: false,
    logo_url: "https://example.test/logos/charlie.png",
  },
];

const FLOWS = ["customer", "agent", "merchant"] as const;

test.describe("Bank list — cross-flow ordering, logos, and default", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/rest/v1/platform_banks*", async (route) => {
      const req: Request = route.request();
      if (req.method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-2/3" },
        body: JSON.stringify(FIXTURE_BANKS),
      });
    });
  });

  test("every flow renders banks in the admin sort order", async ({ page }) => {
    await page.goto("/__test/bank-picker-harness");
    await expect(page.getByTestId("bank-picker-harness")).toBeVisible();

    for (const flow of FLOWS) {
      const rows = page.locator(`[data-testid="bank-list-${flow}"] > li`);
      await expect(rows).toHaveCount(FIXTURE_BANKS.length);
      const names = await rows.evaluateAll((els) =>
        els.map((el) => (el as HTMLElement).dataset.bankName),
      );
      expect(names).toEqual(FIXTURE_BANKS.map((b) => b.name));
    }
  });

  test("logo rendering is consistent across flows (image when uploaded, fallback otherwise)", async ({
    page,
  }) => {
    await page.goto("/__test/bank-picker-harness");
    await expect(page.getByTestId("bank-picker-harness")).toBeVisible();

    for (const flow of FLOWS) {
      for (const bank of FIXTURE_BANKS) {
        const row = page.locator(`[data-testid="bank-row-${flow}-${bank.id}"]`);
        await expect(row).toHaveAttribute(
          "data-bank-has-logo",
          bank.logo_url ? "true" : "false",
        );
        if (bank.logo_url) {
          const img = row.locator("img");
          await expect(img).toHaveAttribute("src", bank.logo_url);
          await expect(img).toHaveAttribute("alt", bank.name);
        } else {
          // Fallback avatar shows the first two characters of the short code.
          await expect(row).toContainText(bank.short_code.slice(0, 2));
        }
      }
    }
  });

  test("the admin-marked default bank surfaces in every flow", async ({ page }) => {
    await page.goto("/__test/bank-picker-harness");
    await expect(page.getByTestId("bank-picker-harness")).toBeVisible();

    const defaultBank = FIXTURE_BANKS.find((b) => b.is_default)!;
    for (const flow of FLOWS) {
      const marker = page.getByTestId(`default-marker-${flow}`);
      await expect(marker).toHaveCount(1);
      const row = page.locator(`[data-testid="bank-row-${flow}-${defaultBank.id}"]`);
      await expect(row).toHaveAttribute("data-bank-default", "true");
    }
  });
});
