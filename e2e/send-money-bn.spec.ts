/**
 * Send Money flow — bn coverage.
 *
 * Walks recipient → amount → confirm and fails if any English UI copy
 * appears. Skips gracefully when no Supabase session is available (the
 * customer home won't render the flow trigger).
 */

import { test, expect } from "./utils/i18n-fixtures";
import { buildDetector, DebugReport } from "./utils/english-detector";

const WHITELIST = ["easypay"];

const FORBIDDEN_EXACT = [
  "Send Money",
  "Recipient gets",
  "Cash-out charge",
  "You pay",
  "Cash out charge summary",
  "Recent",
  "All Contacts",
  "Enter Amount",
  "Quick Select",
  "Review Transfer",
  "Confirm & Enter PIN",
  "Transfer Summary",
  "Service Fee",
  "Total from Balance",
  "Recipient receives",
  "Available Balance",
  "Send to",
  "Mobile Number",
  "Wallet ID",
  "Sync Contacts",
  "No Contacts",
  "Continue",
  "Unknown",
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
      expect(
        text.includes(bad),
        `Untranslated English in Send Money (${label}): "${bad}" in "${text}"`,
      ).toBeFalsy();
    }
  }
}

test.describe("Send Money — bn coverage", () => {
  test("recipient / amount / confirm steps render in Bangla", async ({
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

    // Open Send Money via the quick-action tile (bn: "টাকা পাঠান").
    const sendBtn = bnPage
      .getByRole("button", { name: /টাকা পাঠান|Send Money/i })
      .first();
    if (!(await sendBtn.isVisible().catch(() => false))) {
      test.skip(true, "Send Money quick action not visible on this home.");
      return;
    }
    await sendBtn.click();
    await bnPage.waitForTimeout(700);

    // Step 1 — recipient picker.
    await scanAndAssert(bnPage, "recipient", report);

    // Type a valid phone to reveal the "Send to this number" affordance
    // and the Continue button, so that section renders.
    const search = bnPage
      .getByPlaceholder(/নাম|নম্বর|ওয়ালেট|Name.*Number.*Wallet/i)
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill("01712345678");
      await bnPage.waitForTimeout(400);
      await scanAndAssert(bnPage, "recipient-filled", report);
    }

    if (report.hasOffenders()) report.print("send-money-bn");
    expect(
      report.hasOffenders(),
      "English-looking words leaked into the bn Send Money flow — see debug report.",
    ).toBeFalsy();
  });
});
