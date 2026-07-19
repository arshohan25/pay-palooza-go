import { test, expect, Page } from "@playwright/test";

/**
 * Regression coverage for the agent Customer KYC sheet.
 *
 * Two goals:
 *   1. Assert every visible state (loading, empty, populated, error, long
 *      rejection reason) renders the expected DOM contract.
 *   2. Prove that realtime `postgres_changes` events (INSERT / UPDATE /
 *      DELETE) mutate the counts and latest-rejection strip in place —
 *      no page reload, no manual refresh, no Update tap.
 *
 * Drives the dev-only `/__test/agent-kyc-harness` page, which mirrors the
 * exact DOM used by `AgentMenuDrawer`. Realtime events are injected via
 * `window.dispatchEvent(new CustomEvent('kyc:realtime', { detail: ... }))`,
 * matching the shape the Supabase `postgres_changes` subscription hands to
 * the drawer's callback.
 */

const HARNESS = "/__test/agent-kyc-harness";

async function openKyc(page: Page) {
  await page.getByTestId("open-kyc").click();
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

test.describe("Agent Customer KYC — full state regression", () => {
  test("loading state renders skeleton with aria-busy", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=loading`);
    await openKyc(page);

    const loading = page.getByTestId("customer-kyc-loading");
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("customer-kyc-content")).toHaveCount(0);
    await expect(page.getByTestId("customer-kyc-empty")).toHaveCount(0);
    await expect(page.getByTestId("customer-kyc-error")).toHaveCount(0);
  });

  test("empty state renders the zero-customers card", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=empty`);
    await openKyc(page);

    await expect(page.getByTestId("customer-kyc-empty")).toBeVisible();
    await expect(page.getByText("No customers yet")).toBeVisible();
    await expect(page.getByTestId("customer-kyc-content")).toHaveCount(0);
  });

  test("populated state renders correct counts + latest rejection reason", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await openKyc(page);

    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("1");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-latest-rejection-reason")).toHaveText("Address mismatch");
  });

  test("error state shows role=alert and Retry recovers into populated", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=error`);
    await openKyc(page);

    const err = page.getByTestId("customer-kyc-error");
    await expect(err).toBeVisible();
    await expect(err).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("kyc-error-message")).toContainText(/network/i);
    await expect(page.getByTestId("customer-kyc-content")).toHaveCount(0);

    await page.getByTestId("kyc-retry-btn").click();
    await expect(page.getByTestId("customer-kyc-error")).toHaveCount(0);
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
  });

  test("long rejection reason truncates + expands on toggle", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${HARNESS}?fixture=long-reason`);
    await openKyc(page);

    const strip = page.getByTestId("kyc-latest-rejection");
    await expect(strip).toHaveAttribute("data-long", "true");
    await expect(strip).toHaveAttribute("data-expanded", "false");

    const reason = page.getByTestId("kyc-latest-rejection-reason");
    const truncated = (await reason.textContent()) ?? "";
    expect(truncated.endsWith("…")).toBe(true);
    const full = await reason.getAttribute("title");
    expect((full ?? "").length).toBeGreaterThan(truncated.length);

    await page.getByTestId("kyc-rejection-toggle").click();
    await expect(strip).toHaveAttribute("data-expanded", "true");
    const expanded = (await reason.textContent()) ?? "";
    expect(expanded.endsWith("…")).toBe(false);
    expect(expanded.length).toBeGreaterThan(truncated.length);
  });
});

test.describe("Agent Customer KYC — realtime postgres_changes updates without refresh", () => {
  test("INSERT event bumps total + pending counts in place", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await openKyc(page);
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();

    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("1");

    // Snapshot the URL so we can prove no navigation / refresh happened.
    const urlBefore = page.url();

    await pushRealtime(page, {
      eventType: "INSERT",
      new: {
        user_id: "rt-new-1",
        name: "Realtime Newbie",
        phone: "0171111111",
        status: "pending",
        rejection_reason: null,
        updated_at: "2026-06-01T10:00:00Z",
      },
    });

    await expect(page.getByTestId("kyc-total-count")).toHaveText("6");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("2");
    // Other counts unchanged.
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("2");
    // No refresh occurred — same URL, sheet stayed open.
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByTestId("customer-kyc-sheet")).toBeVisible();
  });

  test("UPDATE event moves a customer from pending → verified live", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await openKyc(page);
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("2");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("1");

    // Carol (a3) is the pending customer in the initial fixture.
    await pushRealtime(page, {
      eventType: "UPDATE",
      new: {
        user_id: "a3",
        name: "Carol",
        phone: "0170000003",
        status: "verified",
        rejection_reason: null,
        updated_at: "2026-06-02T10:00:00Z",
      },
    });

    await expect(page.getByTestId("kyc-verified-count")).toHaveText("3");
    await expect(page.getByTestId("kyc-pending-count")).toHaveText("0");
    // Total unchanged — it was an update, not an insert.
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
  });

  test("UPDATE event refreshes the latest rejection reason strip in place", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await openKyc(page);
    await expect(page.getByTestId("kyc-latest-rejection-reason")).toHaveText("Address mismatch");

    // Reject Bob (a2, currently verified) with a brand-new reason dated after
    // every other rejection — this becomes the latest.
    await pushRealtime(page, {
      eventType: "UPDATE",
      new: {
        user_id: "a2",
        name: "Bob",
        phone: "0170000002",
        status: "rejected",
        rejection_reason: "Signature mismatch on form",
        updated_at: "2026-07-15T10:00:00Z",
      },
    });

    await expect(page.getByTestId("kyc-latest-rejection-reason")).toHaveText(
      "Signature mismatch on form",
    );
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("3");
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("1");
  });

  test("DELETE event drops the row and re-derives counts", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    await openKyc(page);
    await expect(page.getByTestId("kyc-total-count")).toHaveText("5");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("2");

    // Remove Erin (a5), whose rejection reason ("Address mismatch") is
    // currently shown — the strip must fall back to the next-latest rejection
    // ("Blurry NID photo" from Dave / a4).
    await pushRealtime(page, {
      eventType: "DELETE",
      old: { user_id: "a5" },
    });

    await expect(page.getByTestId("kyc-total-count")).toHaveText("4");
    await expect(page.getByTestId("kyc-rejected-count")).toHaveText("1");
    await expect(page.getByTestId("kyc-latest-rejection-reason")).toHaveText("Blurry NID photo");
  });

  test("realtime events applied without opening the sheet are visible on next open", async ({ page }) => {
    await page.goto(`${HARNESS}?fixture=populated`);
    // Don't open the sheet — dispatch a realtime insert while it's closed.
    await pushRealtime(page, {
      eventType: "INSERT",
      new: {
        user_id: "rt-hidden-1",
        name: "Silent Insert",
        phone: "0179999999",
        status: "verified",
        rejection_reason: null,
        updated_at: "2026-08-01T10:00:00Z",
      },
    });

    await openKyc(page);
    await expect(page.getByTestId("customer-kyc-content")).toBeVisible();
    await expect(page.getByTestId("kyc-total-count")).toHaveText("6");
    await expect(page.getByTestId("kyc-verified-count")).toHaveText("3");
  });
});
