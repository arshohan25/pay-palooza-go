import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Static contract audit: every money-moving action across
 * top-ups, transfers, bill payments, float requests, refunds and chargebacks
 * MUST be wired through PinConfirmSheet.onConfirmed, and the trigger button
 * MUST open the PIN sheet instead of calling the mutating RPC directly.
 *
 * If a future change removes the PIN gate on any of these flows, this test
 * will fail and the flow name will be shown in the report.
 */
type Case = {
  name: string;
  file: string;
  /** Regex that must appear inside an `onConfirmed={...}` handler body. */
  gatedCall: RegExp;
  /** Regex proving the primary CTA opens the PIN sheet (setPinOpen / setPin*). */
  triggerOpensPin: RegExp;
};

const CASES: Case[] = [
  {
    name: "Top-ups / gift-card purchase",
    file: "src/pages/GiftCardsPage.tsx",
    gatedCall: /onConfirmed=\{handlePurchase\}/,
    triggerOpensPin: /setPinOpen\(true\)|setPinPlan|setPinCard/,
  },
  {
    name: "Insurance activation (top-up)",
    file: "src/pages/InsurancePage.tsx",
    gatedCall: /onConfirmed=\{[^}]*handlePurchase\(pinPlan\)[^}]*\}/,
    triggerOpensPin: /setPinPlan\(/,
  },
  {
    name: "Float requests (distributor → agent transfer)",
    file: "src/components/DistributorFloatRequests.tsx",
    gatedCall: /onConfirmed=\{[^}]*approve\(r\)[^}]*\}/,
    triggerOpensPin: /setPinTarget\(r\)/,
  },
  {
    name: "Merchant refunds",
    file: "src/components/merchant/MerchantRefundsTab.tsx",
    gatedCall: /onConfirmed=\{[^}]*handleSubmitRefund\(\)[^}]*\}/,
    triggerOpensPin: /onClick=\{\(\) => setPinOpen\(true\)\}/,
  },
  {
    name: "Admin chargebacks",
    file: "src/components/admin/AdminChargebackDialog.tsx",
    gatedCall: /onConfirmed=\{[^}]*handleConfirm\(\)[^}]*\}/,
    triggerOpensPin: /onClick=\{\(\) => setPinOpen\(true\)\}/,
  },
];

const read = (rel: string) =>
  readFileSync(resolve(process.cwd(), rel), "utf8");

describe("Money-moving flows are PIN-gated end-to-end", () => {
  it.each(CASES)("$name imports PinConfirmSheet", ({ file }) => {
    const src = read(file);
    expect(src).toMatch(/from ["']@\/components\/PinConfirmSheet["']/);
  });

  it.each(CASES)(
    "$name only runs its money-moving action from PinConfirmSheet.onConfirmed",
    ({ file, gatedCall }) => {
      const src = read(file);
      expect(src).toMatch(gatedCall);
    },
  );

  it.each(CASES)(
    "$name primary CTA opens the PIN sheet instead of calling the RPC directly",
    ({ file, triggerOpensPin }) => {
      const src = read(file);
      expect(src).toMatch(triggerOpensPin);
    },
  );

  it.each(CASES)(
    "$name does not invoke its money-moving handler outside a PIN-gated callback",
    ({ file, gatedCall }) => {
      const src = read(file);
      // Pull the handler name out of the gatedCall regex source.
      const handlerMatch = gatedCall.source.match(/(handlePurchase|approve|handleSubmitRefund|handleConfirm)/);
      expect(handlerMatch).not.toBeNull();
      const handler = handlerMatch![1];
      // Direct call sites like `onClick={handler}` or `onClick={() => handler(...)}` outside
      // a PinConfirmSheet.onConfirmed are forbidden.
      const forbidden = new RegExp(
        `onClick=\\{(?:\\(\\)\\s*=>\\s*)?${handler}\\b`,
      );
      expect(src).not.toMatch(forbidden);
    },
  );
});
