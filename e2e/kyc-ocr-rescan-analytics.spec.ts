import { test, expect, Page } from "@playwright/test";

/**
 * Rescan-flow analytics regression.
 *
 * Verifies that during a rescan run the `kycAnalytics` tracker:
 *   1. Emits `kyc_ocr_rescan_confirmed` when the user accepts the confirm.
 *   2. Suppresses high-frequency `kyc_ocr_confidence` events via its dedup
 *      + 1.5s throttle + 25% sample rules, and later flushes the
 *      accumulated `sampled_count` on the next emitted event.
 *   3. Emits a final `kyc_ocr_run_end` summary carrying per-field
 *      confidences and a non-negative duration_ms.
 *
 * Determinism controls:
 *   - We prime `window.dataLayer` before any script runs.
 *   - We stub `Math.random` to always return 0 → the tracker's sample check
 *     (`Math.random() > 0.25`) always passes, so we're strictly exercising
 *     the dedup + throttle path and can reason about `sampled_count`.
 *   - We accept the native confirm() dialog via a `dialog` handler so the
 *     rescan proceeds.
 */

const HARNESS = "/__test/kyc-ocr-rescan-harness";

interface DataLayerEntry {
  event: string;
  [key: string]: unknown;
}

async function primeHarness(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
    // Force the tracker's sampling gate to always pass (0 > 0.25 === false).
    Math.random = () => 0;
  });
  page.on("dialog", (d) => d.accept());
}

async function readEvents(page: Page, name?: string): Promise<DataLayerEntry[]> {
  const all = (await page.evaluate(
    () => (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [],
  )) as DataLayerEntry[];
  return name ? all.filter((e) => e.event === name) : all;
}

async function waitForEvent(page: Page, name: string, count = 1) {
  await expect
    .poll(async () => (await readEvents(page, name)).length, { timeout: 4000 })
    .toBeGreaterThanOrEqual(count);
}

test.describe("KYC OCR rescan — analytics summary + suppressed-event flush", () => {
  test.beforeEach(async ({ page }) => {
    await primeHarness(page);
  });

  test("throttled confidence events flush their sampled_count on next emit", async ({ page }) => {
    await page.goto(HARNESS);
    // Initial confidence events for BN/father/mother fire on mount.
    await waitForEvent(page, "kyc_ocr_confidence", 3);

    const father = page.getByTestId("field-father");
    await father.focus();

    // Type six characters in rapid succession. Each keystroke re-derives
    // fatherConf and calls trackKycEvent, but the 1.5s min-interval
    // throttle should suppress every emission after the first —
    // subsequent identical-level dedups also drop silently.
    for (const ch of ["!", "@", "#", "$", "%", "^"]) {
      await father.press(ch, { delay: 20 });
    }

    // Wait past the throttle window so the next confidence change is eligible.
    await page.waitForTimeout(1700);

    // Force a *level change* on the father field so the tracker actually
    // emits again — this is the event that must carry sampled_count.
    // Digits in a Bangla-name field downgrade the heuristic level.
    await father.press("1");
    await father.press("2");
    await father.press("3");

    // Wait until at least one further emitted event beyond the initial three.
    await expect
      .poll(async () => (await readEvents(page, "kyc_ocr_confidence")).length)
      .toBeGreaterThan(3);

    const confEvents = await readEvents(page, "kyc_ocr_confidence");
    const flushEvent = confEvents.slice(3).find(
      (e) => e.field === "father" && typeof e.sampled_count === "number" && Number(e.sampled_count) > 0,
    );
    expect(
      flushEvent,
      `expected a follow-up father confidence event to carry a positive sampled_count; got ${JSON.stringify(confEvents.slice(3), null, 2)}`,
    ).toBeTruthy();
    expect(Number(flushEvent!.sampled_count)).toBeGreaterThanOrEqual(1);
    expect(flushEvent!.side).toBe("front");
  });

  test("rescan emits confirmed + run_start + run_end summary with confidences", async ({ page }) => {
    await page.goto(HARNESS);
    await waitForEvent(page, "kyc_ocr_confidence", 3);

    // Generate suppressed events on the mother field before rescanning so we
    // can also assert the rescan flush prevents them from bleeding into the
    // new run.
    const mother = page.getByTestId("field-mother");
    await mother.focus();
    for (const ch of ["1", "2", "3", "4", "5"]) {
      await mother.press(ch, { delay: 20 });
    }

    const confBeforeRescan = (await readEvents(page, "kyc_ocr_confidence")).length;

    await page.getByTestId("rescan-btn").click();

    // Confirmed event fires immediately on accept.
    await waitForEvent(page, "kyc_ocr_rescan_confirmed");
    const confirmed = (await readEvents(page, "kyc_ocr_rescan_confirmed"))[0];
    expect(confirmed.side).toBe("front");
    expect(confirmed.reset).toBe(true);

    // Cancelled event must NOT have fired on this run.
    expect(await readEvents(page, "kyc_ocr_rescan_cancelled")).toHaveLength(0);

    // run_start bookends the run.
    await waitForEvent(page, "kyc_ocr_run_start");

    // Final summary — run_end — carries per-field confidences and duration.
    await waitForEvent(page, "kyc_ocr_run_end");
    const runEnd = (await readEvents(page, "kyc_ocr_run_end"))[0];
    expect(runEnd.status).toBe("success");
    expect(typeof runEnd.duration_ms).toBe("number");
    expect(Number(runEnd.duration_ms)).toBeGreaterThanOrEqual(0);

    const confidences = runEnd.confidences as Record<string, string>;
    expect(confidences).toBeTruthy();
    expect(confidences.bn_name).toMatch(/^(high|medium|low|none)$/);
    expect(confidences.father).toMatch(/^(high|medium|low|none)$/);
    expect(confidences.mother).toMatch(/^(high|medium|low|none)$/);
    // Rescan payload uses strong provider confidences → each field is high.
    expect(confidences.bn_name).toBe("high");
    expect(confidences.father).toBe("high");
    expect(confidences.mother).toBe("high");

    // Event ordering: rescan_confirmed → run_start → run_end.
    const seq = (await readEvents(page)).map((e) => e.event);
    const iConfirmed = seq.indexOf("kyc_ocr_rescan_confirmed");
    const iStart = seq.indexOf("kyc_ocr_run_start");
    const iEnd = seq.lastIndexOf("kyc_ocr_run_end");
    expect(iConfirmed).toBeGreaterThanOrEqual(0);
    expect(iStart).toBeGreaterThan(iConfirmed);
    expect(iEnd).toBeGreaterThan(iStart);

    // Flush wiped per-field suppression counts — the first confidence event
    // emitted AFTER the run completes must not carry a leftover sampled_count
    // from the pre-rescan throttled backlog on the mother field.
    const postRescanMother = (await readEvents(page, "kyc_ocr_confidence"))
      .slice(confBeforeRescan)
      .find((e) => e.field === "mother");
    if (postRescanMother) {
      expect(postRescanMother.sampled_count ?? 0).toBe(0);
    }
  });

  test("cancelling the rescan emits only kyc_ocr_rescan_cancelled — no run_start/run_end", async ({ page }) => {
    // Override the accept-all handler with a reject-all one for this spec.
    page.removeAllListeners("dialog");
    page.on("dialog", (d) => d.dismiss());

    await page.goto(HARNESS);
    await waitForEvent(page, "kyc_ocr_confidence", 3);

    await page.getByTestId("rescan-btn").click();
    await waitForEvent(page, "kyc_ocr_rescan_cancelled");

    expect(await readEvents(page, "kyc_ocr_rescan_confirmed")).toHaveLength(0);
    expect(await readEvents(page, "kyc_ocr_run_start")).toHaveLength(0);
    expect(await readEvents(page, "kyc_ocr_run_end")).toHaveLength(0);
  });
});
