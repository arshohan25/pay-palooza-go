/**
 * AgentBankTransfer confirmation-flow contract.
 *
 * Drives the harness at /__test/agent-bank-transfer-harness (which mirrors
 * the real AgentBankTransfer state machine: form → preview → pin → confirm
 * (slider) → done) and asserts:
 *
 *   1. After PIN verification the flow lands on the confirmation screen —
 *      NOT straight on the done screen.
 *   2. The Slide-to-Confirm slider is disabled until the PIN is verified,
 *      and enabled after.
 *   3. Back from confirm returns to PIN (with PIN reset so the slider goes
 *      back to disabled), and Back from PIN returns to preview.
 *   4. Only completing the slider advances the flow to "done".
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
  // Thumb sits at the left edge with 4px padding; drag to the right edge.
  const startX = box.x + 28;
  const y = box.y + box.height / 2;
  const endX = box.x + box.width - 28;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  // Move in steps so framer-motion drag registers.
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + ((endX - startX) * i) / steps, y, { steps: 2 });
  }
  await page.mouse.up();
}

test.describe("AgentBankTransfer — confirmation stays after PIN", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await expect(page.getByTestId("title")).toBeVisible();
  });

  test("form → preview → pin → confirm keeps summary + slider visible", async ({ page }) => {
    await expect(page.getByTestId("step")).toHaveText("step:form");

    await page.getByTestId("form-continue").click();
    await expect(page.getByTestId("step")).toHaveText("step:preview");
    await expect(page.getByTestId("preview-amount")).toContainText("1000");

    await page.getByTestId("preview-continue").click();
    await expect(page.getByTestId("step")).toHaveText("step:pin");
    await expect(page.getByTestId("pin-verified")).toHaveText("pinVerified:false");

    await typePin(page, "1234");
    await page.getByTestId("pin-verify").click();

    // Contract: after PIN verification the flow lands on the confirm screen,
    // NOT on the done screen. The summary + slider must be visible.
    await expect(page.getByTestId("step")).toHaveText("step:confirm");
    await expect(page.getByTestId("confirm-amount")).toBeVisible();
    await expect(page.getByTestId("slider-wrapper")).toBeVisible();
    await expect(page.getByTestId("pin-verified")).toHaveText("pinVerified:true");
    await expect(page.getByTestId("done-message")).toHaveCount(0);
  });

  test("back navigation returns confirm → pin → preview and re-locks slider", async ({ page }) => {
    await page.getByTestId("form-continue").click();
    await page.getByTestId("preview-continue").click();
    await typePin(page, "1234");
    await page.getByTestId("pin-verify").click();
    await expect(page.getByTestId("step")).toHaveText("step:confirm");

    // Back from confirm → pin (and PIN is reset so slider would be disabled again)
    await page.getByTestId("confirm-back").click();
    await expect(page.getByTestId("step")).toHaveText("step:pin");
    await expect(page.getByTestId("pin-verified")).toHaveText("pinVerified:false");

    // Back from pin → preview
    await page.getByTestId("pin-back").click();
    await expect(page.getByTestId("step")).toHaveText("step:preview");
    await expect(page.getByTestId("preview-amount")).toBeVisible();
  });

  test("slider is disabled until PIN verified, and completing it advances to done", async ({ page }) => {
    await page.getByTestId("form-continue").click();
    await page.getByTestId("preview-continue").click();
    await typePin(page, "1234");
    await page.getByTestId("pin-verify").click();
    await expect(page.getByTestId("step")).toHaveText("step:confirm");

    // Slider is enabled (pointer-events not disabled).
    const wrapper = page.getByTestId("slider-wrapper");
    const disabledClass = await wrapper.locator("> div").first().getAttribute("class");
    expect(disabledClass ?? "").not.toContain("pointer-events-none");

    await dragSlider(page);
    await expect(page.getByTestId("step")).toHaveText("step:done");
    await expect(page.getByTestId("done-message")).toBeVisible();
  });

  test("wrong PIN keeps flow on pin step and slider unreachable", async ({ page }) => {
    await page.getByTestId("form-continue").click();
    await page.getByTestId("preview-continue").click();
    await typePin(page, "9999");
    await page.getByTestId("pin-verify").click();

    await expect(page.getByTestId("step")).toHaveText("step:pin");
    await expect(page.getByTestId("pin-verified")).toHaveText("pinVerified:false");
    await expect(page.getByTestId("pin-error")).toBeVisible();
    await expect(page.getByTestId("slider-wrapper")).toHaveCount(0);
  });
});
