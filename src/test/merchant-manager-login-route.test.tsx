import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useMerchantSessionWatchdog } from "@/hooks/use-merchant-session-watchdog";

// Mock supabase: simulate "no session" so the watchdog would normally trigger
// a redirect to /merchant-login. The fix should keep it from doing so on
// /merchant-manager-login.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function HarnessWithWatchdog({ onLocation }: { onLocation: (p: string) => void }) {
  useMerchantSessionWatchdog();
  const Probe = () => {
    const loc = useLocation();
    onLocation(loc.pathname);
    return <div data-testid="page">{loc.pathname}</div>;
  };
  return (
    <Routes>
      <Route path="/merchant-manager-login" element={<Probe />} />
      <Route path="/merchant-login" element={<Probe />} />
    </Routes>
  );
}

describe("/merchant-manager-login route health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays on /merchant-manager-login when unauthenticated (not redirected to /merchant-login)", async () => {
    const seen: string[] = [];
    render(
      <MemoryRouter initialEntries={["/merchant-manager-login"]}>
        <HarnessWithWatchdog onLocation={(p) => seen.push(p)} />
      </MemoryRouter>,
    );

    // Let the watchdog's initial async tick (getSession) resolve.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const final = seen[seen.length - 1];
    expect(final).toBe("/merchant-manager-login");
    expect(seen).not.toContain("/merchant-login");
  });
});
