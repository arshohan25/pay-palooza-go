import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Integration test: CashOutFlow resolves an agent from valid QR inputs and
 * advances from the Agent step to the Amount step.
 *
 * Renders the real CashOutFlow with a `prefilledAgentId` (which mirrors what
 * Index.tsx passes after a global QR scan hits the cashout branch). The
 * component's mount effect feeds that value through `parseCashOutQrPayload`
 * and `resolve_transfer_recipient`, then calls `goTo("amount")`.
 *
 * We assert:
 *   1. `resolve_transfer_recipient` is invoked with `p_flow: "cashout"` and
 *      the parsed agent identifier (wallet id or phone).
 *   2. The UI advances to the Amount step (renders the `enterAmount` label).
 *   3. Multiple valid QR encodings (bare wallet id, printable JSON payload,
 *      URL with ?agentId=) all resolve and advance.
 *   4. An invalid identifier (personal wallet) does NOT advance — it stays
 *      on the Agent step and surfaces the format error.
 */

const AGENT_WALLET = "EZP-AGNDH-RWGS";
const AGENT_PHONE = "01909709954";
const AGENT_NAME = "EasyPay Agent Shop";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  },
}));

// Return each i18n key verbatim so we can assert on stable strings.
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, lang: "en", toggleLang: vi.fn() }),
}));

vi.mock("@/hooks/use-feature-locks", () => ({
  useFeatureLocks: () => ({ isLocked: () => false, locks: {}, loading: false }),
}));

vi.mock("@/hooks/use-fee-config", () => ({
  useFeeConfig: () => ({
    calcCashOutFee: () => 0,
    getFeeLabel: () => "",
    getAgentCommission: () => 0,
    loading: false,
  }),
}));

// Heavy / side-effecting collaborators — stub to no-op renders so we can
// focus on the resolve → route contract.
vi.mock("@/components/QrScannerModal", () => ({ default: () => null }));
vi.mock("@/components/ShareReceiptSheet", () => ({ default: () => null }));
vi.mock("@/components/AvailableBalanceBadge", () => ({ default: () => null }));
vi.mock("@/components/DailyLimitBadge", () => ({ default: () => null }));
vi.mock("@/components/CouponBanner", () => ({ default: () => null }));
vi.mock("@/components/CouponSummaryLine", () => ({ default: () => null }));
vi.mock("@/components/SlideToConfirm", () => ({ default: () => null }));
vi.mock("@/components/TxnToast", () => ({ showTxnToast: vi.fn() }));
vi.mock("@/components/FeatureGuard", () => ({
  default: ({ children }: any) => <>{children}</>,
}));
vi.mock("@/components/FeatureLockedOverlay", () => ({ default: () => null }));

vi.mock("@/lib/haptics", () => ({
  haptics: { light: vi.fn(), medium: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/confetti", () => ({ fireSuccessConfetti: vi.fn() }));
vi.mock("@/lib/txnNotifStore", () => ({ addTxnNotif: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requestLocation: vi.fn(async () => {}) }));
vi.mock("@/lib/balanceStore", () => ({
  transferMoney: vi.fn(async () => {}),
  getBalance: vi.fn(async () => 100000),
}));
vi.mock("@/lib/verifyPin", () => ({ verifyPin: vi.fn(async () => true) }));
vi.mock("@/lib/dailyLimits", () => ({
  checkDailyLimit: vi.fn(async () => ({ allowed: true, used: 0, limit: 999999 })),
}));
vi.mock("@/lib/couponStore", () => ({
  getPendingCoupon: () => null,
  calcCouponDiscount: () => 0,
  clearPendingCoupon: vi.fn(),
  recordCouponRedemption: vi.fn(async () => {}),
}));

// Framer-motion's AnimatePresence + motion.div: render children synchronously
// so the "amount" step markup is queryable immediately on transition.
vi.mock("framer-motion", () => {
  const passthrough = (tag: string) => {
    const C = ({ children, ...rest }: any) => {
      const { animate, initial, exit, transition, variants, custom, ...html } = rest;
      return <div {...html}>{children}</div>;
    };
    return C;
  };
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(tag) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// Skip geolocation-driven nearby-agents fetch so the render is deterministic.
beforeEach(() => {
  rpcMock.mockReset();
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: undefined,
  });
});

import CashOutFlow from "@/components/CashOutFlow";

const agentFound = {
  found: true,
  recipient_name: AGENT_NAME,
  recipient_phone: AGENT_PHONE,
  recipient_wallet_id: AGENT_WALLET,
  matched_by: "wallet_id",
};

function mountWithPrefill(prefilled: string) {
  return render(
    <CashOutFlow onClose={() => {}} prefilledAgentId={prefilled} />,
  );
}

describe("CashOutFlow · QR-prefilled agent resolves and routes to Amount step", () => {
  const cases: Array<[string, string, string]> = [
    ["bare agent wallet id", AGENT_WALLET, AGENT_WALLET],
    [
      "printable JSON agent payload",
      JSON.stringify({
        app: "EasyPay",
        type: "agent",
        flow: "cashout",
        walletId: AGENT_WALLET,
        agentId: AGENT_WALLET,
        phone: AGENT_PHONE,
        name: AGENT_NAME,
      }),
      AGENT_PHONE,
    ],
    [
      "URL with ?agentId=",
      `https://pay.easypay.app/cashout?agentId=${AGENT_WALLET}`,
      AGENT_WALLET,
    ],
  ];

  for (const [label, prefill, expectedIdentifier] of cases) {
    it(`resolves ${label} → advances to amount step`, async () => {
      rpcMock.mockImplementation(async (name: string, params: any) => {
        if (name === "resolve_transfer_recipient") {
          expect(params.p_flow).toBe("cashout");
          expect(String(params.p_identifier).toUpperCase()).toBe(
            expectedIdentifier.toUpperCase(),
          );
          return { data: agentFound, error: null };
        }
        if (name === "get_nearby_agents") return { data: [], error: null };
        return { data: null, error: null };
      });

      mountWithPrefill(prefill);

      // Amount-step label is rendered once goTo("amount") fires. i18n mock
      // returns the raw key.
      await waitFor(() => {
        expect(screen.getByText("enterAmount")).toBeInTheDocument();
      });

      // resolve_transfer_recipient was called with the cashout flow.
      const resolveCalls = rpcMock.mock.calls.filter(
        ([n]) => n === "resolve_transfer_recipient",
      );
      expect(resolveCalls.length).toBeGreaterThanOrEqual(1);
      expect(resolveCalls[0][1].p_flow).toBe("cashout");

      cleanup();
    });
  }

  it("rejects a personal wallet id prefill — stays on Agent step, no RPC resolve call", async () => {
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "get_nearby_agents") return { data: [], error: null };
      // resolve_transfer_recipient must NOT be reached for a wrong-role
      // wallet — the format gate rejects it first.
      return { data: null, error: null };
    });

    mountWithPrefill("EZP-USER-ABCD");

    // Wait a tick for the mount effect to run.
    await waitFor(() => {
      // Agent-step label ("agentIdLabel") is still visible; amount label is not.
      expect(screen.getByText("agentIdLabel")).toBeInTheDocument();
    });
    expect(screen.queryByText("enterAmount")).not.toBeInTheDocument();

    const resolveCalls = rpcMock.mock.calls.filter(
      ([n]) => n === "resolve_transfer_recipient",
    );
    expect(resolveCalls.length).toBe(0);
  });

  it("surfaces coAgentNotFound when the RPC reports no agent for a valid-format wallet", async () => {
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "resolve_transfer_recipient") {
        return { data: { found: false }, error: null };
      }
      if (name === "get_nearby_agents") return { data: [], error: null };
      return { data: null, error: null };
    });

    mountWithPrefill(AGENT_WALLET);

    await waitFor(() => {
      expect(screen.getByText("coAgentNotFound")).toBeInTheDocument();
    });
    expect(screen.queryByText("enterAmount")).not.toBeInTheDocument();
  });
});
