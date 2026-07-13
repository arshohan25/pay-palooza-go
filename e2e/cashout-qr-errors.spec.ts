import { test, expect } from "@playwright/test";

/**
 * E2E: When a malformed or non-agent QR is scanned into Cash Out, the flow
 * must display the exact user-facing error message and MUST NOT advance
 * to the amount step. Drives /__test/cashout-qr-error-harness which mirrors
 * CashOutFlow.parseQrPayload + handleQrScan error surfacing 1:1.
 */

const QR_NOT_AGENT = "This QR is not an agent QR. Scan an agent QR to cash out.";
const QR_UNREADABLE = "Couldn't read this QR. Please try again or enter the Agent ID manually.";

const NON_AGENT_CASES: Array<{ label: string; payload: string; expected: string }> = [
  { label: "personal wallet id",          payload: "EZP-USER-ABCD",                                  expected: QR_NOT_AGENT },
  { label: "merchant wallet id",          payload: "EZP-MRCXX-ABCD",                                 expected: QR_NOT_AGENT },
  { label: "MRC merchant QR",             payload: "MRC-STORE-01",                                   expected: QR_NOT_AGENT },
  { label: "JSON merchant payload",       payload: '{"merchantId":"MRC-1234","name":"Shop"}',        expected: QR_NOT_AGENT },
  { label: "JSON personal wallet",        payload: '{"walletId":"EZP-USER-ZZZZ"}',                   expected: QR_NOT_AGENT },
  { label: "dynamic payment QR",          payload: '{"type":"easypay","sessionId":"abc","merchantId":"MRC-9"}', expected: QR_NOT_AGENT },
  { label: "URL merchant pay param",      payload: "https://easypay.app/x?pay=MRC-ABCD",             expected: QR_NOT_AGENT },
];

const MALFORMED_CASES: Array<{ label: string; payload: string }> = [
  { label: "random gibberish",     payload: "hello world 12345" },
  { label: "broken JSON",          payload: '{"walletId":' },
  { label: "empty-ish spaces",     payload: "     " },
  { label: "random URL no params", payload: "https://example.com/" },
];

test.describe("Cash Out QR errors — non-agent payloads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__test/cashout-qr-error-harness");
    await expect(page.getByTestId("title")).toBeVisible();
    await expect(page.getByTestId("step")).toHaveText("step:agent");
  });

  for (const { label, payload, expected } of NON_AGENT_CASES) {
    test(`shows "not an agent QR" error — ${label}`, async ({ page }) => {
      await page.getByTestId("qr-payload-input").fill(payload);
      await page.getByTestId("qr-scan-btn").click();

      await expect(page.getByTestId("qr-error")).toHaveText(expected);
      await expect(page.getByTestId("step")).toHaveText("step:agent");
      await expect(page.getByTestId("amount-panel")).toHaveCount(0);
    });
  }

  for (const { label, payload } of MALFORMED_CASES) {
    test(`malformed payload does not advance flow — ${label}`, async ({ page }) => {
      await page.getByTestId("qr-payload-input").fill(payload);
      await page.getByTestId("qr-scan-btn").click();

      const err = page.getByTestId("qr-error");
      await expect(err).toBeVisible();
      const text = (await err.textContent())?.trim() ?? "";
      expect([QR_NOT_AGENT, QR_UNREADABLE]).toContain(text);

      await expect(page.getByTestId("step")).toHaveText("step:agent");
      await expect(page.getByTestId("amount-panel")).toHaveCount(0);
    });
  }

  test("valid agent QR still advances (control case)", async ({ page }) => {
    await page.getByTestId("qr-payload-input").fill("EZP-AGNDH-RWGS");
    await page.getByTestId("qr-scan-btn").click();
    await expect(page.getByTestId("step")).toHaveText("step:amount");
    await expect(page.getByTestId("qr-error")).toHaveCount(0);
    await expect(page.getByTestId("amount-panel")).toBeVisible();
  });
});
