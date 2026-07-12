import { test, expect } from "@playwright/test";

/**
 * E2E: Agent QR codes must ALWAYS route to Cash Out and NEVER to Send Money.
 *
 * Drives the dev-only /__test/qr-scan-router-harness page, which mirrors the
 * exact routing branch that src/pages/Index.tsx runs when QrScannerModal
 * returns a decoded string. The harness uses the shared parseQrData() —
 * driving it end-to-end in a real browser proves the parser + routing
 * contract holds against real QR payload strings.
 */

const AGENT_PAYLOADS: Array<{ label: string; payload: string; expectedId: string }> = [
  { label: "bare agent wallet id",       payload: "EZP-AGNDH-RWGS",                             expectedId: "EZP-AGNDH-RWGS" },
  { label: "lowercase agent wallet id",  payload: "ezp-agndh-rwgs",                             expectedId: "ezp-agndh-rwgs" },
  { label: "JSON walletId (agent)",      payload: '{"walletId":"EZP-AGNCT-ABCD","name":"Agent"}', expectedId: "EZP-AGNCT-ABCD" },
  { label: "JSON WALLETID upper",        payload: '{"WALLETID":"EZP-AGNBR-XYZW"}',              expectedId: "EZP-AGNBR-XYZW" },
  { label: "URL ?agentId=",              payload: "https://easypay.app/pay?agentId=EZP-AGNKH-QWER", expectedId: "EZP-AGNKH-QWER" },
  { label: "URL ?agentWallet=",          payload: "https://easypay.app/scan?agentWallet=EZP-AGNSY-ZXCV", expectedId: "EZP-AGNSY-ZXCV" },
];

test.describe("Agent QR → always Cash Out, never Send Money", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__test/qr-scan-router-harness");
    await expect(page.getByTestId("title")).toBeVisible();
    await expect(page.getByTestId("panel")).toHaveText("panel:none");
  });

  for (const { label, payload, expectedId } of AGENT_PAYLOADS) {
    test(`agent payload routes to Cash Out — ${label}`, async ({ page }) => {
      await page.getByTestId("qr-payload-input").fill(payload);
      await page.getByTestId("qr-scan-btn").click();

      // Cash Out panel appears with the extracted agent identifier.
      await expect(page.getByTestId("panel")).toHaveText("panel:cashout");
      await expect(page.getByTestId("cashout-panel")).toBeVisible();
      await expect(page.getByTestId("cashout-agent")).toHaveText(expectedId);

      // Send Money panel MUST NOT be rendered for any agent QR.
      await expect(page.getByTestId("sendmoney-panel")).toHaveCount(0);
    });
  }

  test("personal wallet QR routes to Send Money (control case)", async ({ page }) => {
    await page.getByTestId("qr-payload-input").fill("EZP-USER-ABCD");
    await page.getByTestId("qr-scan-btn").click();

    await expect(page.getByTestId("panel")).toHaveText("panel:sendmoney");
    await expect(page.getByTestId("sendmoney-panel")).toBeVisible();
    await expect(page.getByTestId("cashout-panel")).toHaveCount(0);
  });

  test("scanning agent QR after a personal QR still opens Cash Out only", async ({ page }) => {
    // First scan: personal → Send Money
    await page.getByTestId("qr-payload-input").fill("EZP-USER-ZZZZ");
    await page.getByTestId("qr-scan-btn").click();
    await expect(page.getByTestId("sendmoney-panel")).toBeVisible();

    // Second scan: agent → must switch to Cash Out and drop Send Money
    await page.getByTestId("qr-payload-input").fill("EZP-AGNDH-RWGS");
    await page.getByTestId("qr-scan-btn").click();

    await expect(page.getByTestId("panel")).toHaveText("panel:cashout");
    await expect(page.getByTestId("cashout-panel")).toBeVisible();
    await expect(page.getByTestId("sendmoney-panel")).toHaveCount(0);
  });
});
