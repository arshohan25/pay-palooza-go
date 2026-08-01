/**
 * Admin-side ledger vocabulary.
 *
 * IMPORTANT: these labels intentionally do NOT mirror the customer app wording
 * ("Send Money", "Cash Out", "Received"). The admin panel is a double-entry
 * ledger view, so every row is described by (a) the accounting direction for the
 * account being inspected and (b) the flow in bookkeeping terms.
 */

export type LedgerDirection = "credit" | "debit";

export type AdminLedgerTxn = {
  type: string;
  description?: string | null;
  commission?: number | null;
  amount?: number | null;
};

const AGENT_CASHOUT_HINTS = ["cash out at", "agent cash out", "customer withdrew"];

/** True when the row represents an agent-side cash-out (customer withdrawal). */
export const isAgentCashOutRow = (tx: AdminLedgerTxn) => {
  const desc = (tx.description || "").trim().toLowerCase();
  const hint = AGENT_CASHOUT_HINTS.some((h) => desc.includes(h));
  return (tx.type === "cashin" && hint) || (tx.type === "cashout" && (hint || Number(tx.commission || 0) > 0));
};

/** True when the row belongs to an agent/partner ledger rather than a customer wallet. */
export const isAgentSideRow = (tx: AdminLedgerTxn) => {
  const desc = (tx.description || "").trim().toLowerCase();
  return Number(tx.commission || 0) > 0 || desc.includes("agent cash");
};

/** Normalised flow key used for label lookup. */
export const resolveLedgerFlow = (tx: AdminLedgerTxn): string => {
  if (isAgentCashOutRow(tx)) return "cashout";
  return (tx.type || "unknown").toLowerCase();
};

export function resolveLedgerDirection(tx: AdminLedgerTxn): LedgerDirection {
  if (isAgentSideRow(tx)) {
    // Agent receives e-money when a customer cashes out, and pays out e-money on cash-in.
    return isAgentCashOutRow(tx) ? "credit" : "debit";
  }
  return ["receive", "addmoney", "cashin", "refund", "reversal", "deposit"].includes((tx.type || "").toLowerCase())
    ? "credit"
    : "debit";
}

const CUSTOMER_FLOW_LABELS: Record<string, string> = {
  send: "P2P Transfer Out",
  receive: "P2P Transfer In",
  cashin: "Cash-In Received (Agent Funded)",
  cashout: "Cash-Out Withdrawal",
  payment: "Merchant Settlement Debit",
  recharge: "Airtime Purchase",
  paybill: "Biller Settlement Debit",
  addmoney: "Wallet Top-Up (Gateway)",
  banktransfer: "Bank Payout",
  chargeback: "Chargeback Debit",
  deposit: "Ledger Deposit",
  refund: "Refund Credit",
  reversal: "Reversal Credit",
};

const AGENT_FLOW_LABELS: Record<string, string> = {
  cashin: "Agent Cash-In Disbursement",
  cashout: "Agent Cash-Out Collection",
  banktransfer: "Agent Bank Payout",
  send: "Agent B2B Transfer Out",
  receive: "Agent B2B Transfer In",
  payment: "Agent Merchant Settlement",
  paybill: "Agent Biller Settlement",
  recharge: "Agent Airtime Purchase",
};

/** Admin ledger label. Never reuse customer-app phrasing. */
export function resolveAdminLedgerLabel(tx: AdminLedgerTxn): string {
  const flow = resolveLedgerFlow(tx);
  if (isAgentSideRow(tx)) {
    return AGENT_FLOW_LABELS[flow] || CUSTOMER_FLOW_LABELS[flow] || `Unclassified (${flow})`;
  }
  return CUSTOMER_FLOW_LABELS[flow] || `Unclassified (${flow})`;
}

/** Party column heading, resolved by direction. */
export const resolveCounterpartyLabel = (tx: AdminLedgerTxn) =>
  resolveLedgerDirection(tx) === "credit" ? "Payer / Source account" : "Payee / Destination account";

/** Whose income the commission belongs to (never the customer's). */
export const resolveCommissionOwner = (tx: AdminLedgerTxn) =>
  Number(tx.commission || 0) > 0 ? "Agent commission earned" : "Agent commission (none)";

export const formatBdt = (n: any) =>
  `৳${new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(Number(n) || 0),
  )}`;
