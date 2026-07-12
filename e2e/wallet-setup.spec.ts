import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the wallet-ID setup flow shared by agent
 * onboarding, merchant application, and personal-user signup.
 *
 * Drives the dev-only `/__test/wallet-setup-harness` page, which mounts the
 * production `generateWalletId` / `validateWalletId` / `KNOWN_ROUTE_CODES`
 * primitives — the same code paths that back `DistributorCreateAgent` and
 * `MerchantApplicationFlow`.
 *
 * We assert three things end-to-end:
 *   1. Agent: picking a valid district route code produces an
 *      `EZP-AGN{RR}-XXXX` wallet ID and the "next step" button unlocks.
 *   2. Merchant application: the picked `route_code` is persisted alongside
 *      the merchant wallet ID (mirrors the merchant_applications insert),
 *      and validation passes.
 *   3. User: no district picker is rendered, no `route_code` is stored,
 *      and validation still succeeds — proving route-code rules apply only
 *      to agents/merchants, not personal users.
 */

const HARNESS = "/__test/wallet-setup-harness";

test.describe("wallet setup — E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await expect(page.getByTestId("title")).toBeVisible();
  });

  test("agent: valid district route code → wallet ID generated → next step enabled", async ({ page }) => {
    await page.getByTestId("role").selectOption("agent");

    // District picker is visible for agents.
    await expect(page.getByTestId("district-picker")).toBeVisible();
    await page.getByTestId("route").selectOption("DH");

    // Before submit there is no "next-step" affordance yet.
    await expect(page.getByTestId("next-step")).toHaveCount(0);

    await page.getByTestId("submit").click();

    // Wallet ID follows EZP-AGN{RR}-XXXX with the picked route code baked in.
    const saved = await page.getByTestId("saved").textContent();
    const parsed = JSON.parse(saved ?? "{}");
    expect(parsed.role).toBe("agent");
    expect(parsed.route_code).toBe("DH");
    expect(parsed.walletId).toMatch(/^EZP-AGNDH-[A-Z]{4}$/);
    expect(parsed.validationOk).toBe(true);
    expect(parsed.validationReason).toBeNull();

    // Next step unlocks.
    await expect(page.getByTestId("next-status")).toHaveText("ready");
    await expect(page.getByTestId("next-step")).toBeEnabled();
  });

  test("agent: unknown district route code (ZZ) blocks the next step", async ({ page }) => {
    await page.getByTestId("role").selectOption("agent");
    await page.getByTestId("route").selectOption("ZZ");
    await page.getByTestId("submit").click();

    const parsed = JSON.parse((await page.getByTestId("saved").textContent()) ?? "{}");
    expect(parsed.walletId).toMatch(/^EZP-AGNZZ-[A-Z]{4}$/);
    expect(parsed.validationOk).toBe(false);
    expect(parsed.validationReason).toBe("unknown_route");

    await expect(page.getByTestId("next-status")).toHaveText("blocked");
    await expect(page.getByTestId("next-step")).toBeDisabled();
  });

  test("merchant application: route_code is saved alongside the wallet ID", async ({ page }) => {
    await page.getByTestId("role").selectOption("merchant");
    await expect(page.getByTestId("district-picker")).toBeVisible();
    await page.getByTestId("route").selectOption("KH");

    await page.getByTestId("submit").click();

    const parsed = JSON.parse((await page.getByTestId("saved").textContent()) ?? "{}");

    // Matches what MerchantApplicationFlow inserts into merchant_applications:
    // { …, route_code: "KH" } paired with an EZP-MRC{RR}-XXXX wallet ID.
    expect(parsed.role).toBe("merchant");
    expect(parsed.route_code).toBe("KH");
    expect(parsed.walletId).toMatch(/^EZP-MRCKH-[A-Z]{4}$/);
    expect(parsed.validationOk).toBe(true);
    expect(parsed.validationReason).toBeNull();

    await expect(page.getByTestId("next-step")).toBeEnabled();
  });

  test("user: no district picker, no route_code saved, validation still succeeds", async ({ page }) => {
    await page.getByTestId("role").selectOption("user");

    // Personal wallets don't use a district route code — picker MUST be absent.
    await expect(page.getByTestId("district-picker")).toHaveCount(0);
    await expect(page.getByTestId("no-district")).toBeVisible();
    await expect(page.getByTestId("route")).toHaveCount(0);

    await page.getByTestId("submit").click();

    const parsed = JSON.parse((await page.getByTestId("saved").textContent()) ?? "{}");
    expect(parsed.role).toBe("user");
    expect(parsed.route_code).toBeNull();
    // Personal wallet shape: EZP-XXXX-XXXX (no AGN/MRC type prefix).
    expect(parsed.walletId).toMatch(/^EZP-(?!AGN[A-Z]{2}$)(?!MRC[A-Z]{2}$)[A-Z]{4}-[A-Z]{4}$/);
    // Route-code rules must NOT fire for personal users.
    expect(parsed.validationOk).toBe(true);
    expect(parsed.validationReason).toBeNull();

    await expect(page.getByTestId("next-status")).toHaveText("ready");
    await expect(page.getByTestId("next-step")).toBeEnabled();
  });
});
