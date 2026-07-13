import { describe, it, expect } from "vitest";
import { parseCashOutQrPayload } from "@/lib/cashoutQrPayload";

// Identity translator — surfaces the raw i18n key so assertions stay stable.
const t = (k: string) => k;

const AGENT_WALLET = "EZP-AGNDH-RWGS";
const AGENT_PHONE = "01909709954";

describe("parseCashOutQrPayload", () => {
  describe("empty / whitespace", () => {
    it("returns empty value for empty string", () => {
      expect(parseCashOutQrPayload("", t)).toEqual({ value: "" });
    });
    it("trims and returns empty for whitespace-only", () => {
      expect(parseCashOutQrPayload("     ", t)).toEqual({ value: "" });
    });
  });

  describe("bare identifiers", () => {
    it("accepts an agent wallet id verbatim (uppercased)", () => {
      const r = parseCashOutQrPayload(AGENT_WALLET, t);
      expect(r.value).toBe(AGENT_WALLET);
      expect(r.error).toBeUndefined();
    });
    it("accepts a lowercase agent wallet id and normalises casing", () => {
      const r = parseCashOutQrPayload(AGENT_WALLET.toLowerCase(), t);
      expect(r.value).toBe(AGENT_WALLET);
    });
    it("accepts a BD phone number verbatim", () => {
      const r = parseCashOutQrPayload(AGENT_PHONE, t);
      expect(r.value).toBe(AGENT_PHONE);
      expect(r.error).toBeUndefined();
    });
    it("flags a personal wallet id as not-an-agent QR", () => {
      const r = parseCashOutQrPayload("EZP-USER-ABCD", t);
      expect(r.error).toBe("coQrNotAgent");
    });
    it("flags a merchant wallet id as not-an-agent QR", () => {
      const r = parseCashOutQrPayload("EZP-MRCXX-ABCD", t);
      expect(r.error).toBe("coQrNotAgent");
    });
  });

  describe("well-formed JSON agent payloads", () => {
    it("resolves a printable agent JSON to the phone with wallet candidate", () => {
      const raw = JSON.stringify({
        app: "EasyPay",
        type: "agent",
        flow: "cashout",
        walletId: AGENT_WALLET,
        agentId: AGENT_WALLET,
        phone: AGENT_PHONE,
        name: "EasyPay Agent Shop",
      });
      const r = parseCashOutQrPayload(raw, t);
      expect(r.value).toBe(AGENT_PHONE);
      expect(r.candidates).toContain(AGENT_WALLET);
      expect(r.name).toBe("EasyPay Agent Shop");
      expect(r.error).toBeUndefined();
    });
    it("resolves JSON with only WALLETID", () => {
      const r = parseCashOutQrPayload(JSON.stringify({ WALLETID: AGENT_WALLET }), t);
      expect(r.value.toUpperCase()).toBe(AGENT_WALLET);
      expect(r.error).toBeUndefined();
    });
    it("flags JSON carrying a personal wallet id", () => {
      const r = parseCashOutQrPayload(JSON.stringify({ walletId: "EZP-USER-ZZZZ" }), t);
      expect(r.error).toBe("coQrNotAgent");
    });
    it("flags JSON merchant payload", () => {
      const r = parseCashOutQrPayload(
        JSON.stringify({ merchantId: "MRC-1234", name: "Shop" }),
        t,
      );
      expect(r.error).toBe("coQrNotAgent");
    });
  });

  describe("URL agent payloads", () => {
    it("extracts ?agentId=", () => {
      const r = parseCashOutQrPayload(
        `https://pay.easypay.app/cashout?agentId=${AGENT_WALLET}`,
        t,
      );
      expect(r.value.toUpperCase()).toBe(AGENT_WALLET);
      expect(r.error).toBeUndefined();
    });
    it("flags URL walletId pointing at a personal wallet", () => {
      const r = parseCashOutQrPayload(
        `https://pay.easypay.app/x?walletId=EZP-USER-ABCD`,
        t,
      );
      expect(r.error).toBe("coQrNotAgent");
    });
  });

  describe("truncated / malformed payloads (regex fallback)", () => {
    it("extracts agent wallet id from a truncated JSON tail", () => {
      const raw = `{"app":"EasyPay","type":"agent","walletId":"${AGENT_WALLET}","phone":"${AGENT_PHONE}`;
      const r = parseCashOutQrPayload(raw, t);
      // Truncated (no closing brace) → JSON.parse fails, regex extraction wins.
      expect(r.value === AGENT_WALLET || r.value === AGENT_PHONE).toBe(true);
      expect(r.error).toBeUndefined();
    });
    it("extracts agent wallet from a JSON-ish head-only fragment", () => {
      const raw = `{"WALLETID":"${AGENT_WALLET}`;
      const r = parseCashOutQrPayload(raw, t);
      expect(r.value).toBe(AGENT_WALLET);
    });
    it("extracts a BD phone number embedded in noisy text", () => {
      const raw = `garbled scanner output ... contact ${AGENT_PHONE} thanks`;
      const r = parseCashOutQrPayload(raw, t);
      expect(r.value).toBe(AGENT_PHONE);
    });
    it("prefers agent wallet id over embedded phone when both are present", () => {
      const raw = `noise ${AGENT_PHONE} noise ${AGENT_WALLET} tail`;
      const r = parseCashOutQrPayload(raw, t);
      expect(r.value).toBe(AGENT_WALLET);
    });
    it("returns the raw string for gibberish with no recognisable identifier", () => {
      const raw = "hello world 12345";
      const r = parseCashOutQrPayload(raw, t);
      expect(r.value).toBe(raw);
      expect(r.error).toBeUndefined();
    });
    it("returns short gibberish untouched (below regex-fallback threshold)", () => {
      const r = parseCashOutQrPayload("abc", t);
      expect(r).toEqual({ value: "abc" });
    });
    it("handles broken JSON that starts with { but never parses", () => {
      const r = parseCashOutQrPayload('{"walletId":', t);
      // No agent id in the fragment → falls through to raw string.
      expect(r.value).toBe('{"walletId":');
      expect(r.error).toBeUndefined();
    });
    it("never surfaces raw JSON braces in the resolved value when an agent id is present", () => {
      const raw = `{"type":"agent","walletId":"${AGENT_WALLET}"}`;
      const r = parseCashOutQrPayload(raw, t);
      expect(r.value).not.toContain("{");
      expect(r.value).not.toContain('"');
    });
  });
});
