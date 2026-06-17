import type { Locator } from "@playwright/test";
import { test, expect } from "./utils/i18n-fixtures";
import {
  buildDetector,
  DebugReport,
  type DetectorConfig,
} from "./utils/english-detector";

/**
 * End-to-end check that every Islamic flow renders in Bangla when
 * lang=bn is set. Uses the shared bnPage/gotoBn fixture so the seed
 * setup (lang flag, onboarding flags, optional Supabase session,
 * animation freeze, missing-translation console capture) stays
 * consistent across every i18n spec.
 *
 * Detector knobs live in e2e/utils/english-detector.ts.
 */

const ROUTES: Array<{ path: string; name: string }> = [
  { path: "/savings", name: "Islamic Savings" },
  { path: "/donations", name: "Donations" },
  { path: "/loan", name: "Qard Hasan Loan" },
  { path: "/giftcards", name: "Gift Cards" },
];

const detector: DetectorConfig = buildDetector();

async function collectVisibleText(locator: Locator): Promise<string[]> {
  const handles = await locator.elementHandles();
  const out: string[] = [];
  for (const h of handles) {
    const visible = await h.isVisible().catch(() => false);
    if (!visible) continue;
    const txt = (await h.textContent())?.trim() ?? "";
    if (txt) out.push(txt);
  }
  return out;
}

function assertNoEnglish(
  report: DebugReport,
  routeName: string,
  context: string,
  texts: string[],
) {
  const offenders: string[] = [];
  for (const raw of texts) {
    const result = report.record(`${routeName} › ${context}`, raw);
    if (result.offenders.length) {
      offenders.push(`"${raw.slice(0, 80)}" → [${result.offenders.join(", ")}]`);
    }
  }
  expect(
    offenders,
    `[${routeName}] ${context} should be fully Bangla. English found:\n  - ${offenders.join("\n  - ")}`,
  ).toEqual([]);
}

test.describe("i18n bn — Islamic flows have zero English in UI", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const { path, name } of ROUTES) {
    test(`${name} (${path}) renders fully in Bangla`, async (
      { bnPage, gotoBn, bnContext, consoleMissing },
      testInfo,
    ) => {
      const report = new DebugReport(detector);
      const { landed, redirected } = await gotoBn(path);
      if (redirected) {
        test.skip(
          true,
          `[${name}] route ${path} redirected to ${landed}` +
            (bnContext.hasSession
              ? " despite seeded session (device binding / KYC likely required)."
              : "; set E2E_SUPABASE_STORAGE_KEY + E2E_SUPABASE_SESSION_JSON to run."),
        );
        return;
      }

      try {
        const fallbackCount = await bnPage.locator("text=/⟦.*⟧/").count();
        expect(
          fallbackCount,
          `[${name}] no ⟦missing-key⟧ fallbacks should render`,
        ).toBe(0);

        assertNoEnglish(
          report,
          name,
          "headings (h1–h4)",
          await collectVisibleText(bnPage.locator("h1, h2, h3, h4")),
        );

        assertNoEnglish(
          report,
          name,
          "tabs",
          await collectVisibleText(
            bnPage.locator('[role="tab"], [data-state][data-orientation] [role="tab"]'),
          ),
        );

        assertNoEnglish(
          report,
          name,
          "buttons",
          await collectVisibleText(bnPage.locator('button, [role="button"]')),
        );

        assertNoEnglish(
          report,
          name,
          "labels",
          await collectVisibleText(bnPage.locator("label")),
        );

        const placeholders = await bnPage
          .locator("input[placeholder], textarea[placeholder]")
          .evaluateAll((els) =>
            (els as (HTMLInputElement | HTMLTextAreaElement)[])
              .filter((el) => el.offsetParent !== null)
              .map((el) => el.placeholder)
              .filter(Boolean),
          );
        assertNoEnglish(report, name, "placeholders", placeholders);

        assertNoEnglish(
          report,
          name,
          "aria-live regions",
          await collectVisibleText(
            bnPage.locator('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]'),
          ),
        );

        assertNoEnglish(
          report,
          name,
          "toasts",
          await collectVisibleText(
            bnPage.locator('[data-sonner-toast], [role="status"] li, .toaster li'),
          ),
        );

        expect(
          consoleMissing,
          `[${name}] no missing-translation console warnings`,
        ).toEqual([]);
      } finally {
        const failed = testInfo.errors.length > 0 || report.hasOffenders();
        if (detector.debug || failed) {
          const summary = report.format(`${name} (${path})`);
          // eslint-disable-next-line no-console
          console.log(summary);
          await testInfo.attach(`i18n-bn-report-${name}.txt`, {
            body: summary,
            contentType: "text/plain",
          });
        }
      }
    });
  }
});
