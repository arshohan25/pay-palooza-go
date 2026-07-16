import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AgentTxnDetailModal, { AgentTxnDetailTx } from "@/components/agent/AgentTxnDetailModal";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: any) => rpcMock(name, args),
  },
}));

const isAdminMock = vi.fn();
vi.mock("@/hooks/use-admin", () => ({
  useAdmin: () => ({ isAdmin: isAdminMock(), loading: false }),
}));

const b2bReceiveTx: AgentTxnDetailTx = {
  id: "txn-1",
  type: "receive",
  amount: 500,
  fee: 2,
  commission: 0,
  status: "completed",
  recipient_name: "Karim",
  recipient_phone: "01711111111",
  description: "B2B Transfer",
  balance_after: 10000,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  rpcMock.mockReset();
  isAdminMock.mockReset();
});

describe("Advanced Debug visibility", () => {
  it("hides Advanced Debug for non-admin users", () => {
    isAdminMock.mockReturnValue(false);
    render(<AgentTxnDetailModal tx={b2bReceiveTx} onClose={() => {}} onShare={() => {}} />);
    expect(screen.queryByTestId("advanced-debug")).not.toBeInTheDocument();
    expect(screen.queryByText(/commission \(raw\)/i)).not.toBeInTheDocument();
  });

  it("shows Advanced Debug for admin users", () => {
    isAdminMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: [], error: null });
    render(<AgentTxnDetailModal tx={b2bReceiveTx} onClose={() => {}} onShare={() => {}} />);
    expect(screen.getByTestId("advanced-debug")).toBeInTheDocument();
  });
});

describe("reconcile_txn_treasury RPC integration", () => {
  it("marks a match when treasury credit equals the B2B fee", async () => {
    isAdminMock.mockReturnValue(true);
    rpcMock.mockImplementation((name) => {
      if (name === "list_txn_reconciliation_checks") return Promise.resolve({ data: [], error: null });
      if (name === "reconcile_txn_treasury")
        return Promise.resolve({
          data: {
            txn_id: b2bReceiveTx.id,
            txn_type: "receive",
            txn_reference: "REF-1",
            expected_amount: 2,
            ledger_amount: 2,
            matches: true,
            entries: [{ type: "earning", amount: 2 }],
          },
          error: null,
        });
      return Promise.resolve({ data: null, error: null });
    });

    render(<AgentTxnDetailModal tx={b2bReceiveTx} onClose={() => {}} onShare={() => {}} />);
    fireEvent.click(screen.getByText(/Advanced Debug/i));
    fireEvent.click(screen.getByText(/Reconcile treasury/i));

    await waitFor(() => {
      const el = screen.getByTestId("recon-result");
      expect(el.textContent).toMatch(/Matches/);
      expect(el.textContent).toMatch(/expected ৳2\.00/);
      expect(el.textContent).toMatch(/ledger ৳2\.00/);
    });
  });

  it("flags mismatch when treasury credit does not match the B2B fee", async () => {
    isAdminMock.mockReturnValue(true);
    rpcMock.mockImplementation((name) => {
      if (name === "list_txn_reconciliation_checks") return Promise.resolve({ data: [], error: null });
      if (name === "reconcile_txn_treasury")
        return Promise.resolve({
          data: {
            txn_id: b2bReceiveTx.id,
            txn_type: "receive",
            txn_reference: "REF-2",
            expected_amount: 2,
            ledger_amount: 0,
            matches: false,
            entries: [],
          },
          error: null,
        });
      return Promise.resolve({ data: null, error: null });
    });

    render(<AgentTxnDetailModal tx={b2bReceiveTx} onClose={() => {}} onShare={() => {}} />);
    fireEvent.click(screen.getByText(/Advanced Debug/i));
    fireEvent.click(screen.getByText(/Reconcile treasury/i));

    await waitFor(() => {
      const el = screen.getByTestId("recon-result");
      expect(el.textContent).toMatch(/Mismatch/);
      expect(el.textContent).toMatch(/expected ৳2\.00/);
      expect(el.textContent).toMatch(/ledger ৳0\.00/);
    });
  });

  it("renders reconciliation history and highlights past mismatches", async () => {
    isAdminMock.mockReturnValue(true);
    rpcMock.mockImplementation((name) => {
      if (name === "list_txn_reconciliation_checks")
        return Promise.resolve({
          data: [
            { id: "c1", created_at: new Date().toISOString(), matches: false, expected_amount: 2, ledger_amount: 0 },
            { id: "c2", created_at: new Date().toISOString(), matches: true, expected_amount: 2, ledger_amount: 2 },
          ],
          error: null,
        });
      return Promise.resolve({ data: null, error: null });
    });

    render(<AgentTxnDetailModal tx={b2bReceiveTx} onClose={() => {}} onShare={() => {}} />);
    fireEvent.click(screen.getByText(/Advanced Debug/i));

    await waitFor(() => {
      const list = screen.getByTestId("recon-history");
      expect(list.querySelectorAll("li").length).toBe(2);
      // mismatch row should have amber styling class
      expect(list.innerHTML).toMatch(/amber/);
    });
  });
});
