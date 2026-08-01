import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminTxnRecordInline, { AdminTxnRow } from "@/components/admin/AdminTxnRecordInline";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base: AdminTxnRow = {
  id: "8f2c1d4e-0000-4000-8000-000000000001",
  short_id: "TXN12345",
  user_id: "user-1",
  type: "cashin",
  amount: 5000,
  fee: 0,
  commission: 0,
  status: "completed",
  recipient_name: "Rahim Uddin",
  recipient_phone: "01700000000",
  description: "Wallet funded",
  balance_after: 12345,
  created_at: "2026-07-01T10:00:00.000Z",
};

describe("AdminTxnRecordInline", () => {
  it("renders inline (not inside a dialog)", () => {
    render(<AdminTxnRecordInline tx={base} />);
    expect(screen.getByTestId("admin-txn-record")).toBeInTheDocument();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows customer cash-in as a Credit with admin wording", () => {
    render(<AdminTxnRecordInline tx={base} />);
    expect(screen.getByText("Credit")).toBeInTheDocument();
    expect(screen.getAllByText("Cash-In Received (Agent Funded)").length).toBeGreaterThan(0);
    expect(screen.getByText(/\+৳5,000\.00/)).toBeInTheDocument();
    expect(screen.getByText("Payer / Source account")).toBeInTheDocument();
  });

  it("shows agent cash-in as a Debit disbursement with commission earned", () => {
    render(<AdminTxnRecordInline tx={{ ...base, id: "2", description: "Agent Cash In", commission: 24.95 }} />);
    expect(screen.getByText("Debit")).toBeInTheDocument();
    expect(screen.getAllByText("Agent Cash-In Disbursement").length).toBeGreaterThan(0);
    expect(screen.getByText("Agent commission earned")).toBeInTheDocument();
    expect(screen.getByText("+৳24.95")).toBeInTheDocument();
  });

  it("shows a customer cash-out as a withdrawal debit", () => {
    render(
      <AdminTxnRecordInline
        tx={{ ...base, id: "3", type: "cashout", description: "Cash out at Agent Shop", commission: 0 }}
      />,
    );
    expect(screen.getByText("Debit")).toBeInTheDocument();
    expect(screen.getAllByText("Cash-Out Withdrawal").length).toBeGreaterThan(0);
    expect(screen.getByText(/−৳5,000\.00/)).toBeInTheDocument();
  });

  it("shows the agent side of a cash-out as a collection credit", () => {
    render(
      <AdminTxnRecordInline
        tx={{ ...base, id: "4", type: "cashin", description: "Cash out at Agent Shop", commission: 30 }}
      />,
    );
    expect(screen.getByText("Credit")).toBeInTheDocument();
    expect(screen.getAllByText("Agent Cash-Out Collection").length).toBeGreaterThan(0);
  });

  it("renders the counterparty name and never a flow name in the party field", () => {
    render(<AdminTxnRecordInline tx={{ ...base, id: "5", type: "send", commission: 0 }} />);
    expect(screen.getByText("Payee / Destination account")).toBeInTheDocument();
    expect(screen.getByText("Rahim Uddin")).toBeInTheDocument();
    expect(screen.getByText("01700000000")).toBeInTheDocument();
  });

  it("uses admin ledger vocabulary instead of user-app field names", () => {
    render(<AdminTxnRecordInline tx={base} />);
    expect(screen.getByText("Principal amount")).toBeInTheDocument();
    expect(screen.getByText("Closing balance")).toBeInTheDocument();
    expect(screen.queryByText("Fee")).toBeNull();
    expect(screen.queryByText("Total")).toBeNull();
  });
});
