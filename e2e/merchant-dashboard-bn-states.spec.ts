/**
 * Merchant Dashboard i18n=bn — empty state + chart/table render paths.
 *
 * Complements `merchant-dashboard-bn.spec.ts` by opening each tab in the
 * dashboard menu drawer and asserting the English-string detector passes
 * in every state:
 *   - loading skeleton
 *   - empty state (no data)
 *   - populated state (tables + Recharts SVGs mounted)
 *
 * Skips (does not fail) when no Supabase session is available, so the
 * spec stays useful in unauthenticated CI environments.
 */

import { test, expect, type Page } from "./utils/i18n-fixtures";
import { buildDetector, DebugReport } from "./utils/english-detector";

const MERCHANT_WHITELIST = [
  "merchant",
  "easypaymerchant",
  // recharts / svg internals sometimes surface these as aria labels
  "chart",
  "axis",
  "tooltip",
];

// Strings we specifically translated for the drawer tabs — hard-fail on any
// leak inside any tab's rendered content (empty OR populated).
const FORBIDDEN_EXACT = [
  "Loading",
  "Loading...",
  "No data",
  "No sales data",
  "No transactions",
  "No orders",
  "No products",
  "Total Revenue",
  "Success Rate",
  "Completed",
  "Pending",
  "Failed",
  "Expired",
  "Gross Sales",
  "Net Earnings",
  "Platform Fees",
  "Items Sold",
  "Top Products",
  "Daily Sessions",
  "Session Status",
  "Period",
  "Refunds",
  "Payouts",
  "Settlement",
  "Coupons",
  "Broadcast",
  "Notifications",
];

// Tabs to exercise. Each entry gives:
//   key       — for logging
//   openName  — regex matched against buttons in the drawer (bn OR en fallback)
const TABS: Array<{ key: string; openName: RegExp }> = [
  { key: "analytics",    openName: /বিশ্লেষণ|Analytics/i },
  { key: "transactions", openName: /ইতিহাস|লেনদেন|History/i },
  { key: "products",     openName: /পণ্য|Products/i },
  { key: "orders",       openName: /অর্ডার|Orders/i },
  { key: "settlements",  openName: /সেটেলমেন্ট|Settlement/i },
  { key: "refunds",      openName: /রিফান্ড|Refunds/i },
  { key: "payouts",      openName: /পেআউট|Payouts/i },
  { key: "coupons",      openName: /কুপন|Coupons/i },
  { key: "broadcast",    openName: /ব্রডকাস্ট|Broadcast/i },
  { key: "notifications",openName: /নোটিফিকেশন|Notifications/i },
];

async function collectVisibleText(
  page: Page,
): Promise<Array<{ ctx: string; text: string }>> {
  return await page.evaluate(() => {
    const out: Array<{ ctx: string; text: string }> = [];
    const nodes = document.body.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,button,a,span,p,li,label,th,td,[role='tab'],[role='row'],[role='cell']",
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

async function openDrawer(page: Page): Promise<boolean> {
  const btn = page
    .getByRole("button", { name: /আরও অপশন|More Options|menu/i })
    .first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.click();
  await page.waitForTimeout(500);
  return true;
}

async function scanTab(
  page: Page,
  key: string,
  report: DebugReport,
): Promise<void> {
  // Give the tab time to hit loading → empty/populated render path.
  await page.waitForTimeout(600);
  const beforeCount = report.hasOffenders();
  const samples = await collectVisibleText(page);
  for (const { ctx, text } of samples) {
    report.record(`${key}:${ctx}`, text);
    for (const bad of FORBIDDEN_EXACT) {
      expect(
        text.includes(bad),
        `Untranslated English in "${key}": "${bad}" in "${text}"`,
      ).toBeFalsy();
    }
  }
  // Wait a bit longer and re-scan so charts (Recharts) and tables that
  // mount asynchronously are also covered.
  await page.waitForTimeout(1200);
  const after = await collectVisibleText(page);
  for (const { ctx, text } of after) {
    report.record(`${key}:late:${ctx}`, text);
    for (const bad of FORBIDDEN_EXACT) {
      expect(
        text.includes(bad),
        `Untranslated English (late render) in "${key}": "${bad}" in "${text}"`,
      ).toBeFalsy();
    }
  }
  void beforeCount;
}

test.describe("Merchant Dashboard — bn empty + chart/table states", () => {
  test("every drawer tab renders without English leaks", async ({
    bnPage,
    bnContext,
    gotoBn,
  }) => {
    const { landed, redirected } = await gotoBn("/merchant", { waitMs: 1500 });
    test.skip(
      redirected || !bnContext.hasSession,
      `Merchant dashboard not reachable (landed: ${landed}, session: ${bnContext.hasSession}).`,
    );

    const cfg = buildDetector({ whitelist: MERCHANT_WHITELIST });
    const report = new DebugReport(cfg);

    for (const tab of TABS) {
      const opened = await openDrawer(bnPage);
      if (!opened) continue;

      const btn = bnPage.getByRole("button", { name: tab.openName }).first();
      if (!(await btn.isVisible().catch(() => false))) {
        // Tab may be feature-locked for this merchant — not a failure.
        // Close drawer via escape and continue.
        await bnPage.keyboard.press("Escape").catch(() => {});
        continue;
      }
      await btn.click();
      await scanTab(bnPage, tab.key, report);

      // Return to home so the next iteration can re-open the drawer.
      await bnPage.goto("/merchant", { waitUntil: "networkidle" });
      await bnPage.waitForTimeout(600);
    }

    if (report.hasOffenders()) {
      report.print("merchant-dashboard-bn-states");
    }
    expect(
      report.hasOffenders(),
      "English-looking words leaked into a bn merchant tab — see debug report above.",
    ).toBeFalsy();
  });
});
