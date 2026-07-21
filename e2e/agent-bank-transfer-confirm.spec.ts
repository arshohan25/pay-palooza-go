/**
 * AgentBankTransfer confirmation-flow contract.
 *
 * Drives the harness at /__test/agent-bank-transfer-harness which mirrors
 * the real AgentBankTransfer state machine: form → pin → confirm(slider) → done.
 *
 * Contract asserted:
 *   1. There is exactly ONE preview/summary — on the confirm step after PIN.
 *      No duplicate preview screen sits between form and PIN.
 *   2. Slide-to-Confirm is disabled until PIN is verified; completing it
 *      advances to done.
 *   3. Back from confirm → pin (PIN reset); back from pin → form.
 *   4. Wrong PIN keeps the flow on the PIN step; slider unreachable.
 */
import { test, expect } from "@playwright/test";

const HARNESS = "/__test/agent-bank-transfer-harness";

async function typePin(page: import("@playwright/test").Page, pin: string) {
  await page.getByLabel("PIN").fill(pin);
}

async function dragSlider(page: import("@playwright/test").Page) {
  const track = page.getByTestId("slider-wrapper");
  const box = await track.boundingBox();
  if (!box) throw new Error("slider track has no bounding box");
  const startX = box.x + 28;
  const y = box.y + box.height / 2;
  const endX = box.x + box.width - 28;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + ((endX - startX) * i) / steps, y, { steps: 2 });
  }
  await page.mouse.up();
}

test.describe("AgentBankTransfer — single preview after PIN", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await expect(page.getByTestId("title")).toBeVisible();
  });

  test("form → pin → confirm shows the ONLY summary + slider", async ({ page }) => {
    await expect(page.getByTestId("step")).toHaveText("step:form");

    // Continue from form goes straight to PIN — no pre-PIN preview.
    await page.getByTestId("form-continue").click();
    await expect(page.getByTestId("step")).toHaveText("step:pin");
    await expect(page.getByTestId("confirm-amount")).toHaveCount(0);
    await expect(page.getByTestId("slider-wrapper")).toHaveCount(0);

    await typePin(page, "1234");
    await page.getByTestId("pin-verify").click();

    // Single confirmation screen after PIN.
    await expect(page.getByTestId("step")).toHaveText("step:confirm");
    await expect(page.getByTestId("confirm-amount")).toBeVisible();
    await expect(page.getByTestId("slider-wrapper")).toBeVisible();
    await expect(page.getByTestId("pin-verified")).toHaveText("pinVerified:true");
    await expect(page.getByTestId("done-message")).toHaveCount(0);
  });

  test("back navigation returns confirm → pin → form and re-locks slider", async ({ page }) => {
    await page.getByTestId("form-continue").click();
    await typePin(page, "1234");
    await page.getByTestId("pin-verify").click();
    await expect(page.getByTestId("step")).toHaveText("step:confirm");

    await page.getByTestId("confirm-back").click();
    await expect(page.getByTestId("step")).toHaveText("step:pin");
    await expect(page.getByTestId("pin-verified")).toHaveText("pinVerified:false");

    await page.getByTestId("pin-back").click();
    await expect(page.getByTestId("step")).toHaveText("step:form");
  });

  test("slider completes only after PIN verify and advances to done", async ({ page }) => {
    await page.getByTestId("form-continue").click();
    await typePin(page, "1234");
    await page.getByTestId("pin-verify").click();
    await expect(page.getByTestId("step")).toHaveText("step:confirm");

    const wrapper = page.getByTestId("slider-wrapper");
    const disabledClass = await wrapper.locator("> div").first().getAttribute("class");
    expect(disabledClass ?? "").not.toContain("pointer-events-none");

    await dragSlider(page);
    await expect(page.getByTestId("step")).toHaveText("step:done");
    await expect(page.getByTestId("done-message")).toBeVisible();
  });

  test("wrong PIN keeps flow on pin step and slider unreachable", async ({ page }) => {
    await page.getByTestId("form-continue").click();
    await typePin(page, "9999");
    await page.getByTestId("pin-verify").click();

    await expect(page.getByTestId("step")).toHaveText("step:pin");
    await expect(page.getByTestId("pin-verified")).toHaveText("pinVerified:false");
    await expect(page.getByTestId("pin-error")).toBeVisible();
    await expect(page.getByTestId("slider-wrapper")).toHaveCount(0);
  });
});
