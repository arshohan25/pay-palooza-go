import { describe, it, expect, vi } from "vitest";
import { parseCashOutQrPayload, normalizeCashOutInput } from "@/lib/cashoutQrPayload";

// Silence activityTracker inside unit tests — it tries to talk to Supabase
// on flush, which we don't want and don't need to assert on here.
vi.mock("@/lib/activityTracker", () => ({
  activityTracker: { qr: vi.fn() },
}));

const t = (k: string) => k;

const AGENT_WALLET = "EZP-AGNDH-RWGS";
const AGENT_PHONE = "01909709954";

describe("normalizeCashOutInput", () => {
  it("returns empty for empty / whitespace", () => {
    expect(normalizeCashOutInput("")).toBe("");
    expect(normalizeCashOutInput("   ")).toBe("");
  });

  it("strips spaces/hyphens from BD phones", () => {
    expect(normalizeCashOutInput("019 0970 9954")).toBe(AGENT_PHONE);
    expect(normalizeCashOutInput("01909-709-954")).toBe(AGENT_PHONE);
    expect(normalizeCashOutInput("(01909) 709954")).toBe(AGENT_PHONE);
  });

  it("normalises +880 / 880 / 00880 country-code phones", () => {
    expect(normalizeCashOutInput("+8801909709954")).toBe(AGENT_PHONE);
    expect(normalizeCashOutInput("8801909709954")).toBe(AGENT_PHONE);
    expect(normalizeCashOutInput("008801909709954")).toBe(AGENT_PHONE);
    expect(normalizeCashOutInput("+880 1909 709 954")).toBe(AGENT_PHONE);
  });

  it("uppercases and strips whitespace from agent wallet ids", () => {
    expect(normalizeCashOutInput("ezp-agndh-rwgs")).toBe(AGENT_WALLET);
    expect(normalizeCashOutInput("EZP -AGNDH- RWGS")).toBe(AGENT_WALLET);
  });

  it("re-inserts missing hyphens on hyphen-stripped agent ids", () => {
    expect(normalizeCashOutInput("EZPAGNDHRWGS")).toBe(AGENT_WALLET);
    expect(normalizeCashOutInput("ezpagndhrwgs")).toBe(AGENT_WALLET);
  });

  it("leaves URLs and JSON payloads untouched", () => {
    const url = "https://pay.easypay.app/cashout?agentId=EZP-AGNDH-RWGS";
    expect(normalizeCashOutInput(url)).toBe(url);
    const json = '{"walletId":"EZP-AGNDH-RWGS"}';
    expect(normalizeCashOutInput(json)).toBe(json);
  });

  it("passes through unrecognised input verbatim (trimmed)", () => {
    expect(normalizeCashOutInput("  hello world  ")).toBe("hello world");
  });
});

describe("parseCashOutQrPayload", () => {
  describe("empty / whitespace", () => {
    it("returns empty with reason=empty", () => {
      expect(parseCashOutQrPayload("", t)).toMatchObject({ value: "", reason: "empty" });
      expect(parseCashOutQrPayload("     ", t)).toMatchObject({ value: "", reason: "empty" });
    });
  });

  describe("bare identifiers (post-normalisation)", () => {
    it("accepts an agent wallet id verbatim", () => {
      const r = parseCashOutQrPayload(AGENT_WALLET, t);
      expect(r.value).toBe(AGENT_WALLET);
      expect(r.error).toBeUndefined();
    });
    it("accepts a lowercase agent wallet id", () => {
      expect(parseCashOutQrPayload(AGENT_WALLET.toLowerCase(), t).value).toBe(AGENT_WALLET);
    });
    it("accepts hyphen-stripped agent wallet id (EZPAGNDHRWGS)", () => {
      expect(parseCashOutQrPayload("EZPAGNDHRWGS", t).value).toBe(AGENT_WALLET);
    });
    it("accepts +880-prefixed phone as bare identifier", () => {
      // Normalises to bare 01… then parseQrData routes as `send` → coQrNotAgent
      // (a bare phone alone can't be proven to belong to an agent client-side).
      const r = parseCashOutQrPayload("+8801909709954", t);
      expect(r.value).toBe(AGENT_PHONE);
      expect(r.error).toBe("coQrNotAgent");
    });
    it("flags a personal wallet id as not-an-agent QR", () => {
      expect(parseCashOutQrPayload("EZP-USER-ABCD", t).error).toBe("coQrNotAgent");
    });
    it("flags a merchant wallet id as not-an-agent QR", () => {
      expect(parseCashOutQrPayload("EZP-MRCXX-ABCD", t).error).toBe("coQrNotAgent");
    });
  });

  describe("JSON agent payloads", () => {
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
    it("flags JSON with a personal wallet id", () => {
      expect(parseCashOutQrPayload(JSON.stringify({ walletId: "EZP-USER-ZZZZ" }), t).error)
        .toBe("coQrNotAgent");
    });
    it("flags JSON merchant payload", () => {
      expect(parseCashOutQrPayload(
        JSON.stringify({ merchantId: "MRC-1234", name: "Shop" }),
        t,
      ).error).toBe("coQrNotAgent");
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
      expect(parseCashOutQrPayload(
        `https://pay.easypay.app/x?walletId=EZP-USER-ABCD`,
        t,
      ).error).toBe("coQrNotAgent");
    });
  });

  describe("truncated / malformed payloads", () => {
    it("extracts agent wallet id from a truncated JSON tail", () => {
      const r = parseCashOutQrPayload(`{"type":"agent","walletId":"${AGENT_WALLET}`, t);
      expect(r.value).toBe(AGENT_WALLET);
      expect(r.error).toBeUndefined();
    });
    it("returns unreadable for broken JSON with no identifier", () => {
      const r = parseCashOutQrPayload('{"walletId":', t);
      expect(r.value).toBe("");
      expect(r.error).toBe("coQrUnreadable");
      expect(r.reason).toBe("unreadable");
    });
    it("never surfaces raw JSON braces as the resolved value", () => {
      const r = parseCashOutQrPayload(`{"type":"agent","walletId":"${AGENT_WALLET}"}`, t);
      expect(r.value).not.toContain("{");
      expect(r.value).not.toContain('"');
    });
    it("returns unreadable for a bare URL with no useful params", () => {
      const r = parseCashOutQrPayload("https://example.com/", t);
      expect(r.error).toBe("coQrUnreadable");
    });
    it("returns raw string + reason=unreadable for plain gibberish", () => {
      const r = parseCashOutQrPayload("hello world 12345", t);
      expect(r.value).toBe("hello world 12345");
      expect(r.reason).toBe("unreadable");
    });
  });
});
