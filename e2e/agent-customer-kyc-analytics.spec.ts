import { test, expect, Page } from "@playwright/test";

/**
 * Analytics regression: assert `kycAnalytics` fires the correct events for
 * every agent Customer-KYC sheet state transition (loading, populated,
 * empty, error, long-reason) and for each realtime `postgres_changes`
 * event (INSERT / UPDATE / DELETE).
 *
 * `trackKycEvent` fans out to `window.dataLayer`, so we prime a fresh
 * dataLayer on each page and inspect it after driving the harness.
 */

const HARNESS = "/__test/agent-kyc-harness";

interface DataLayerEntry {
  event: string;
  [key: string]: unknown;
}

async function primeDataLayer(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  });
}

async function readEvents(page: Page, name?: string): Promise<DataLayerEntry[]> {
  const all = (await page.evaluate(
    () => (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [],
  )) as DataLayerEntry[];
  return name ? all.filter((e) => e.event === name) : all;
}

async function waitForEvent(page: Page, name: string) {
  await expect
    .poll(async () => (await readEvents(page, name)).length, { timeout: 3000 })
    .toBeGreaterThan(0);
}

async function pushRealtime(
  page: Page,
  detail: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new?: Record<string, unknown>;
    old?: { user_id: string };
  },
) {
  await page.evaluate(
    (d) => window.dispatchEvent(new CustomEvent("kyc:realtime", { detail: d })),
    detail,
  );
}

test.describe("Agent Customer KYC — kycAnalytics event emissions", () => {
  test.beforeEach(async ({ page }) => {
    await primeDataLayer(page);
  });

  test("loading fixture emits kyc_sheet_loading but no populated/error", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=loading`);
    await page.getByTestId("open-kyc").click();
    await waitForEvent(page, "kyc_sheet_loading");

    const loading = await readEvents(page, "kyc_sheet_loading");
    expect(loading.length).toBeGreaterThan(0);
    expect(loading[0].source).toBe("fetch");

    expect(await readEvents(page, "kyc_sheet_populated")).toHaveLength(0);
    expect(await readEvents(page, "kyc_sheet_error")).toHaveLength(0);
  });

  test("empty fixture emits kyc_sheet_loading → kyc_sheet_empty", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=empty`);
    await page.getByTestId("open-kyc").click();
    await waitForEvent(page, "kyc_sheet_empty");

    const seq = (await readEvents(page)).map((e) => e.event);
    expect(seq).toContain("kyc_sheet_loading");
    expect(seq).toContain("kyc_sheet_empty");
    // loading precedes empty.
    expect(seq.indexOf("kyc_sheet_loading")).toBeLessThan(seq.indexOf("kyc_sheet_empty"));

    const empty = (await readEvents(page, "kyc_sheet_empty"))[0];
    expect(empty.total).toBe(0);
  });

  test("populated fixture emits kyc_sheet_populated with accurate counts", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await page.getByTestId("open-kyc").click();
    await waitForEvent(page, "kyc_sheet_populated");

    const populated = (await readEvents(page, "kyc_sheet_populated"))[0];
    expect(populated).toMatchObject({
      total: 5, verified: 2, pending: 1, rejected: 2, source: "fetch",
    });
    // No error was emitted on the happy path.
    expect(await readEvents(page, "kyc_sheet_error")).toHaveLength(0);
  });

  test("error fixture emits kyc_sheet_error, then Retry emits populated", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=error`);
    await page.getByTestId("open-kyc").click();
    await waitForEvent(page, "kyc_sheet_error");

    const err = (await readEvents(page, "kyc_sheet_error"))[0];
    expect(String(err.error)).toMatch(/network/i);

    // Populated must NOT have fired yet.
    expect(await readEvents(page, "kyc_sheet_populated")).toHaveLength(0);

    await page.getByTestId("kyc-retry-btn").click();
    await waitForEvent(page, "kyc_sheet_populated");

    const populated = (await readEvents(page, "kyc_sheet_populated"))[0];
    expect(populated.total).toBe(5);
    expect(populated.source).toBe("manual");
  });

  test("long-reason fixture emits kyc_sheet_long_reason with reason_length > 120", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${HARNESS}?fixture=long-reason`);
    await page.getByTestId("open-kyc").click();
    await waitForEvent(page, "kyc_sheet_long_reason");

    const long = (await readEvents(page, "kyc_sheet_long_reason"))[0];
    expect(typeof long.reason_length).toBe("number");
    expect(Number(long.reason_length)).toBeGreaterThan(120);

    // Populated event also fired alongside it.
    const populated = await readEvents(page, "kyc_sheet_populated");
    expect(populated.length).toBeGreaterThan(0);
  });

  test("realtime INSERT / UPDATE / DELETE each emit kyc_sheet_realtime with event_type", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await page.getByTestId("open-kyc").click();
    await waitForEvent(page, "kyc_sheet_populated");

    // INSERT
    await pushRealtime(page, {
      eventType: "INSERT",
      new: {
        user_id: "rt-1", name: "New", phone: "017", status: "pending",
        rejection_reason: null, updated_at: "2026-06-01T10:00:00Z",
      },
    });
    // UPDATE (Carol pending → verified)
    await pushRealtime(page, {
      eventType: "UPDATE",
      new: {
        user_id: "a3", name: "Carol", phone: "0170000003", status: "verified",
        rejection_reason: null, updated_at: "2026-06-02T10:00:00Z",
      },
    });
    // DELETE
    await pushRealtime(page, { eventType: "DELETE", old: { user_id: "a1" } });

    await expect
      .poll(async () => (await readEvents(page, "kyc_sheet_realtime")).length)
      .toBe(3);

    const realtimeEvents = await readEvents(page, "kyc_sheet_realtime");
    const types = realtimeEvents.map((e) => e.event_type);
    expect(types).toEqual(["INSERT", "UPDATE", "DELETE"]);
    for (const e of realtimeEvents) {
      expect(e.source).toBe("realtime");
    }

    // Realtime events must NOT re-trigger a fetch/loading cycle.
    const loadingCountBefore = (await readEvents(page, "kyc_sheet_loading")).length;
    await pushRealtime(page, { eventType: "DELETE", old: { user_id: "a2" } });
    const loadingCountAfter = (await readEvents(page, "kyc_sheet_loading")).length;
    expect(loadingCountAfter).toBe(loadingCountBefore);
  });
});
