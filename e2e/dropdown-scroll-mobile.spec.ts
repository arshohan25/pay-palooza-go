import { test, expect, devices } from "@playwright/test";

/**
 * Mobile-viewport variant of dropdown-scroll.spec.ts. Verifies that on a
 * touch device the category dropdown (inside the merchant apply sheet) and
 * the union / powrashava / city-corp popover both scroll their internal
 * list via touch drag WITHOUT the parent sheet swallowing the gesture or
 * closing the popover.
 */

test.use({
  ...devices["Pixel 7"],
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 780 },
});

async function touchDrag(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
  dy: number,
) {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  // Multiple move steps → realistic drag, momentum scrolling.
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + (dy * i) / steps }],
    });
    await page.waitForTimeout(16);
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test.describe("Mobile dropdown touch scrolling", () => {
  test("category list scrolls on touch drag without closing the sheet", async ({ page }) => {
    await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });

    const trigger = page.getByRole("combobox").first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.tap();

    const options = page.getByRole("option");
    await expect
      .poll(async () => options.count(), { timeout: 8_000 })
      .toBeGreaterThanOrEqual(20);

    const info = await page.evaluate(() => {
      const opt = document.querySelector('[role="option"]') as HTMLElement | null;
      if (!opt) return null;
      let node: HTMLElement | null = opt;
      while (node) {
        const s = getComputedStyle(node);
        if (
          (s.overflowY === "auto" || s.overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight + 2
        ) {
          const r = node.getBoundingClientRect();
          return {
            scrollTop: node.scrollTop,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          };
        }
        node = node.parentElement;
      }
      return null;
    });
    expect(info, "expected scrollable ancestor around options").not.toBeNull();
    if (!info) return;

    await touchDrag(page, info.x, info.y + 60, -240);
    await page.waitForTimeout(200);

    // Sheet/popover still open → options still visible.
    await expect(options.first()).toBeVisible();

    const after = await page.evaluate(() => {
      const opt = document.querySelector('[role="option"]') as HTMLElement | null;
      if (!opt) return -1;
      let node: HTMLElement | null = opt;
      while (node) {
        const s = getComputedStyle(node);
        if (
          (s.overflowY === "auto" || s.overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight + 2
        ) {
          return node.scrollTop;
        }
        node = node.parentElement;
      }
      return -1;
    });
    expect(after, "touch drag should have scrolled the category list").toBeGreaterThan(
      info.scrollTop,
    );
  });

  test("union list scrolls on touch drag without popover closing", async ({ page }) => {
    await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });

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
    await unionTrigger.tap();

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
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      };
    });
    test.skip(!info, "no scrollable union list — dataset too small for this upazila");
    if (!info) return;

    await touchDrag(page, info.x, info.y + 40, -220);
    await page.waitForTimeout(200);

    // Popover still open.
    await expect(unionTrigger).toHaveAttribute("aria-expanded", "true");

    const afterTop = await page.evaluate(() => {
      const el = Array.from(
        document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper] div'),
      ).find((n) => n.scrollHeight > n.clientHeight + 2);
      return el ? el.scrollTop : -1;
    });
    expect(afterTop, "touch drag should have scrolled the union list").toBeGreaterThan(
      info.scrollTop,
    );
  });
});
