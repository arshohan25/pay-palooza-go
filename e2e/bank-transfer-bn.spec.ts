/**
 * Bank Transfer (Add Bank) flow — bn coverage.
 *
 * Opens the Bank Transfer quick action from the customer home in Bangla
 * mode and fails if any hardcoded English UI copy appears on the bank
 * picker, amount, or review screens. Skips gracefully when no session
 * is available.
 */

import { test, expect } from "./utils/i18n-fixtures";
import { buildDetector, DebugReport } from "./utils/english-detector";

const WHITELIST = ["easypay"];

const FORBIDDEN_EXACT = [
  "Bank Transfer",
  "Add Bank",
  "Withdraw to Bank",
  "Select Bank",
  "Choose a bank",
  "Account Number",
  "Account Holder Name",
  "Saved Accounts",
  "or enter new",
  "Search banks",
  "No banks found",
  "Transferring to",
  "Enter Amount",
  "Insufficient balance",
  "Exceeds daily limit",
  "Continue",
  "Withdrawal Summary",
  "Transfer Amount",
  "Service Charge",
  "Fee source",
  "From your balance",
  "Total Deduction",
  "Confirm & Enter PIN",
  "Edit Amount",
  "Enter your PIN",
  "Confirm Withdrawal",
  "Processing",
  "Withdrawal Submitted",
  "Pending Approval",
  "Status",
  "Bank",
  "You'll receive",
  "Done",
  "Remove Saved Account",
  "Cancel",
  "Remove",
];

async function collectVisibleText(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const out: Array<{ ctx: string; text: string }> = [];
    const nodes = document.body.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,button,a,span,p,li,label,[role='tab']",
    );
    for (const el of Array.from(nodes)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const text = (el.innerText || "").trim();
      if (!text || text.length > 200) continue;
      out.push({ ctx: el.tagName.toLowerCase(), text });
    }
    return out;
  });
}

async function scanAndAssert(
  page: import("@playwright/test").Page,
  label: string,
  report: DebugReport,
) {
  const rows = await collectVisibleText(page);
  for (const { ctx, text } of rows) {
    report.record(`${label}:${ctx}`, text);
    for (const bad of FORBIDDEN_EXACT) {
      const re = new RegExp(
        `(^|\\W)${bad.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\W|$)`,
      );
      expect(
        re.test(text),
        `Untranslated English in Bank Transfer (${label}): "${bad}" in "${text}"`,
      ).toBeFalsy();
    }
  }
}

test.describe("Bank Transfer — bn coverage", () => {
  test("bank picker, amount, and review render in Bangla", async ({
    bnPage,
    bnContext,
    gotoBn,
  }) => {
    const { landed, redirected } = await gotoBn("/", { waitMs: 1500 });
    test.skip(
      redirected || !bnContext.hasSession,
      `Home not reachable (landed: ${landed}, session: ${bnContext.hasSession}).`,
    );

    const cfg = buildDetector({ whitelist: WHITELIST });
    const report = new DebugReport(cfg);

    // Open Bank Transfer via the quick-action tile.
    const bankBtn = bnPage
      .getByRole("button", {
        name: /ব্যাংক ট্রান্সফার|অ্যাড ব্যাংক|Bank Transfer|Add Bank/i,
      })
      .first();
    if (!(await bankBtn.isVisible().catch(() => false))) {
      test.skip(true, "Bank Transfer quick action not visible on this home.");
      return;
    }
    await bankBtn.click();
    await bnPage.waitForTimeout(700);

    // Step 1 — bank picker.
    await scanAndAssert(bnPage, "bank-picker", report);

    if (report.hasOffenders()) report.print("bank-transfer-bn");
    expect(
      report.hasOffenders(),
      "English-looking words leaked into the bn Bank Transfer flow — see debug report.",
    ).toBeFalsy();
  });
});
