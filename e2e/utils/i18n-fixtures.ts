/**
 * Reusable Playwright fixtures for i18n=bn end-to-end specs.
 *
 * Provides:
 *   - `bnPage`            a Page with `mfs_ui_lang=bn` seeded, onboarding
 *                         flags set, an optional Supabase session restored,
 *                         and UI animations frozen.
 *   - `bnContext`         metadata about whether a real session was seeded
 *                         and helpers to gate the test on auth.
 *   - `gotoBn(path)`      navigates to `path` and resolves to `{ landed,
 *                         redirected }` so specs can skip cleanly when the
 *                         app sends them to auth / onboarding.
 *   - `consoleMissing`    array auto-collecting "missing translation" /
 *                         "⟦key⟧" console output during the test.
 *
 * Usage:
 *
 *   import { test, expect } from "../utils/i18n-fixtures";
 *
 *   test("my route renders in bn", async ({ bnPage, gotoBn }) => {
 *     const { redirected, landed } = await gotoBn("/savings");
 *     test.skip(redirected, `redirected to ${landed}`);
 *     // ...assertions
 *   });
 *
 * Env vars consumed (see also english-detector.ts):
 *   E2E_SUPABASE_STORAGE_KEY           or LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
 *   E2E_SUPABASE_SESSION_JSON          or LOVABLE_BROWSER_SUPABASE_SESSION_JSON
 *   I18N_BN_FREEZE_ANIMATIONS=0        opt out of animation freezing
 *   I18N_BN_WAIT_AFTER_LOAD_MS         extra settle time after networkidle
 */

import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";

export interface BnSeedContext {
  /** True when a real Supabase session was injected. */
  hasSession: boolean;
  /** Storage key actually used, when known. */
  storageKey?: string;
}

export interface BnGotoResult {
  /** Path the browser actually landed on after navigation. */
  landed: string;
  /** True when the app bounced us away from the requested route. */
  redirected: boolean;
}

interface BnFixtures {
  bnContext: BnSeedContext;
  bnPage: Page;
  gotoBn: (path: string, opts?: { waitMs?: number }) => Promise<BnGotoResult>;
  consoleMissing: string[];
}

function resolveSession(): { key?: string; session?: string } {
  return {
    key:
      process.env.E2E_SUPABASE_STORAGE_KEY ??
      process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY,
    session:
      process.env.E2E_SUPABASE_SESSION_JSON ??
      process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON,
  };
}

/** Inject lang=bn + onboarding flags + (optional) Supabase session. */
async function seedStorage(context: BrowserContext): Promise<BnSeedContext> {
  const { key, session } = resolveSession();
  await context.addInitScript(
    ([sbKey, sbSession]) => {
      try {
        window.localStorage.setItem("mfs_ui_lang", "bn");
        window.localStorage.setItem("mfs_onboarding_completed", "1");
        window.localStorage.setItem("mfs_has_authenticated", "1");
        if (sbKey && sbSession) {
          window.localStorage.setItem(sbKey, sbSession);
        }
      } catch {
        /* ignore — privacy mode, etc. */
      }
    },
    [key ?? null, session ?? null] as const,
  );
  return { hasSession: Boolean(key && session), storageKey: key };
}

async function freezeUi(page: Page): Promise<void> {
  if (process.env.I18N_BN_FREEZE_ANIMATIONS === "0") return;
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}`,
  });
}

export const test = base.extend<BnFixtures>({
  // Build seed metadata once and inject the init script into the context.
  bnContext: async ({ context }, use) => {
    const seed = await seedStorage(context);
    await use(seed);
  },

  // consoleMissing must be set up before the page is used, so make `page`
  // depend on it implicitly via the bnPage fixture below.
  consoleMissing: async ({}, use) => {
    const buffer: string[] = [];
    await use(buffer);
  },

  bnPage: async ({ page, bnContext, consoleMissing }, use) => {
    void bnContext; // ensures init-script ran before any navigation
    page.on("console", (msg) => {
      const t = msg.text();
      if (/missing translation|⟦.*⟧/i.test(t)) consoleMissing.push(t);
    });
    await use(page);
  },

  gotoBn: async ({ bnPage }, use) => {
    const extraWait = Number(process.env.I18N_BN_WAIT_AFTER_LOAD_MS ?? 400);
    const fn = async (path: string, opts: { waitMs?: number } = {}) => {
      await bnPage.goto(path, { waitUntil: "networkidle" });
      await freezeUi(bnPage);
      await bnPage.waitForLoadState("networkidle");
      await bnPage.waitForTimeout(opts.waitMs ?? extraWait);
      const landed = new URL(bnPage.url()).pathname;
      return { landed, redirected: landed !== path };
    };
    await use(fn);
  },
});

export { expect };
