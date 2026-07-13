import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseQrData } from "@/lib/qrParser";

/**
 * Integration guard: every real-world agent QR payload MUST classify as
 * `cashout`, and the two entry points that dispatch a scan (the global
 * Scan & Pay handler in Index.tsx and SendMoneyFlow.handleQrScan) MUST
 * route/refuse it accordingly. If any of these break, an agent QR could
 * silently land in Send Money and transfer funds to an agent as a P2P
 * gift instead of triggering the cash-out fee/limit logic.
 */

const AGENT_WALLET = "EZP-AGNDH-RWGS";

const AGENT_QR_PAYLOADS: Array<[string, string]> = [
  ["bare wallet id", AGENT_WALLET],
  ["lowercase wallet id", AGENT_WALLET.toLowerCase()],
  ["JSON WALLETID", JSON.stringify({ WALLETID: AGENT_WALLET, name: "Agent" })],
  ["JSON walletId camelCase", JSON.stringify({ walletId: AGENT_WALLET })],
  ["JSON with type=agent", JSON.stringify({ type: "agent", walletId: AGENT_WALLET })],
  ["URL ?agentId=", `https://pay.easypay.app/cashout?agentId=${AGENT_WALLET}`],
  ["URL ?agentWallet=", `https://pay.easypay.app/x?agentWallet=${AGENT_WALLET}`],
  ["URL ?agent=", `https://pay.easypay.app/x?agent=${AGENT_WALLET}`],
  ["URL ?walletId= with agent id", `https://pay.easypay.app/send?walletId=${AGENT_WALLET}`],
];

describe("Agent QR → Cash Out (integration)", () => {
  describe("parseQrData classifies every agent payload as cashout", () => {
    it.each(AGENT_QR_PAYLOADS)("%s", (_label, raw) => {
      const r = parseQrData(raw);
      expect(r.flow).toBe("cashout");
      expect(r.identifier.toUpperCase()).toBe(AGENT_WALLET);
    });
  });

  describe("Index.tsx global scan router dispatches cashout QRs to CashOutFlow", () => {
    // Load once — this is a source-level contract test that guards the
    // routing switch in the Scan & Pay handler.
    const src = readFileSync(
      resolve(__dirname, "../pages/Index.tsx"),
      "utf8",
    );

    it("has a cashout branch that opens Cash Out and never Send Money", () => {
      // Locate the switch on parsed.flow inside the QrScannerModal onScan.
      // The branch must open Cash Out — either directly via setShowCashOut(true)
      // or via the openCashOutFromQr helper (which itself calls setShowCashOut).
      const cashoutBranch = src.match(
        /parsed\.flow === "cashout"[\s\S]{0,200}?(setShowCashOut\(true\)|openCashOutFromQr\()/,
      );
      expect(
        cashoutBranch,
        "cashout branch must open Cash Out (setShowCashOut(true) or openCashOutFromQr())",
      ).not.toBeNull();

      // Confirm the helper itself opens Cash Out.
      expect(src).toMatch(/openCashOutFromQr[\s\S]{0,300}setShowCashOut\(true\)/);

      // The same branch must NOT open Send Money.
      const branchText = cashoutBranch?.[0] ?? "";
      expect(branchText).not.toMatch(/setShowSendMoney\(true\)/);
      expect(branchText).not.toMatch(/setSendMoneyPrefilledPhone/);
    });

    it("routes each agent payload to cashout via the same parser Index.tsx uses", () => {
      for (const [, raw] of AGENT_QR_PAYLOADS) {
        const parsed = parseQrData(raw);
        // Simulate Index.tsx switch:
        const target =
          parsed.flow === "cashout"
            ? "cashout"
            : parsed.flow === "send"
              ? "send"
              : parsed.flow;
        expect(target).toBe("cashout");
      }
    });
  });

  describe("SendMoneyFlow.handleQrScan hard-guards agent QRs", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/SendMoneyFlow.tsx"),
      "utf8",
    );

    it("returns early with an error when parsed.flow === 'cashout'", () => {
      // The guard must appear BEFORE any recipient state is set.
      const handler = src.match(
        /const handleQrScan = async[\s\S]*?goTo\("amount"\);[\s\S]*?\};/,
      );
      expect(handler, "handleQrScan not found").not.toBeNull();
      const body = handler![0];

      // Guard exists.
      const guardIdx = body.search(/parsed\.flow === "cashout"/);
      expect(guardIdx).toBeGreaterThan(-1);

      // Guard sets an error and returns.
      const guardSlice = body.slice(guardIdx, guardIdx + 200);
      expect(guardSlice).toMatch(/setError\(/);
      expect(guardSlice).toMatch(/return/);

      // Guard runs BEFORE state that would move the flow forward.
      const setInputValIdx = body.search(/setInputVal\(/);
      const setRecipientIdx = body.search(/setRecipient\(/);
      const goToAmountIdx = body.search(/goTo\("amount"\)/);
      expect(guardIdx).toBeLessThan(setInputValIdx);
      expect(guardIdx).toBeLessThan(setRecipientIdx);
      expect(guardIdx).toBeLessThan(goToAmountIdx);
    });

    it("uses the shared parseQrData (not a bespoke parser)", () => {
      expect(src).toMatch(/from ["']@\/lib\/qrParser["']|import\(["']@\/lib\/qrParser["']\)/);
    });
  });
});
