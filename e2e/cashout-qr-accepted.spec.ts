import { test, expect } from "@playwright/test";

/**
 * E2E: normalization/happy-path variants of the agent QR input. Any of these
 * pastes must land on the Amount step because the shared parser now
 * normalises phones (+880, spaces, hyphens) and hyphen-stripped wallet ids.
 * Uses the same harness as cashout-qr-errors.spec.ts.
 */

const AGENT_WALLET = "EZP-AGNDH-RWGS";

const ACCEPTED_VARIANTS: Array<{ label: string; payload: string }> = [
  { label: "bare wallet id",                payload: AGENT_WALLET },
  { label: "lowercase wallet id",           payload: AGENT_WALLET.toLowerCase() },
  { label: "hyphen-stripped wallet id",     payload: "EZPAGNDHRWGS" },
  { label: "wallet id with internal space", payload: "EZP -AGNDH- RWGS" },
  { label: "well-formed agent JSON",        payload: JSON.stringify({ type: "agent", flow: "cashout", walletId: AGENT_WALLET }) },
  { label: "URL ?agentId=",                 payload: `https://pay.easypay.app/cashout?agentId=${AGENT_WALLET}` },
  { label: "path /cashout/{wallet}",        payload: `https://pay.easypay.app/cashout/${AGENT_WALLET}` },
  { label: "truncated JSON tail",           payload: `{"type":"agent","walletId":"${AGENT_WALLET}` },
];

test.describe("Cash Out QR — accepted / normalised payloads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__test/cashout-qr-error-harness");
    await expect(page.getByTestId("step")).toHaveText("step:agent");
  });

  for (const { label, payload } of ACCEPTED_VARIANTS) {
    test(`advances to amount step — ${label}`, async ({ page }) => {
      await page.getByTestId("qr-payload-input").fill(payload);
      await page.getByTestId("qr-scan-btn").click();
      await expect(page.getByTestId("qr-error")).toHaveCount(0);
      await expect(page.getByTestId("step")).toHaveText("step:amount");
      await expect(page.getByTestId("amount-panel")).toBeVisible();
      await expect(page.getByTestId("agent-id")).toHaveText(`agent:${AGENT_WALLET}`);
    });
  }
});
