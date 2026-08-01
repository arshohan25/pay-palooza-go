import { describe, it, expect } from "vitest";
import {
  resolveAdminLedgerLabel,
  resolveLedgerDirection,
  resolveCounterpartyLabel,
  resolveCommissionOwner,
  isAgentCashOutRow,
  isAgentSideRow,
} from "@/lib/adminLedger";

const CUSTOMER_APP_WORDS = ["Send Money", "Received", "Cash Out", "Cash In", "Bill Pay", "Add Money", "Payment"];

describe("admin ledger labels", () => {
  it("labels a customer cash-out as a withdrawal debit", () => {
    const tx = { type: "cashout", description: "Cash out at Agent Shop", commission: 0 };
    expect(resolveAdminLedgerLabel(tx)).toBe("Cash-Out Withdrawal");
    expect(resolveLedgerDirection(tx)).toBe("debit");
  });

  it("labels the agent side of the same cash-out as a collection credit", () => {
    const tx = { type: "cashin", description: "Cash out at Agent Shop", commission: 30 };
    expect(isAgentSideRow(tx)).toBe(true);
    expect(isAgentCashOutRow(tx)).toBe(true);
    expect(resolveAdminLedgerLabel(tx)).toBe("Agent Cash-Out Collection");
    expect(resolveLedgerDirection(tx)).toBe("credit");
  });

  it("labels agent cash-in as a disbursement debit", () => {
    const tx = { type: "cashin", description: "Agent Cash In", commission: 24.95 };
    expect(resolveAdminLedgerLabel(tx)).toBe("Agent Cash-In Disbursement");
    expect(resolveLedgerDirection(tx)).toBe("debit");
  });

  it("labels customer cash-in received as a credit", () => {
    const tx = { type: "cashin", description: "Wallet funded", commission: 0 };
    expect(resolveAdminLedgerLabel(tx)).toBe("Cash-In Received (Agent Funded)");
    expect(resolveLedgerDirection(tx)).toBe("credit");
  });

  it.each([
    ["send", "P2P Transfer Out", "debit"],
    ["receive", "P2P Transfer In", "credit"],
    ["payment", "Merchant Settlement Debit", "debit"],
    ["paybill", "Biller Settlement Debit", "debit"],
    ["addmoney", "Wallet Top-Up (Gateway)", "credit"],
    ["banktransfer", "Bank Payout", "debit"],
    ["refund", "Refund Credit", "credit"],
    ["reversal", "Reversal Credit", "credit"],
    ["chargeback", "Chargeback Debit", "debit"],
  ])("maps %s to %s (%s)", (type, label, dir) => {
    const tx = { type, description: "", commission: 0 };
    expect(resolveAdminLedgerLabel(tx)).toBe(label);
    expect(resolveLedgerDirection(tx)).toBe(dir);
  });

  it("never mirrors customer app wording", () => {
    const types = ["send", "receive", "cashin", "cashout", "payment", "paybill", "addmoney", "banktransfer", "recharge"];
    for (const type of types) {
      for (const commission of [0, 20]) {
        const label = resolveAdminLedgerLabel({ type, description: "Agent Cash In", commission });
        expect(CUSTOMER_APP_WORDS).not.toContain(label);
      }
    }
  });

  it("falls back to an explicit unclassified label for unknown types", () => {
    expect(resolveAdminLedgerLabel({ type: "weird_flow" })).toBe("Unclassified (weird_flow)");
  });

  it("names the counterparty column by direction and keeps commission with the agent", () => {
    expect(resolveCounterpartyLabel({ type: "receive" })).toBe("Payer / Source account");
    expect(resolveCounterpartyLabel({ type: "send" })).toBe("Payee / Destination account");
    expect(resolveCommissionOwner({ type: "cashin", commission: 10 })).toBe("Agent commission earned");
    expect(resolveCommissionOwner({ type: "send", commission: 0 })).toBe("Agent commission (none)");
  });
});
