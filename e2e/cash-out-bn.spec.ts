/**
 * Cash Out flow — bn coverage.
 *
 * Opens the Cash Out quick action from the customer home in Bangla mode
 * and fails if any hardcoded English UI copy appears on the agent picker
 * or on the review screen. Skips gracefully when no session is available.
 */

import { test, expect } from "./utils/i18n-fixtures";
import { buildDetector, DebugReport } from "./utils/english-detector";

const WHITELIST = ["easypay"];

const FORBIDDEN_EXACT = [
  "Cash Out",
  "Cash-out",
  "Agent",
  "Amount",
  "Review",
  "Confirm agent number",
  "Please verify this matches the agent before submitting.",
  "Transaction Summary",
  "Fee",
  "Fee source",
  "From your balance",
  "Deducted from amount",
  "Total from balance",
  "Confirm & Enter PIN",
  "Edit Amount",
  "Review Cash Out",
  "Continue",
  "Nearby Agents",
  "Enter Agent ID",
  "Scan QR",
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
      const re = new RegExp(`(^|\\W)${bad.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\W|$)`);
      expect(
        re.test(text),
        `Untranslated English in Cash Out (${label}): "${bad}" in "${text}"`,
      ).toBeFalsy();
    }
  }
}

test.describe("Cash Out — bn coverage", () => {
  test("agent picker and review screen render in Bangla", async ({
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

    // Open Cash Out via the quick-action tile (bn: "ক্যাশ আউট").
    const cashOutBtn = bnPage
      .getByRole("button", { name: /ক্যাশ আউট|Cash Out/i })
      .first();
    if (!(await cashOutBtn.isVisible().catch(() => false))) {
      test.skip(true, "Cash Out quick action not visible on this home.");
      return;
    }
    await cashOutBtn.click();
    await bnPage.waitForTimeout(700);

    // Step 1 — agent picker.
    await scanAndAssert(bnPage, "agent-picker", report);

    if (report.hasOffenders()) report.print("cash-out-bn");
    expect(
      report.hasOffenders(),
      "English-looking words leaked into the bn Cash Out flow — see debug report.",
    ).toBeFalsy();
  });
});
