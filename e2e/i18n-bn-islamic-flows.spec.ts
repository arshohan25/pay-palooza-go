import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  buildDetector,
  DebugReport,
  type DetectorConfig,
} from "./utils/english-detector";

/**
 * End-to-end check that every Islamic flow renders in Bangla when
 * lang=bn is set. Asserts no English words appear in visible headings,
 * tabs, buttons, toasts, or form validation messages.
 *
 * The English detector is configurable via env (see
 * e2e/utils/english-detector.ts):
 *   I18N_BN_WHITELIST            extra whole-word allow-list
 *   I18N_BN_IGNORE_PATTERNS      extra regex sources stripped pre-scan
 *   I18N_BN_WORD_PATTERN         override the "what is a word" regex
 *   I18N_BN_MIN_WORD_LEN         minimum token length to flag (default 3)
 *   I18N_BN_DEBUG=1              print per-text trace + offender summary
 *
 * Numeric formats (IDs, prices, dates, phones, UUIDs, JWTs, URLs) and
 * user-specific tokens (#ORDER-123, TXN_…, file paths) are stripped
 * before the scan so they don't masquerade as English copy.
 */

const ROUTES: Array<{ path: string; name: string }> = [
  { path: "/savings", name: "Islamic Savings" },
  { path: "/donations", name: "Donations" },
  { path: "/loan", name: "Qard Hasan Loan" },
  { path: "/giftcards", name: "Gift Cards" },
];

const detector: DetectorConfig = buildDetector();

async function setBangla(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("mfs_ui_lang", "bn");
      window.localStorage.setItem("mfs_onboarding_completed", "1");
      window.localStorage.setItem("mfs_has_authenticated", "1");
    } catch {
      /* ignore */
    }
  });
}

async function seedSession(page: Page) {
  const key =
    process.env.E2E_SUPABASE_STORAGE_KEY ??
    process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session =
    process.env.E2E_SUPABASE_SESSION_JSON ??
    process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!key || !session) return false;
  await page.addInitScript(
    ([k, v]) => {
      try {
        window.localStorage.setItem(k as string, v as string);
      } catch {
        /* ignore */
      }
    },
    [key, session],
  );
  return true;
}

async function freezeUi(page: Page) {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}`,
  });
}

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
    test(`${name} (${path}) renders fully in Bangla`, async ({ page }, testInfo) => {
      await setBangla(page);
      const hasSession = await seedSession(page);
      const report = new DebugReport(detector);

      const consoleMissing: string[] = [];
      page.on("console", (msg) => {
        const t = msg.text();
        if (/missing translation|⟦.*⟧/i.test(t)) consoleMissing.push(t);
      });

      await page.goto(path, { waitUntil: "networkidle" });
      await freezeUi(page);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);

      const landed = new URL(page.url()).pathname;
      if (landed !== path) {
        test.skip(
          true,
          `[${name}] route ${path} redirected to ${landed}` +
            (hasSession
              ? " despite seeded session (device binding / KYC likely required)."
              : "; set E2E_SUPABASE_STORAGE_KEY + E2E_SUPABASE_SESSION_JSON to run."),
        );
        return;
      }

      try {
        const fallbackCount = await page.locator("text=/⟦.*⟧/").count();
        expect(
          fallbackCount,
          `[${name}] no ⟦missing-key⟧ fallbacks should render`,
        ).toBe(0);

        assertNoEnglish(
          report,
          name,
          "headings (h1–h4)",
          await collectVisibleText(page.locator("h1, h2, h3, h4")),
        );

        assertNoEnglish(
          report,
          name,
          "tabs",
          await collectVisibleText(
            page.locator('[role="tab"], [data-state][data-orientation] [role="tab"]'),
          ),
        );

        assertNoEnglish(
          report,
          name,
          "buttons",
          await collectVisibleText(page.locator('button, [role="button"]')),
        );

        assertNoEnglish(
          report,
          name,
          "labels",
          await collectVisibleText(page.locator("label")),
        );

        const placeholders = await page
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
            page.locator('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]'),
          ),
        );

        assertNoEnglish(
          report,
          name,
          "toasts",
          await collectVisibleText(
            page.locator('[data-sonner-toast], [role="status"] li, .toaster li'),
          ),
        );

        expect(
          consoleMissing,
          `[${name}] no missing-translation console warnings`,
        ).toEqual([]);
      } finally {
        // Always print when debug mode is on; print on failure even if
        // debug is off so CI logs surface triage info automatically.
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
