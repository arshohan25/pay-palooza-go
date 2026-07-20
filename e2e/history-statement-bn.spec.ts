import { test, expect } from "@playwright/test";
import { scanForEnglish } from "./helpers/english-detector";

const FORBIDDEN = [
  "Monthly",
  "Custom Range",
  "This Month",
  "Last Month",
  "From date",
  "To date",
  "Clear dates",
  "Transactions",
  "Incoming",
  "Outgoing",
  "PDF Statement",
  "CSV Export",
  "No transactions found",
  "Try a different search term",
  "Try selecting a different period",
  "PENDING",
  "FAILED",
  "Transaction Details",
  "Transaction ID",
  "Type",
  "From",
  "To",
  "Phone",
  "Date",
  "Reference",
  "Fee Breakdown",
  "Principal",
  "Total",
  "Balance after:",
];

test.describe("Merchant History / Statement — বাংলা", () => {
  test("History tab renders without English leaks", async ({ page }) => {
    await page.goto("http://localhost:8080/merchant");
    await page.evaluate(() => localStorage.setItem("ep_lang", "bn"));
    await page.reload();
    if (page.url().includes("/merchant/login")) test.skip(true, "no merchant session");

    // Try to open History tab via drawer or bottom-nav
    const historyBtn = page.getByRole("button", { name: /হিস্টরি|লেনদেন/ }).first();
    if (await historyBtn.isVisible().catch(() => false)) {
      await historyBtn.click();
      await page.waitForTimeout(600);
    }

    const leaks = await scanForEnglish(page, FORBIDDEN);
    expect(leaks, `History leaked English: ${leaks.join(", ")}`).toHaveLength(0);
  });
});
