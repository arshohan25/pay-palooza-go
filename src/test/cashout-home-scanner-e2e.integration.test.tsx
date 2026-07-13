import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * End-to-end integration test: simulates the SAME code path that runs when
 * a user scans an agent QR from the DIRECT HOME-PAGE scanner (Index.tsx's
 * QrScannerModal `onScan` handler).
 *
 * The home-page flow is:
 *   1. QrScannerModal decodes the raw string and passes it to `onScan`.
 *   2. `onScan` calls `parseQrData(result)` (from `@/lib/qrParser`).
 *   3. When `parsed.flow === "cashout"`, it calls
 *      `openCashOutFromQr(parsed.identifier)`, which mounts <CashOutFlow>
 *      with `prefilledAgentId={parsed.identifier}`.
 *
 * This test wires the SAME functions together — `parseQrData` + mounting
 * CashOutFlow with the resulting identifier — and asserts that CashOutFlow
 * reaches the Amount step for every supported agent QR encoding.
 *
 * This specifically protects against regressions where `parsed.identifier`
 * is a non-resolvable value (e.g. a UUID that resolve_transfer_recipient
 * cannot look up), which would leave the user stranded on the Agent step.
 */

const AGENT_WALLET = "EZP-AGNDH-RWGS";
const AGENT_PHONE = "01909709954";
const AGENT_NAME = "EasyPay Agent Shop";
const AGENT_UUID = "11111111-2222-3333-4444-555555555555";

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

vi.mock("framer-motion", () => {
  const passthrough = (_tag: string) => {
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

beforeEach(() => {
  rpcMock.mockReset();
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: undefined,
  });
});

import CashOutFlow from "@/components/CashOutFlow";
import { parseQrData } from "@/lib/qrParser";

const agentFound = {
  found: true,
  recipient_name: AGENT_NAME,
  recipient_phone: AGENT_PHONE,
  recipient_wallet_id: AGENT_WALLET,
  matched_by: "wallet_id",
};

/**
 * Mirrors Index.tsx's home-page QrScannerModal `onScan` for the cashout
 * branch: parses the raw scan result and returns the identifier that
 * would be handed to `openCashOutFromQr` / `<CashOutFlow prefilledAgentId>`.
 */
function simulateHomeScannerCashoutBranch(rawScan: string): {
  flow: string;
  prefill: string;
} {
  const parsed = parseQrData(rawScan);
  return { flow: parsed.flow, prefill: parsed.identifier };
}

describe("Home-page QR scanner → CashOutFlow reaches Amount step (E2E)", () => {
  const cases: Array<{
    label: string;
    raw: string;
  }> = [
    {
      label: "bare agent wallet id",
      raw: AGENT_WALLET,
    },
    {
      label: "agent JSON QR (walletId + phone + agent hint)",
      raw: JSON.stringify({
        app: "EasyPay",
        type: "agent",
        flow: "cashout",
        walletId: AGENT_WALLET,
        agentId: AGENT_UUID,
        phone: AGENT_PHONE,
        name: AGENT_NAME,
      }),
    },
    {
      label: "agent JSON QR without hint but with agent-shaped walletId",
      raw: JSON.stringify({
        walletId: AGENT_WALLET,
        name: AGENT_NAME,
      }),
    },
    {
      label: "cashout URL with ?agentId=<wallet>",
      raw: `https://pay.easypay.app/cashout?agentId=${AGENT_WALLET}`,
    },
    {
      label: "cashout URL with UUID + phone (phone must win over UUID)",
      raw: `https://pay.easypay.app/cashout?agentId=${AGENT_UUID}&phone=${AGENT_PHONE}`,
    },
  ];

  for (const { label, raw } of cases) {
    it(`scanning "${label}" routes cashout and advances to Amount step`, async () => {
      // Step 1 — mirror the exact Index.tsx onScan branch.
      const { flow, prefill } = simulateHomeScannerCashoutBranch(raw);
      expect(flow).toBe("cashout");
      expect(prefill).toBeTruthy();
      // Regression guard: identifier must NEVER be a raw UUID — the RPC
      // resolver cannot look those up, so the home-page path would strand
      // the user on the Agent step.
      expect(prefill).not.toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      // Step 2 — RPC stub matches what the real resolver returns for this agent.
      rpcMock.mockImplementation(async (name: string, params: any) => {
        if (name === "resolve_transfer_recipient") {
          expect(params.p_flow).toBe("cashout");
          const ident = String(params.p_identifier || "").toUpperCase();
          const acceptable = new Set([
            AGENT_WALLET.toUpperCase(),
            AGENT_PHONE.toUpperCase(),
          ]);
          expect(acceptable.has(ident)).toBe(true);
          return { data: agentFound, error: null };
        }
        if (name === "get_nearby_agents") return { data: [], error: null };
        return { data: null, error: null };
      });

      // Step 3 — mount CashOutFlow with the same prefill Index.tsx would pass.
      render(<CashOutFlow onClose={() => {}} prefilledAgentId={prefill} />);

      // Step 4 — the Amount-step label appears once goTo("amount") fires.
      await waitFor(() => {
        expect(screen.getByText("enterAmount")).toBeInTheDocument();
      });

      const resolveCalls = rpcMock.mock.calls.filter(
        ([n]) => n === "resolve_transfer_recipient",
      );
      expect(resolveCalls.length).toBeGreaterThanOrEqual(1);
      expect(resolveCalls[0][1].p_flow).toBe("cashout");

      cleanup();
    });
  }
});
