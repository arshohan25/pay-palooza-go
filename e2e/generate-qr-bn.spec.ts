import { test, expect } from "@playwright/test";
import { scanForEnglish } from "./helpers/english-detector";

const FORBIDDEN = [
  "Generate Payment QR",
  "Generate QR",
  "Reference (optional)",
  "Payment QR Ready",
  "Copy Payment Link",
  "Open in New Tab",
  "Accepted Here",
  "Merchant Details",
  "Merchant ID",
  "Business",
  "Category",
  "MDR Rate",
  "Trade License",
  "Share",
  "Print",
  "Copy",
];

test.describe("Generate QR — বাংলা", () => {
  test("Generate QR sheet + QR tab render fully in Bangla", async ({ page }) => {
    await page.goto("http://localhost:8080/merchant");
    await page.evaluate(() => localStorage.setItem("ep_lang", "bn"));
    await page.reload();

    // Bail if not authenticated (no merchant session)
    if (page.url().includes("/merchant/login")) test.skip(true, "no merchant session");

    // Open QR generate sheet
    const genBtn = page.getByRole("button", { name: /কিউআর তৈরি/ }).first();
    if (await genBtn.isVisible().catch(() => false)) {
      await genBtn.click();
      await page.waitForTimeout(400);
      const sheetLeaks = await scanForEnglish(page, FORBIDDEN);
      expect(sheetLeaks, `Sheet leaked English: ${sheetLeaks.join(", ")}`).toHaveLength(0);
      await page.keyboard.press("Escape");
    }

    // Navigate to QR tab if it exists in drawer
    const qrTab = page.getByRole("button", { name: /কিউআর/ }).first();
    if (await qrTab.isVisible().catch(() => false)) {
      await qrTab.click();
      await page.waitForTimeout(600);
      const tabLeaks = await scanForEnglish(page, FORBIDDEN);
      expect(tabLeaks, `QR tab leaked English: ${tabLeaks.join(", ")}`).toHaveLength(0);
    }
  });
});
