import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AgentTxnDetailModal, { AgentTxnDetailTx } from "@/components/agent/AgentTxnDetailModal";

const baseTx: AgentTxnDetailTx = {
  id: "1",
  type: "cashin",
  amount: 5000,
  fee: 0,
  commission: 24.95,
  status: "completed",
  recipient_name: "Rahim",
  recipient_phone: "01700000000",
  description: "Agent Cash In",
  balance_after: 12345,
  created_at: new Date().toISOString(),
};

describe("AgentTxnDetailModal commission display", () => {
  it("shows Commission row with earned value for agent cash-in", () => {
    render(<AgentTxnDetailModal tx={baseTx} onClose={() => {}} onShare={() => {}} />);
    expect(screen.getByText("Commission")).toBeInTheDocument();
    expect(screen.getByText(/\+৳24\.95/)).toBeInTheDocument();
  });

  it("still shows Commission row for cash-in when commission is 0", () => {
    render(
      <AgentTxnDetailModal
        tx={{ ...baseTx, id: "2", commission: 0 }}
        onClose={() => {}}
        onShare={() => {}}
      />
    );
    expect(screen.getByText("Commission")).toBeInTheDocument();
    expect(screen.getByText("৳0.00")).toBeInTheDocument();
  });

  it("does not render a Fee row", () => {
    render(<AgentTxnDetailModal tx={baseTx} onClose={() => {}} onShare={() => {}} />);
    expect(screen.queryByText("Fee")).not.toBeInTheDocument();
  });
});
