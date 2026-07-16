import { describe, it, expect } from "vitest";
import {
  isAgentCashOutTxn,
  getAgentDisplayType,
  isAgentTxnCredit,
  getAgentTxnLabel,
} from "@/lib/agentTransactions";

describe("agentTransactions helpers", () => {
  it("classifies agent cash-in row (from agent_cashin RPC) as a cashin debit with commission", () => {
    const tx = {
      type: "cashin",
      description: "Agent Cash In",
      commission: 24.95,
    };
    expect(isAgentCashOutTxn(tx)).toBe(false);
    expect(getAgentDisplayType(tx)).toBe("cashin");
    expect(getAgentTxnLabel(tx)).toBe("Cash In");
    expect(isAgentTxnCredit(tx)).toBe(false);
    expect(Number(tx.commission)).toBeGreaterThan(0);
  });

  it("still classifies agent cash-out row (cashout type + commission) as a cashout credit", () => {
    const tx = { type: "cashout", description: "Agent Cash Out", commission: 30 };
    expect(isAgentCashOutTxn(tx)).toBe(true);
    expect(getAgentDisplayType(tx)).toBe("cashout");
    expect(isAgentTxnCredit(tx)).toBe(true);
    expect(getAgentTxnLabel(tx)).toBe("Cash Out");
  });

  it("handles cash-in with zero commission (customer-side row) safely", () => {
    const tx = { type: "cashin", description: "Agent Cash In", commission: 0 };
    expect(isAgentCashOutTxn(tx)).toBe(false);
    expect(getAgentTxnLabel(tx)).toBe("Cash In");
    expect(isAgentTxnCredit(tx)).toBe(false);
  });
});
