type AgentTxnLike = {
  type: string;
  description?: string | null;
  commission?: number | null;
};

const AGENT_TXN_LABELS: Record<string, string> = {
  send: "Send Money",
  receive: "Received",
  cashout: "Cash Out",
  cashin: "Cash In",
  banktransfer: "Bank Transfer",
  payment: "Payment",
  recharge: "Recharge",
  paybill: "Bill Pay",
  addmoney: "Add Money",
};

export const isAgentCashOutTxn = (tx: AgentTxnLike) => {
  const description = (tx.description || "").trim().toLowerCase();
  const hasCashOutDescription =
    description.startsWith("cash out at") ||
    description.includes("agent cash out") ||
    description.includes("customer withdrew");

  return (
    (tx.type === "cashin" && hasCashOutDescription) ||
    (tx.type === "cashout" && (hasCashOutDescription || Number(tx.commission || 0) > 0))
  );
};

export const getAgentDisplayType = (tx: AgentTxnLike) => {
  if (isAgentCashOutTxn(tx)) return "cashout";
  return tx.type;
};

export const isAgentTxnCredit = (tx: AgentTxnLike) => {
  const displayType = getAgentDisplayType(tx);
  return displayType === "cashout" || displayType === "receive" || displayType === "addmoney";
};

export const getAgentTxnLabel = (tx: AgentTxnLike) => {
  const displayType = getAgentDisplayType(tx);
  return AGENT_TXN_LABELS[displayType] || displayType;
};