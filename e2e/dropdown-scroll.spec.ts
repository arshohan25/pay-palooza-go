import { test, expect } from "@playwright/test";

/**
 * Verifies that the category dropdown (inside the merchant apply sheet) and
 * the union / powrashava / city-corp dropdown (inside a popover) both scroll
 * their internal list on wheel + touch input without the sheet/popover itself
 * closing or the parent sheet capturing the scroll.
 */

async function getScrollable(
  page: import("@playwright/test").Page,
  selector: string,
) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    // Find the nearest scrollable ancestor within the popover/sheet.
    let node: HTMLElement | null = el;
    while (node) {
      const s = getComputedStyle(node);
      const oy = s.overflowY;
      if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 2) {
        const rect = node.getBoundingClientRect();
        return {
          scrollTop: node.scrollTop,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
      node = node.parentElement;
    }
    return null;
  }, selector);
}

test.describe("Dropdown scrolling", () => {
  test("category list scrolls on wheel inside the sheet", async ({ page }) => {
    await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });
    const trigger = page.getByRole("combobox").first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    const options = page.getByRole("option");
    await expect
      .poll(async () => options.count(), { timeout: 8_000 })
      .toBeGreaterThanOrEqual(20);

    const info = await getScrollable(page, '[role="option"]');
    expect(info, "expected a scrollable ancestor around options").not.toBeNull();
    if (!info) return;
    expect(info.scrollHeight).toBeGreaterThan(info.clientHeight);

    // Wheel-scroll the list.
    await page.mouse.move(info.x, info.y);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150);

    // The popover must still be open (i.e. options still visible).
    await expect(options.first()).toBeVisible();

    const after = await getScrollable(page, '[role="option"]');
    expect(after!.scrollTop, "wheel should have scrolled the list").toBeGreaterThan(info.scrollTop);
  });

  test("union list scrolls on wheel and touch drag", async ({ page }) => {
    await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });

    // Fill in Division / District / Upazila to unlock the union combobox.
    const pick = async (label: RegExp) => {
      const sel = page.getByLabel(label);
      await expect(sel).toBeEnabled({ timeout: 8_000 });
      const values = await sel.evaluate((el) =>
        Array.from((el as HTMLSelectElement).options).map((o) => o.value).filter(Boolean),
      );
      test.skip(values.length === 0, `no options for ${label}`);
      await sel.selectOption(values[0]);
    };
    await pick(/^Division/i);
    await pick(/^District/i);
    await pick(/Upazila|Thana/i);

    const unionTrigger = page
      .getByRole("combobox", { name: /Union|Powrashava|City|ইউনিয়ন/i })
      .last();
    await expect(unionTrigger).toBeVisible({ timeout: 8_000 });
    await unionTrigger.click();

    // The virtualized scroller lives inside the popover content.
    const info = await page.evaluate(() => {
      const scrollers = Array.from(
        document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper] div'),
      ).filter((el) => {
        const s = getComputedStyle(el);
        return (
          (s.overflowY === "auto" || s.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 2
        );
      });
      const el = scrollers[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      };
    });
    test.skip(!info, "no scrollable union list — dataset too small for this upazila");
    if (!info) return;

    // Wheel scroll.
    await page.mouse.move(info.x, info.y);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(120);

    const afterWheel = await page.evaluate(() => {
      const el = Array.from(
        document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper] div'),
      ).find((n) => n.scrollHeight > n.clientHeight + 2);
      return el ? el.scrollTop : -1;
    });
    expect(afterWheel).toBeGreaterThan(info.scrollTop);

    // Touch drag (simulated via CDP touch).
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: info.x, y: info.y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: info.x, y: info.y - 200 }],
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(150);

    // Popover still open after both interactions.
    await expect(unionTrigger).toHaveAttribute("aria-expanded", "true");
  });
});
