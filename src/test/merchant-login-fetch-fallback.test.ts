import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase.functions.invoke so we control both the success and
// FunctionsFetchError paths without hitting the network.
const invokeMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: any[]) => invokeMock(...a) } },
}));

import { invokeMerchantLoginWithFallback } from "@/lib/merchantLoginInvoke";

// smartshop.bd is the custom-domain PWA where FunctionsFetchError was
// reported. Match the env vars the helper reads.
const SUPABASE_URL = "https://lmgsxyzytssddijjxbzc.supabase.co";
const ANON_KEY = "test-anon-key";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  invokeMock.mockReset();
  // @ts-expect-error test override
  import.meta.env.VITE_SUPABASE_URL = SUPABASE_URL;
  // @ts-expect-error test override
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = ANON_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("MerchantLoginPage → invokeMerchantLoginWithFallback (smartshop.bd)", () => {
  it("falls back to raw /functions/v1/merchant-login when supabase.functions.invoke throws FunctionsFetchError", async () => {
    // Simulate the mobile/PWA failure: SDK throws before the request lands.
    class FunctionsFetchError extends Error {
      constructor() {
        super("Failed to send a request to the Edge Function");
        this.name = "FunctionsFetchError";
      }
    }
    invokeMock.mockRejectedValueOnce(new FunctionsFetchError());

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, requires_device_verification: true }),
      headers: { get: () => null },
    });
    globalThis.fetch = fetchMock as any;

    const payload = { phone: "01700000000", pin: "1234", device_fp: "fp", mode: "owner" };
    const result = await invokeMerchantLoginWithFallback(payload);

    // SDK was tried once, then the raw fetch fallback fired against the
    // documented endpoint on the current Supabase project.
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${SUPABASE_URL}/functions/v1/merchant-login`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.apikey).toBe(ANON_KEY);
    expect(init.headers.Authorization).toBe(`Bearer ${ANON_KEY}`);
    expect(JSON.parse(init.body)).toEqual(payload);

    expect(result.usedFallback).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeNull();
    expect(result.body).toEqual({ ok: true, requires_device_verification: true });
  });

  it("does NOT use the raw fetch fallback when supabase.functions.invoke succeeds", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { ok: true, session: { access_token: "a", refresh_token: "r" } },
      error: null,
    });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;

    const result = await invokeMerchantLoginWithFallback({ phone: "01700000000", pin: "1234" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.usedFallback).toBe(false);
    expect(result.body?.ok).toBe(true);
  });

  it("does NOT retry via raw fetch on a real HTTP error (has response context)", async () => {
    // functions.invoke returns an error whose `context` is a real Response
    // — that means the request reached the server, so the fallback would be
    // wrong (would double-submit). Ensure we skip it.
    const ctx = {
      status: 401,
      headers: { get: () => null },
      clone: () => ctx,
      json: async () => ({ ok: false, message: "Wrong phone or PIN", attempts_remaining: 4 }),
      text: async () => "",
    };
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: "Non-2xx", context: ctx } });

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;

    const result = await invokeMerchantLoginWithFallback({ phone: "01700000000", pin: "1234" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.usedFallback).toBe(false);
    expect(result.status).toBe(401);
    expect(result.body?.ok).toBe(false);
    expect(result.body?.attempts_remaining).toBe(4);
  });

  it("surfaces a terminal error when both invoke AND the fallback fetch fail", async () => {
    invokeMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    const fetchMock = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    globalThis.fetch = fetchMock as any;

    const result = await invokeMerchantLoginWithFallback({ phone: "01700000000", pin: "1234" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(true);
    expect(result.body).toBeNull();
    expect(String(result.error?.message)).toMatch(/failed to fetch/i);
  });
});
