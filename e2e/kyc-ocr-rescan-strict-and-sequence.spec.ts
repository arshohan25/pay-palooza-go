import { test, expect, Page } from "@playwright/test";

/**
 * Runtime schema validator behavior + cancel→confirm rescan sequencing.
 *
 * Covers three regressions:
 *
 *   1. NON-STRICT MODE — invalid payloads are RECORDED on
 *      `window.__kycAnalyticsSchemaErrors` but must NOT throw, must NOT
 *      block subsequent tracking, and must NOT crash the app UI.
 *
 *   2. STRICT MODE — the thrown `KycAnalyticsSchemaError` message includes
 *      both the exact event name AND the specific missing/invalid field
 *      names, so a failing CI log is enough to debug.
 *
 *   3. CANCEL → CONFIRM SEQUENCE — a cancelled rescan followed by a
 *      confirmed rescan must:
 *        (a) flush suppression state at the confirmed start, so the
 *            second run's confidence events do NOT carry a leaked
 *            `sampled_count` from the first attempt, and
 *        (b) emit exactly one `kyc_ocr_run_end` summary — for the
 *            confirmed (second) run only.
 */

const HARNESS = "/__test/kyc-ocr-rescan-harness";

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

async function prime(page: Page, { strict }: { strict: boolean }) {
  await page.addInitScript(
    ({ strict }) => {
      (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
      (window as unknown as { __kycAnalyticsSchemaErrors: unknown[] })
        .__kycAnalyticsSchemaErrors = [];
      (window as unknown as { __kycAnalyticsStrict: boolean }).__kycAnalyticsStrict = strict;
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
async function readViolations(page: Page): Promise<SchemaViolation[]> {
  return (await page.evaluate(
    () =>
      (window as unknown as { __kycAnalyticsSchemaErrors?: SchemaViolation[] })
        .__kycAnalyticsSchemaErrors ?? [],
  )) as SchemaViolation[];
}
async function waitFor(page: Page, name: string, count = 1) {
  await expect
    .poll(async () => (await readEvents(page, name)).length, { timeout: 4000 })
    .toBeGreaterThanOrEqual(count);
}

test.describe("kycAnalytics runtime validator — non-strict mode", () => {
  test("invalid payloads are recorded but never throw or break the app", async ({ page }) => {
    await prime(page, { strict: false });

    const pageErrors: Error[] = [];
    page.on("pageerror", (e) => pageErrors.push(e));

    await page.goto(HARNESS);
    await waitFor(page, "kyc_ocr_confidence", 3);

    // Drive several intentionally-invalid payloads through the tracker.
    // All must be dropped into __kycAnalyticsSchemaErrors without throwing.
    const didThrow = await page.evaluate(() => {
      const track = (window as unknown as { __kycTrack?: (e: string, p: unknown) => void })
        .__kycTrack!;
      const attempts: Array<[string, unknown]> = [
        ["kyc_ocr_run_end", { side: "front" /* missing status/duration/confidences */ }],
        ["kyc_ocr_confidence", { side: "front", field: "father" /* missing level */ }],
        ["kyc_ocr_rescan_confirmed", { side: "front" /* reset must be true */ }],
        ["kyc_sheet_populated", { total: -1 }],
      ];
      let threw = false;
      for (const [ev, payload] of attempts) {
        try {
          track(ev, payload);
        } catch {
          threw = true;
        }
      }
      return threw;
    });

    expect(didThrow, "tracker must not throw in non-strict mode").toBe(false);
    expect(pageErrors, `page-error listener saw: ${pageErrors.map((e) => e.message).join(" | ")}`)
      .toHaveLength(0);

    const violations = await readViolations(page);
    expect(violations.length).toBeGreaterThanOrEqual(4);
    const byEvent = Object.fromEntries(violations.map((v) => [v.event, v]));
    expect(byEvent["kyc_ocr_run_end"]).toBeTruthy();
    expect(byEvent["kyc_ocr_confidence"]).toBeTruthy();
    expect(byEvent["kyc_ocr_rescan_confirmed"]).toBeTruthy();
    expect(byEvent["kyc_sheet_populated"]).toBeTruthy();

    // The app remained interactive — the rescan button still works and the
    // normal, valid confirmed→run_start→run_end pipeline still emits.
    page.on("dialog", (d) => d.accept());
    await page.getByTestId("rescan-btn").click();
    await waitFor(page, "kyc_ocr_rescan_confirmed");
    await waitFor(page, "kyc_ocr_run_end");
  });
});

test.describe("kycAnalytics runtime validator — strict mode error message", () => {
  test("thrown KycAnalyticsSchemaError names the event and every invalid field", async ({
    page,
  }) => {
    await prime(page, { strict: true });
    await page.goto(HARNESS);
    await waitFor(page, "kyc_ocr_confidence", 3);

    const err = await page.evaluate(() => {
      const track = (window as unknown as { __kycTrack?: (e: string, p: unknown) => void })
        .__kycTrack!;
      try {
        // Every field is either missing or invalid so we can assert on all
        // of them appearing in the message.
        track("kyc_ocr_run_end", {
          side: "sideways", // invalid enum
          status: "kinda-worked", // invalid enum
          duration_ms: -3, // negative
          // confidences: missing entirely (required when status === success,
          //   but status is invalid so we won't check confidences reasons here)
        });
        return null;
      } catch (e) {
        const anyErr = e as { name?: string; message?: string };
        return { name: anyErr.name ?? "", message: anyErr.message ?? "" };
      }
    });

    expect(err, "strict-mode invalid payload must throw").not.toBeNull();
    expect(err!.name).toBe("KycAnalyticsSchemaError");

    // Message must contain the event name literally.
    expect(err!.message).toContain("kyc_ocr_run_end");

    // …and each invalid-field reason.
    expect(err!.message).toMatch(/side/);
    expect(err!.message).toMatch(/status/);
    expect(err!.message).toMatch(/duration_ms/);
  });
});

test.describe("kycAnalytics — cancel then confirm rescan sequencing", () => {
  test("suppression counts don't leak across cancel→confirm and only the confirmed run emits summary", async ({
    page,
  }) => {
    await prime(page, { strict: true });
    await page.goto(HARNESS);
    await waitFor(page, "kyc_ocr_confidence", 3);

    // --- Phase 1: build up suppression on `mother`, then CANCEL rescan. ----
    page.on("dialog", (d) => d.dismiss());
    const mother = page.getByTestId("field-mother");
    await mother.focus();
    for (const ch of ["1", "2", "3", "4", "5"]) {
      await mother.press(ch, { delay: 20 });
    }
    await page.getByTestId("rescan-btn").click();
    await waitFor(page, "kyc_ocr_rescan_cancelled");
    expect(await readEvents(page, "kyc_ocr_run_start")).toHaveLength(0);
    expect(await readEvents(page, "kyc_ocr_run_end")).toHaveLength(0);

    const confAfterPhase1 = (await readEvents(page, "kyc_ocr_confidence")).length;

    // --- Phase 2: CONFIRM the next rescan. Switch dialog handler.  --------
    page.removeAllListeners("dialog");
    page.on("dialog", (d) => d.accept());

    await page.getByTestId("rescan-btn").click();
    await waitFor(page, "kyc_ocr_rescan_confirmed");
    await waitFor(page, "kyc_ocr_run_start");
    await waitFor(page, "kyc_ocr_run_end");

    // Exactly one summary emitted — for the confirmed run only.
    const runEnds = await readEvents(page, "kyc_ocr_run_end");
    expect(runEnds).toHaveLength(1);

    // The confirmed rescan called flushKycAnalytics(), so any confidence
    // event emitted AFTER the confirm must not carry the pre-cancel
    // mother-field sampled_count backlog.
    const postConfirm = (await readEvents(page, "kyc_ocr_confidence")).slice(confAfterPhase1);
    for (const ev of postConfirm) {
      if (ev.field === "mother" && ev.sampled_count != null) {
        expect(
          Number(ev.sampled_count),
          `leaked pre-cancel sampled_count into confirmed run: ${JSON.stringify(ev)}`,
        ).toBe(0);
      }
    }

    // Ordering: cancelled precedes confirmed precedes summary.
    const seq = (await readEvents(page)).map((e) => e.event);
    const iCancel = seq.indexOf("kyc_ocr_rescan_cancelled");
    const iConfirm = seq.indexOf("kyc_ocr_rescan_confirmed");
    const iEnd = seq.indexOf("kyc_ocr_run_end");
    expect(iCancel).toBeGreaterThanOrEqual(0);
    expect(iConfirm).toBeGreaterThan(iCancel);
    expect(iEnd).toBeGreaterThan(iConfirm);

    // Strict mode saw no schema violations across the whole sequence.
    expect(await readViolations(page)).toEqual([]);
  });
});
