import { describe, it, expect } from "vitest";
import { parseQrData } from "@/lib/qrParser";

/**
 * Ensures that agent QR codes (in any encoding produced by the agent QR
 * generator) route to the Cash Out flow and expose the exact agent wallet ID
 * that CashOutFlow will feed to resolve_transfer_recipient.
 */
describe("Agent QR → Cash Out routing", () => {
  const AGENT_WALLET = "EZP-AGNDH-RWGS";

  it("routes a bare agent wallet ID string to cashout", () => {
    const r = parseQrData(AGENT_WALLET);
    expect(r.flow).toBe("cashout");
    expect(r.identifier).toBe(AGENT_WALLET);
  });

  it("routes a lowercase agent wallet ID to cashout (case-insensitive)", () => {
    const r = parseQrData(AGENT_WALLET.toLowerCase());
    expect(r.flow).toBe("cashout");
  });

  it("routes JSON payload with WALLETID to cashout with correct id", () => {
    const raw = JSON.stringify({
      WALLETID: AGENT_WALLET,
      name: "Dhaka Agent",
      type: "agent",
    });
    const r = parseQrData(raw);
    expect(r.flow).toBe("cashout");
    expect(r.identifier).toBe(AGENT_WALLET);
    expect(r.name).toBe("Dhaka Agent");
  });

  it("routes JSON payload with walletId (camelCase) to cashout", () => {
    const raw = JSON.stringify({ walletId: AGENT_WALLET });
    const r = parseQrData(raw);
    expect(r.flow).toBe("cashout");
    expect(r.identifier).toBe(AGENT_WALLET);
  });

  it("routes URL with ?agentId= to cashout", () => {
    const raw = `https://pay.easypay.app/cashout?agentId=${AGENT_WALLET}`;
    const r = parseQrData(raw);
    expect(r.flow).toBe("cashout");
    expect(r.identifier).toBe(AGENT_WALLET);
  });

  it("routes URL with ?agentWallet= to cashout", () => {
    const raw = `https://pay.easypay.app/cashout?agentWallet=${AGENT_WALLET}`;
    const r = parseQrData(raw);
    expect(r.flow).toBe("cashout");
    expect(r.identifier).toBe(AGENT_WALLET);
  });

  it("routes URL with ?walletId= holding an agent wallet to cashout", () => {
    const raw = `https://pay.easypay.app/send?walletId=${AGENT_WALLET}`;
    const r = parseQrData(raw);
    expect(r.flow).toBe("cashout");
    expect(r.identifier).toBe(AGENT_WALLET);
  });

  it("does NOT route a personal wallet ID to cashout", () => {
    const personal = "EZP-USER-ABCD";
    const r = parseQrData(personal);
    expect(r.flow).toBe("send");
    expect(r.identifier).toBe(personal);
  });

  it("does NOT route a merchant wallet ID to cashout", () => {
    const merchant = "EZP-MRCXX-ABCD";
    const r = parseQrData(merchant);
    // Merchant pattern via wallet regex → send (merchant JSON payloads go via
    // the merchantId branch); the important assertion is: NOT cashout.
    expect(r.flow).not.toBe("cashout");
  });

  it("preserves the exact wallet id casing needed by resolve_transfer_recipient", () => {
    // resolve_transfer_recipient matches wallet IDs verbatim after upper-casing.
    const r = parseQrData(JSON.stringify({ WALLETID: AGENT_WALLET }));
    expect(r.identifier.toUpperCase()).toBe(AGENT_WALLET);
    expect(/^EZP-AGN[A-Z]{2}-[A-Z]{4}$/.test(r.identifier)).toBe(true);
  });
});
