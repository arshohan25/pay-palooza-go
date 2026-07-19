import { test, expect, Page } from "@playwright/test";

/**
 * Cancel-path + strict summary-schema regression for KYC OCR analytics.
 *
 * These specs pair with `kyc-ocr-rescan-analytics.spec.ts` and prove two
 * behaviors that are easy to regress silently:
 *
 *   A. Cancelling a rescan MUST NOT flush the per-field
 *      throttle/sample suppression state — the tracker only calls
 *      `flushKycAnalytics()` from the CONFIRMED branch of `handleRescan`.
 *      So a cancelled rescan should leave any accumulated `sampled_count`
 *      intact and produce it on the next eligible emit, and must emit
 *      neither `kyc_ocr_run_start` nor `kyc_ocr_run_end`.
 *
 *   B. The final `kyc_ocr_run_end` summary payload MUST match a strict
 *      schema — exact field names, value shapes, and enum membership —
 *      not just "some object is present". We enforce this both against a
 *      hand-rolled schema in the test and against the in-app runtime
 *      validator via `window.__kycAnalyticsStrict = true`.
 */

const HARNESS = "/__test/kyc-ocr-rescan-harness";
const LEVEL_ENUM = ["high", "medium", "low", "none"] as const;

interface DataLayerEntry {
  event: string;
  ts?: number;
  [key: string]: unknown;
}

interface SchemaViolation {
  event: string;
  reasons: string[];
  payload: Record<string, unknown>;
  ts: number;
}

async function primeHarness(page: Page, { strict = true }: { strict?: boolean } = {}) {
  await page.addInitScript(
    ({ strict }) => {
      (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
      (window as unknown as { __kycAnalyticsSchemaErrors: unknown[] })
        .__kycAnalyticsSchemaErrors = [];
      (window as unknown as { __kycAnalyticsStrict: boolean }).__kycAnalyticsStrict = !!strict;
      // Deterministic sampling: always pass the `Math.random() > 0.25` gate.
      Math.random = () => 0;
    },
    { strict },
  );
}

async function readEvents(page: Page, name?: string): Promise<DataLayerEntry[]> {
  const all = (await page.evaluate(
    () => (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [],
  )) as DataLayerEntry[];
  return name ? all.filter((e) => e.event === name) : all;
}

async function readSchemaErrors(page: Page): Promise<SchemaViolation[]> {
  return (await page.evaluate(
    () =>
      (window as unknown as { __kycAnalyticsSchemaErrors?: SchemaViolation[] })
        .__kycAnalyticsSchemaErrors ?? [],
  )) as SchemaViolation[];
}

async function waitForEvent(page: Page, name: string, count = 1) {
  await expect
    .poll(async () => (await readEvents(page, name)).length, { timeout: 4000 })
    .toBeGreaterThanOrEqual(count);
}

test.describe("KYC OCR — cancel path preserves suppression + omits summary", () => {
  test.beforeEach(async ({ page }) => {
    await primeHarness(page);
    // Default: dismiss the native confirm() so `handleRescan` takes the
    // cancel branch.
    page.on("dialog", (d) => d.dismiss());
  });

  test("cancelled rescan does NOT flush sampled_count and emits no run_start/run_end", async ({
    page,
  }) => {
    await page.goto(HARNESS);
    await waitForEvent(page, "kyc_ocr_confidence", 3);

    // Build up throttled/suppressed events on the mother field. Each
    // keystroke that keeps the level the same is dedup-dropped; keystrokes
    // that would change level within 1.5s are throttle-dropped and bump
    // the suppression counter.
    const mother = page.getByTestId("field-mother");
    await mother.focus();
    for (const ch of ["1", "2", "3", "4", "5", "6"]) {
      await mother.press(ch, { delay: 20 });
    }

    const preCount = (await readEvents(page, "kyc_ocr_confidence")).length;

    // Cancel the rescan (dialog handler dismisses).
    await page.getByTestId("rescan-btn").click();
    await waitForEvent(page, "kyc_ocr_rescan_cancelled");

    // Neither the confirmed event nor either lifecycle bookend may have fired.
    expect(await readEvents(page, "kyc_ocr_rescan_confirmed")).toHaveLength(0);
    expect(await readEvents(page, "kyc_ocr_run_start")).toHaveLength(0);
    expect(await readEvents(page, "kyc_ocr_run_end")).toHaveLength(0);

    // Wait past the throttle window, then force a level change on the same
    // field. Because cancel did NOT flush suppression state, this emitted
    // event MUST carry a positive `sampled_count` from the pre-cancel backlog.
    await page.waitForTimeout(1700);
    await mother.press("a");
    await mother.press("b");
    await mother.press("c");

    await expect
      .poll(async () => (await readEvents(page, "kyc_ocr_confidence")).length)
      .toBeGreaterThan(preCount);

    const post = (await readEvents(page, "kyc_ocr_confidence")).slice(preCount);
    const flushEvent = post.find(
      (e) =>
        e.field === "mother" &&
        typeof e.sampled_count === "number" &&
        Number(e.sampled_count) > 0,
    );
    expect(
      flushEvent,
      `expected a post-cancel mother confidence event carrying a preserved sampled_count > 0; got ${JSON.stringify(post, null, 2)}`,
    ).toBeTruthy();

    // And no summary was ever emitted for this attempt.
    expect(await readEvents(page, "kyc_ocr_run_end")).toHaveLength(0);

    // Strict-mode runtime validator recorded no violations.
    expect(await readSchemaErrors(page)).toEqual([]);
  });
});

test.describe("KYC OCR — full-rescan summary payload matches strict schema", () => {
  test.beforeEach(async ({ page }) => {
    await primeHarness(page);
    page.on("dialog", (d) => d.accept());
  });

  test("run_end summary payload exactly matches expected structure", async ({ page }) => {
    await page.goto(HARNESS);
    await waitForEvent(page, "kyc_ocr_confidence", 3);

    await page.getByTestId("rescan-btn").click();
    await waitForEvent(page, "kyc_ocr_rescan_confirmed");
    await waitForEvent(page, "kyc_ocr_run_start");
    await waitForEvent(page, "kyc_ocr_run_end");

    const runEnd = (await readEvents(page, "kyc_ocr_run_end"))[0] as DataLayerEntry;

    // ---- Exact top-level field-name schema ---------------------------------
    const REQUIRED_KEYS = [
      "event",
      "side",
      "status",
      "duration_ms",
      "confidences",
      "ts",
    ].sort();
    const ALLOWED_EXTRA_KEYS = new Set<string>([]); // none permitted right now.

    const actualKeys = Object.keys(runEnd).sort();
    for (const k of REQUIRED_KEYS) {
      expect(actualKeys, `missing required key: ${k}`).toContain(k);
    }
    for (const k of actualKeys) {
      if (!REQUIRED_KEYS.includes(k) && !ALLOWED_EXTRA_KEYS.has(k)) {
        throw new Error(
          `unexpected key on run_end payload: "${k}" (full payload: ${JSON.stringify(runEnd)})`,
        );
      }
    }

    // ---- Value shape / enum membership -------------------------------------
    expect(runEnd.event).toBe("kyc_ocr_run_end");
    expect(runEnd.side).toBe("front");
    expect(runEnd.status).toBe("success");

    expect(typeof runEnd.duration_ms).toBe("number");
    expect(Number.isFinite(runEnd.duration_ms as number)).toBe(true);
    expect(Number(runEnd.duration_ms)).toBeGreaterThanOrEqual(0);
    // Harness sleeps 400ms — allow a generous ceiling for CI jitter.
    expect(Number(runEnd.duration_ms)).toBeLessThan(10_000);

    expect(typeof runEnd.ts).toBe("number");
    expect(Number.isFinite(runEnd.ts as number)).toBe(true);

    // ---- confidences sub-schema (exact keys + enum values) -----------------
    const confidences = runEnd.confidences as Record<string, unknown>;
    expect(confidences && typeof confidences).toBe("object");
    const CONF_KEYS = ["bn_name", "father", "mother"].sort();
    expect(Object.keys(confidences).sort()).toEqual(CONF_KEYS);
    for (const k of CONF_KEYS) {
      expect(
        LEVEL_ENUM,
        `confidences.${k} = ${String(confidences[k])} not in enum`,
      ).toContain(confidences[k]);
    }

    // ---- Explicitly-forbidden fields on this event -------------------------
    for (const forbidden of ["sampled_count", "field", "level", "reset", "error"]) {
      expect(forbidden in runEnd, `run_end must not carry "${forbidden}"`).toBe(false);
    }

    // ---- Runtime validator agrees ------------------------------------------
    expect(await readSchemaErrors(page)).toEqual([]);
  });
});
