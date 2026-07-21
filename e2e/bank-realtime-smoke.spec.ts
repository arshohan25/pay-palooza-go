/**
 * Bank realtime smoke test.
 *
 * Verifies that after an admin change to `platform_banks`, every dependent
 * flow (agent / customer / merchant) re-renders within a few seconds with the
 * new ordering, logos, and default flag — AND that each flow surfaces the
 * "updated live" badge so users get a visible confirmation.
 *
 * Realtime is simulated deterministically: the shared bank picker harness
 * (`/__test/bank-picker-harness`) uses the same `usePlatformBanks` hook that
 * every real flow uses, and the hook listens for the dev-only
 * `__banks:refetch` window event as a stand-in for a Supabase postgres
 * change. We swap the mocked REST response, dispatch the event, and assert
 * the UI catches up.
 *
 * Run just this spec:
 *   bunx playwright test e2e/bank-realtime-smoke.spec.ts
 */
import { test, expect } from "@playwright/test";

const FLOWS = ["customer", "agent", "merchant"] as const;

const BEFORE = [
  {
    id: "bank-a",
    name: "Alpha Bank",
    short_code: "ALPHA",
    sort_order: 1,
    is_active: true,
    is_default: true,
    logo_url: "https://example.test/logos/alpha.png",
  },
  {
    id: "bank-b",
    name: "Bravo Bank",
    short_code: "BRAVO",
    sort_order: 2,
    is_active: true,
    is_default: false,
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

// After the admin change:
//  - Charlie is promoted to #1 (reorder)
//  - Bravo gains a logo (logo change)
//  - Charlie becomes the default (default flag moved off Alpha)
const AFTER = [
  { ...BEFORE[2], sort_order: 1, is_default: true },
  {
    ...BEFORE[1],
    sort_order: 2,
    logo_url: "https://example.test/logos/bravo.png",
  },
  { ...BEFORE[0], sort_order: 3, is_default: false },
];

test.describe("Bank realtime — smoke", () => {
  test("all flows sync ordering, logos, and default within a few seconds and show the live badge", async ({
    page,
  }) => {
    let fixture = BEFORE;
    await page.route("**/rest/v1/platform_banks*", async (route) => {
      const req = route.request();
      if (req.method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": `0-${fixture.length - 1}/${fixture.length}` },
        body: JSON.stringify(fixture),
      });
    });

    await page.goto("/__test/bank-picker-harness");
    await expect(page.getByTestId("bank-picker-harness")).toBeVisible();

    // Baseline: initial ordering + Alpha marked default in every flow.
    for (const flow of FLOWS) {
      const names = await page
        .locator(`[data-testid="bank-list-${flow}"] > li`)
        .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.bankName));
      expect(names).toEqual(BEFORE.map((b) => b.name));
      await expect(
        page.locator(`[data-testid="bank-row-${flow}-bank-a"]`),
      ).toHaveAttribute("data-bank-default", "true");
    }

    // No live badge should be visible before any change.
    await expect(page.getByTestId("bank-live-badge")).toHaveCount(0);

    // Flip fixture and simulate a realtime broadcast.
    const start = Date.now();
    fixture = AFTER;
    await page.evaluate(() => {
      window.dispatchEvent(new Event("__banks:refetch"));
    });

    // Every flow must reflect Charlie at position 0 within ~3s of the event.
    for (const flow of FLOWS) {
      await expect
        .poll(
          async () =>
            page
              .locator(`[data-testid="bank-list-${flow}"] > li`)
              .first()
              .getAttribute("data-bank-name"),
          { timeout: 3000 },
        )
        .toBe("Charlie Bank");
    }
    const elapsed = Date.now() - start;
    expect(elapsed, "all flows should resync within 5s").toBeLessThan(5000);

    // Default flag moved to Charlie, cleared on Alpha, in every flow.
    for (const flow of FLOWS) {
      await expect(
        page.locator(`[data-testid="bank-row-${flow}-bank-c"]`),
      ).toHaveAttribute("data-bank-default", "true");
      await expect(
        page.locator(`[data-testid="bank-row-${flow}-bank-a"]`),
      ).toHaveAttribute("data-bank-default", "false");
      await expect(page.getByTestId(`default-marker-${flow}`)).toHaveCount(1);
    }

    // Bravo logo now renders as an image in every flow.
    for (const flow of FLOWS) {
      const bravo = page.locator(`[data-testid="bank-row-${flow}-bank-b"]`);
      await expect(bravo).toHaveAttribute("data-bank-has-logo", "true");
      await expect(bravo.locator("img")).toHaveAttribute(
        "src",
        "https://example.test/logos/bravo.png",
      );
    }

    // Live badge appears (harness renders one per flow + one in the header).
    const badges = page.getByTestId("bank-live-badge");
    await expect(badges.first()).toBeVisible();
    expect(await badges.count()).toBeGreaterThanOrEqual(FLOWS.length);
  });
});
