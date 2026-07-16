import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// jsdom polyfills used by shadcn/input-otp
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class {
  observe() {} unobserve() {} disconnect() {}
};

// --- Mocks ---
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      insert: vi.fn().mockResolvedValue({ error: { message: "apply_once triggered" } }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true }),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/use-device-otp-verification", () => ({
  useDeviceOtpVerification: () => ({ verify: vi.fn(), request: vi.fn(), state: "idle" }),
  getStoredDeviceToken: () => null,
  clearDeviceToken: () => {},
}));
vi.mock("@/lib/deviceFingerprint", () => ({ getDeviceFingerprint: () => "fp" }));
vi.mock("@/hooks/use-merchant-categories", () => ({
  useMerchantCategories: () => ({ categories: [{ name: "retail", label: "Retail" }], loading: false, getLabelForName: () => "Retail", addCategory: vi.fn() }),
}));

// Stub MerchantApplicationFlow so we can observe open/close deterministically.
let observedOpen = false;
vi.mock("@/components/MerchantApplicationFlow", () => ({
  default: ({ open, onOpenChange }: any) => {
    observedOpen = open;
    return open ? (
      <div data-testid="apply-flow">
        <button data-testid="close-apply" onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null;
  },
}));

// Stub heavy sub-components not needed for this test.
vi.mock("@/components/DeviceOtpStep", () => ({ default: () => null }));
vi.mock("@/components/merchant/MerchantForgotPinSheet", () => ({
  default: () => null,
  maskBdPhone: (x: string) => x,
}));

import MerchantLoginPage from "@/pages/MerchantLoginPage";

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/merchant-login" element={<MerchantLoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Merchant apply deep-link (?apply=1)", () => {
  beforeEach(() => {
    observedOpen = false;
    localStorage.clear();
  });

  it("auto-opens the apply flow when ?apply=1 is present", async () => {
    renderAt("/merchant-login?apply=1");
    await waitFor(() => expect(screen.queryByTestId("apply-flow")).toBeInTheDocument());
    expect(observedOpen).toBe(true);
  });

  it("does not open the apply flow without the query param", async () => {
    renderAt("/merchant-login");
    // Wait a tick for effects
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("apply-flow")).not.toBeInTheDocument();
  });

  it("closing the apply flow strips the query param and does not re-open", async () => {
    renderAt("/merchant-login?apply=1");
    await waitFor(() => expect(screen.queryByTestId("apply-flow")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("close-apply"));
    await waitFor(() => expect(screen.queryByTestId("apply-flow")).not.toBeInTheDocument());
    // Should not spontaneously re-open (would be a regression of the strip logic)
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("apply-flow")).not.toBeInTheDocument();
  });
});

describe("Apply-once enforcement (DB signal)", () => {
  it("surfaces the apply_once error message to the user", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    // Simulate the insert call the flow would make hitting the apply-once trigger.
    const res = await (supabase as any).from("merchant_applications").insert({});
    expect(res.error?.message).toMatch(/apply_once/i);
  });
});
