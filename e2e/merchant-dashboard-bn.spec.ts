/**
 * Merchant Dashboard i18n=bn coverage.
 *
 * Fails if any English UI strings appear on:
 *   - the merchant home (tabs, hero, snapshot tiles, services grid)
 *   - the "More Options" drawer (menu items + descriptions)
 *
 * Auth is best-effort via `e2e/utils/i18n-fixtures`. When no Supabase
 * session is available (local dev), the merchant route redirects to
 * `/merchant-login`, so the spec skips instead of failing so it stays
 * useful in unauthenticated CI environments.
 */

import { test, expect } from "./utils/i18n-fixtures";
import {
  buildDetector,
  DebugReport,
} from "./utils/english-detector";

// Extra allow-list — proper nouns and merchant-specific brand tokens.
const MERCHANT_WHITELIST = [
  "merchant",
  "easypaymerchant",
];

// Strings we specifically translated this turn — hard-fail on any leak.
const FORBIDDEN_EXACT = [
  "More Options",
  "Store Settings",
  "Customize your storefront",
  "Analytics",
  "History",
  "QR Code",
  "API Integration",
  "Pay Links",
  "Settlement",
  "Fees & Charges",
  "Refunds",
  "Staff",
  "Customers",
  "Broadcast",
  "Coupons",
  "Payouts",
  "Notifications",
  "Overview",
  "Products",
  "Orders",
  "Logout",
  "active",
  "pending",
  "suspended",
];

async function collectVisibleText(page: import("@playwright/test").Page): Promise<
  Array<{ ctx: string; text: string }>
> {
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

test.describe("Merchant Dashboard — bn coverage", () => {
  test("home + menu drawer have no English UI copy", async ({
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

    // 1) Home view
    const home = await collectVisibleText(bnPage);
    for (const { ctx, text } of home) {
      report.record(`home:${ctx}`, text);
      for (const bad of FORBIDDEN_EXACT) {
        expect(
          text.includes(bad),
          `Untranslated English on merchant home: "${bad}" in "${text}"`,
        ).toBeFalsy();
      }
    }

    // 2) "More Options" drawer — open via the hamburger menu.
    const menuBtn = bnPage
      .getByRole("button", { name: /আরও অপশন|More Options|menu/i })
      .first();
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      await bnPage.waitForTimeout(600);

      const drawer = await collectVisibleText(bnPage);
      for (const { ctx, text } of drawer) {
        report.record(`drawer:${ctx}`, text);
        for (const bad of FORBIDDEN_EXACT) {
          expect(
            text.includes(bad),
            `Untranslated English in menu drawer: "${bad}" in "${text}"`,
          ).toBeFalsy();
        }
      }
    }

    if (report.hasOffenders()) {
      report.print("merchant-dashboard-bn");
    }
    expect(
      report.hasOffenders(),
      "English-looking words leaked into the bn merchant dashboard — see debug report above.",
    ).toBeFalsy();
  });
});
