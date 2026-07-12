import { describe, it, expect } from "vitest";
import {
  generateWalletId,
  validateWalletId,
  verifyCachedWalletId,
  detectWalletRole,
  extractWalletRoute,
  walletFormatHint,
  walletFormatError,
  isKnownRouteCode,
  KNOWN_ROUTE_CODES,
  WALLET_ID_RE,
  AGENT_WALLET_RE,
  MERCHANT_WALLET_RE,
  USER_WALLET_RE,
} from "./walletId";

describe("walletId — generation", () => {
  const PHONES = ["01711223344", "01998877665", "01755001122"];
  const ROUTES = ["DH", "KH", "NR", "CT", "SY"] as const;

  it("generates deterministic personal user IDs (EZP-XXXX-XXXX)", () => {
    for (const p of PHONES) {
      const id1 = generateWalletId(p, "user");
      const id2 = generateWalletId(p, "user");
      expect(id1).toBe(id2);
      expect(id1).toMatch(USER_WALLET_RE);
      expect(id1).toMatch(WALLET_ID_RE);
    }
  });

  it("generates agent IDs as EZP-AGN{RR}-XXXX for every route", () => {
    for (const route of ROUTES) {
      for (const p of PHONES) {
        const id = generateWalletId(p, "agent", route);
        expect(id.startsWith(`EZP-AGN${route}-`)).toBe(true);
        expect(id).toMatch(AGENT_WALLET_RE);
        expect(id).not.toMatch(USER_WALLET_RE);
        expect(id).not.toMatch(MERCHANT_WALLET_RE);
      }
    }
  });

  it("generates merchant IDs as EZP-MRC{RR}-XXXX for every route", () => {
    for (const route of ROUTES) {
      for (const p of PHONES) {
        const id = generateWalletId(p, "merchant", route);
        expect(id.startsWith(`EZP-MRC${route}-`)).toBe(true);
        expect(id).toMatch(MERCHANT_WALLET_RE);
        expect(id).not.toMatch(USER_WALLET_RE);
        expect(id).not.toMatch(AGENT_WALLET_RE);
      }
    }
  });

  it("defaults the route to DH when omitted", () => {
    expect(generateWalletId("01711223344", "agent").startsWith("EZP-AGNDH-")).toBe(true);
    expect(generateWalletId("01711223344", "merchant").startsWith("EZP-MRCDH-")).toBe(true);
  });

  it("normalizes lowercase and stray-char routes to 2 uppercase letters", () => {
    expect(generateWalletId("x", "agent", "dh")).toMatch(/^EZP-AGNDH-[A-Z]{4}$/);
    expect(generateWalletId("x", "merchant", "k")).toMatch(/^EZP-MRCDH-[A-Z]{4}$/); // fallback DH
    expect(generateWalletId("x", "agent", "N-R!")).toMatch(/^EZP-AGNNR-[A-Z]{4}$/);
  });
});

describe("walletId — validation", () => {
  it("accepts a well-formed personal wallet with no role assertion", () => {
    const v = validateWalletId("EZP-ABCD-EFGH");
    expect(v.ok).toBe(true);
    expect(v.role).toBe("user");
    expect(v.route).toBeNull();
  });

  it("detects agent + merchant roles and extracts route", () => {
    const a = validateWalletId("EZP-AGNDH-ABCD", "agent");
    expect(a.ok).toBe(true);
    expect(a.role).toBe("agent");
    expect(a.route).toBe("DH");

    const m = validateWalletId("EZP-MRCKH-WXYZ", "merchant");
    expect(m.ok).toBe(true);
    expect(m.route).toBe("KH");
  });

  it("rejects wallet IDs whose role doesn't match the expected role", () => {
    const a = validateWalletId("EZP-AGNDH-ABCD", "user");
    expect(a.ok).toBe(false);
    expect(a.reason).toBe("role_mismatch");
    expect(a.role).toBe("agent");

    const u = validateWalletId("EZP-ABCD-EFGH", "merchant");
    expect(u.ok).toBe(false);
    expect(u.reason).toBe("role_mismatch");
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["EZP-1234-ABCD", "bad_format"],       // digits not allowed
    ["EZP-ABC-EFGH", "bad_format"],        // 3-char middle
    ["EZP-ABCDEF-EFGH", "bad_format"],     // 6-char middle
    ["EZP-ABCD-EFG", "bad_format"],        // 3-char suffix
    ["EZ-ABCD-EFGH", "bad_format"],        // wrong prefix
    ["EZP_ABCD_EFGH", "bad_format"],       // wrong separator
    ["EZP-AGN-DHAB", "bad_format"],        // 4 segments (not our shape)
  ])("rejects %s as %s", (input, reason) => {
    const v = validateWalletId(input as string);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(reason);
  });

  it("normalizes lowercase and whitespace before matching", () => {
    const v = validateWalletId("  ezp-agndh-abcd  ", "agent");
    expect(v.ok).toBe(true);
    expect(v.normalized).toBe("EZP-AGNDH-ABCD");
  });

  it("extracts route from any agent/merchant ID and returns null for personal", () => {
    expect(extractWalletRoute("EZP-AGNDH-ABCD")).toBe("DH");
    expect(extractWalletRoute("EZP-MRCNR-ZZZZ")).toBe("NR");
    expect(extractWalletRoute("EZP-ABCD-EFGH")).toBeNull();
    expect(extractWalletRoute("garbage")).toBeNull();
  });

  it("detectWalletRole returns null for malformed input", () => {
    expect(detectWalletRole("EZP-XX-YY")).toBeNull();
    expect(detectWalletRole("")).toBeNull();
  });
});

describe("walletId — cached-vs-displayed mismatch detection", () => {
  const seed = "01711223344";

  it("accepts an ID that matches the seed and role", () => {
    const expected = generateWalletId(seed, "agent", "DH");
    expect(verifyCachedWalletId(expected, seed, "agent", "DH")).toBe(true);
  });

  it("uses the cached ID's own route when route arg is omitted", () => {
    const stored = generateWalletId(seed, "merchant", "KH");
    expect(verifyCachedWalletId(stored, seed, "merchant")).toBe(true);
  });

  it("rejects a cached ID generated from a different seed", () => {
    const stored = generateWalletId("01900000001", "user");
    expect(verifyCachedWalletId(stored, "01988888888", "user")).toBe(false);
  });

  it("rejects a cached ID whose role prefix was tampered with", () => {
    const good = generateWalletId(seed, "agent", "DH");
    const tampered = good.replace("AGN", "MRC"); // now looks merchant
    expect(verifyCachedWalletId(tampered, seed, "agent", "DH")).toBe(false);
  });

  it("rejects a cached ID whose route was tampered with", () => {
    const good = generateWalletId(seed, "agent", "DH");
    const tampered = good.replace("AGNDH", "AGNKH");
    expect(verifyCachedWalletId(tampered, seed, "agent", "DH")).toBe(false);
  });

  it("rejects a cached ID whose hash suffix was flipped", () => {
    const good = generateWalletId(seed, "user");
    // Rotate last letter to guarantee a different suffix.
    const last = good.charAt(good.length - 1);
    const next = String.fromCharCode(((last.charCodeAt(0) - 65 + 1) % 26) + 65);
    const tampered = good.slice(0, -1) + next;
    expect(verifyCachedWalletId(tampered, seed, "user")).toBe(false);
  });

  it("rejects empty/undefined inputs", () => {
    expect(verifyCachedWalletId("", seed, "user")).toBe(false);
    expect(verifyCachedWalletId(null, seed, "user")).toBe(false);
    expect(verifyCachedWalletId("EZP-ABCD-EFGH", "", "user")).toBe(false);
  });
});

describe("walletId — user-friendly format hints", () => {
  it("exposes an English hint for every role", () => {
    expect(walletFormatHint("user")).toContain("EZP-XXXX-XXXX");
    expect(walletFormatHint("agent")).toContain("EZP-AGN{RR}-XXXX");
    expect(walletFormatHint("merchant")).toContain("EZP-MRC{RR}-XXXX");
  });

  it("returns bilingual error text with the expected format embedded", () => {
    expect(walletFormatError("agent", "en")).toMatch(/Invalid agent wallet ID/);
    expect(walletFormatError("agent", "en")).toContain("EZP-AGN{RR}-XXXX");
    expect(walletFormatError("merchant", "bn")).toContain("মার্চেন্ট");
    expect(walletFormatError("merchant", "bn")).toContain("EZP-MRC{RR}-XXXX");
  });
});

describe("walletId — 64-district route coverage", () => {
  const ALL = Array.from(KNOWN_ROUTE_CODES);
  const UNKNOWN = ["ZZ", "QQ", "XY", "AA", "IZ"] as const; // not seeded

  it("includes exactly 64 Bangladesh district codes", () => {
    expect(ALL).toHaveLength(64);
    for (const c of ALL) expect(c).toMatch(/^[A-Z]{2}$/);
  });

  it("generates and validates an agent + merchant wallet for every district", () => {
    const seed = "01711223344";
    for (const route of ALL) {
      const agent = generateWalletId(seed, "agent", route);
      const merch = generateWalletId(seed, "merchant", route);

      expect(agent).toBe(`EZP-AGN${route}-${agent.slice(-4)}`);
      expect(merch).toBe(`EZP-MRC${route}-${merch.slice(-4)}`);

      const va = validateWalletId(agent, "agent");
      expect(va.ok, `agent ${route} should validate`).toBe(true);
      expect(va.route).toBe(route);

      const vm = validateWalletId(merch, "merchant");
      expect(vm.ok, `merchant ${route} should validate`).toBe(true);
      expect(vm.route).toBe(route);
    }
  });

  it.each(UNKNOWN)("rejects agent + merchant IDs with unknown route %s", (route) => {
    expect(isKnownRouteCode(route)).toBe(false);

    const agent = `EZP-AGN${route}-ABCD`;
    const merch = `EZP-MRC${route}-WXYZ`;

    const va = validateWalletId(agent, "agent");
    expect(va.ok).toBe(false);
    expect(va.reason).toBe("unknown_route");
    expect(va.role).toBe("agent");
    expect(va.route).toBe(route);

    const vm = validateWalletId(merch, "merchant");
    expect(vm.ok).toBe(false);
    expect(vm.reason).toBe("unknown_route");
    expect(vm.role).toBe("merchant");
  });

  it("does NOT apply route rules to personal user wallets", () => {
    // Personal wallets have no route segment, so 'unknown_route' can never fire.
    const u = validateWalletId("EZP-ABCD-EFGH", "user");
    expect(u.ok).toBe(true);
    expect(u.route).toBeNull();
    expect(extractWalletRoute("EZP-ABCD-EFGH")).toBeNull();
  });

  it("isKnownRouteCode is case-insensitive and rejects garbage", () => {
    expect(isKnownRouteCode("dh")).toBe(true);
    expect(isKnownRouteCode("DH")).toBe(true);
    expect(isKnownRouteCode("zz")).toBe(false);
    expect(isKnownRouteCode("")).toBe(false);
    expect(isKnownRouteCode(null)).toBe(false);
    expect(isKnownRouteCode(undefined)).toBe(false);
  });
});
