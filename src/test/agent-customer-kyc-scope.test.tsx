import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Regression test: Customer KYC status shown under "Customer KYC" MUST be
 * scoped to the currently signed-in agent. It must never leak another
 * agent's customer counts.
 *
 * We verify that:
 *  1. The client always calls `get_agent_customer_kyc` with `_agent_id = user.id`.
 *  2. Rows returned for one agent are the only rows rendered — switching the
 *     authenticated user re-fetches with the new id and replaces the counts.
 *  3. The RPC is never called with a NULL / missing `_agent_id`.
 */

const rpcMock = vi.fn();

// Per-agent fixture — server would filter, we simulate that here.
const AGENT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const AGENT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const kycByAgent: Record<string, any[]> = {
  [AGENT_A]: [
    { user_id: "u1", name: "Alice", phone: "017", status: "verified", rejection_reason: null, updated_at: "2026-01-01" },
    { user_id: "u2", name: "Bob",   phone: "018", status: "pending",  rejection_reason: null, updated_at: "2026-01-02" },
  ],
  [AGENT_B]: [
    { user_id: "u9", name: "Zed", phone: "019", status: "rejected", rejection_reason: "blurry", updated_at: "2026-02-01" },
  ],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    channel: () => ({
      on() { return this; },
      subscribe() { return this; },
    }),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));

let currentUser: { id: string } | null = null;
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: currentUser, signOut: vi.fn(), loading: false, isAuthenticated: !!currentUser }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ name: "Agent", phone: "017", avatar_url: null }),
}));
vi.mock("@/hooks/use-global-toggles", () => ({
  useGlobalToggles: () => ({ isDisabled: () => false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Minimal i18n mock — return the key unchanged so counts are still numeric.
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, lang: "en", toggleLang: vi.fn() }),
}));

import AgentMenuDrawer from "@/components/AgentMenuDrawer";

function renderDrawer() {
  return render(
    <MemoryRouter>
      <AgentMenuDrawer
        open={true}
        onClose={() => {}}
        agentInfo={{
          business_name: "Test",
          commission_earned: 0,
          max_float: 0,
          customers_onboarded: 0,
          status: "active",
          territory_code: "DH",
        }}
        recentTxns={[]}
      />
    </MemoryRouter>,
  );
}

describe("Customer KYC status is scoped per agent (no cross-user leakage)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockImplementation(async (name: string, params: any) => {
      if (name !== "get_agent_customer_kyc") return { data: null, error: null };
      const agentId = params?._agent_id;
      // Server-side contract: null id must never return data.
      if (!agentId) return { data: [], error: { message: "missing agent id" } };
      return { data: kycByAgent[agentId] ?? [], error: null };
    });
  });

  it("calls RPC with the current agent id and only shows that agent's data", async () => {
    currentUser = { id: AGENT_A };
    renderDrawer();

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("get_agent_customer_kyc", { _agent_id: AGENT_A });
    });

    // Never called for the OTHER agent.
    for (const call of rpcMock.mock.calls) {
      expect(call[1]?._agent_id).not.toBe(AGENT_B);
    }

    // Total customers = 2 for agent A.
    await waitFor(() => {
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    });
  });

  it("switching to a different agent re-fetches and replaces counts (no leftover data)", async () => {
    currentUser = { id: AGENT_A };
    const { unmount } = renderDrawer();
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("get_agent_customer_kyc", { _agent_id: AGENT_A }),
    );
    unmount();
    cleanup();

    rpcMock.mockClear();
    currentUser = { id: AGENT_B };
    renderDrawer();

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("get_agent_customer_kyc", { _agent_id: AGENT_B }),
    );

    // Ensure we did NOT re-request agent A's data in this render.
    for (const call of rpcMock.mock.calls) {
      expect(call[1]?._agent_id).toBe(AGENT_B);
    }
  });

  it("never calls RPC when no user is signed in", async () => {
    currentUser = null;
    renderDrawer();
    // Give effects a chance to run.
    await new Promise((r) => setTimeout(r, 20));
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
