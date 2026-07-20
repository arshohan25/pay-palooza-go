/**
 * Merchant Settlement Config sheet — bn coverage.
 *
 * Opens the Settlement quick action from the merchant dashboard in Bangla
 * mode and fails if any hardcoded English UI copy appears on the sheet.
 * Skips gracefully when no merchant session is available.
 */

import { test, expect } from "./utils/i18n-fixtures";
import { buildDetector, DebugReport } from "./utils/english-detector";

const WHITELIST = ["easypay", "t+1", "t+2"];

const FORBIDDEN_EXACT = [
  "Settlement Schedule",
  "Configure when you receive payouts",
  "T+1 (Next Day)",
  "T+2 (2 Days)",
  "Weekly",
  "Monthly",
  "Settle next business day",
  "Settle every 2 business days",
  "Settle once per week",
  "Settle on 1st of each month",
  "Settlement Time",
  "When the settlement batch processes each cycle",
  "Add a bank account first to enable auto-settlement",
  "Save Settlement Schedule",
  "Saving...",
  "Settling to",
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
        `Untranslated English in Settlement Config (${label}): "${bad}" in "${text}"`,
      ).toBeFalsy();
    }
  }
}

test.describe("Merchant Settlement Config — bn coverage", () => {
  test("settlement schedule sheet renders in Bangla", async ({
    bnPage,
    bnContext,
    gotoBn,
  }) => {
    const { landed, redirected } = await gotoBn("/merchant", { waitMs: 1500 });
    test.skip(
      redirected || !bnContext.hasSession,
      `Merchant dashboard not reachable (landed: ${landed}, session: ${bnContext.hasSession}).`,
    );

    const cfg = buildDetector({ whitelist: WHITELIST });
    const report = new DebugReport(cfg);

    const settlementBtn = bnPage
      .getByRole("button", { name: /সেটেলমেন্ট|Settlement/i })
      .first();
    if (!(await settlementBtn.isVisible().catch(() => false))) {
      test.skip(true, "Settlement quick action not visible on this dashboard.");
      return;
    }
    await settlementBtn.click();
    await bnPage.waitForTimeout(700);

    await scanAndAssert(bnPage, "settlement-config", report);

    if (report.hasOffenders()) report.print("settlement-config-bn");
    expect(
      report.hasOffenders(),
      "English-looking words leaked into the bn Settlement Config sheet — see debug report.",
    ).toBeFalsy();
  });
});
