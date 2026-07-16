import React from "react";
import { motion } from "framer-motion";
import { X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAgentTxnLabel, isAgentTxnCredit } from "@/lib/agentTransactions";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(n) || 0));

export interface AgentTxnDetailTx {
  id: string;
  short_id?: string | null;
  type: string;
  amount: number;
  fee?: number | null;
  commission?: number | null;
  status?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  description?: string | null;
  balance_after?: number | null;
  created_at: string;
}

interface Props {
  tx: AgentTxnDetailTx;
  onClose: () => void;
  onShare: (tx: AgentTxnDetailTx) => void;
}

const AgentTxnDetailModal = React.forwardRef<HTMLDivElement, Props>(({ tx, onClose, onShare }, ref) => {
  const isCredit = isAgentTxnCredit(tx);
  const status = (tx.status || "completed").toLowerCase();
  const statusCls =
    status === "completed" || status === "success"
      ? "bg-primary/10 text-primary"
      : status === "pending"
        ? "bg-amber-500/10 text-amber-600"
        : "bg-destructive/10 text-destructive";

  const displayType = getAgentTxnLabel(tx);
  const isCashFlow = tx.type === "cashin" || tx.type === "cashout";
  const isB2BReceive =
    tx.type === "receive" &&
    typeof tx.description === "string" &&
    tx.description.toLowerCase().includes("b2b");
  const feeLabelValue =
    Number(tx.fee) > 0
      ? isB2BReceive
        ? `৳${fmt(tx.fee!)} (from receiver)`
        : `৳${fmt(tx.fee!)}`
      : "Free";

  const rows: { label: string; value: string }[] = [
    { label: "Type", value: displayType },
    ...(tx.recipient_name ? [{ label: "Name", value: tx.recipient_name }] : []),
    ...(tx.recipient_phone ? [{ label: "Phone", value: tx.recipient_phone }] : []),
    { label: "Amount", value: `৳${fmt(tx.amount)}` },
    { label: "Fee", value: feeLabelValue },
    ...(isCashFlow || Number(tx.commission) > 0
      ? [{ label: "Commission", value: Number(tx.commission) > 0 ? `+৳${fmt(tx.commission!)}` : "৳0.00" }]
      : []),
    ...(tx.balance_after != null ? [{ label: "Balance After", value: `৳${fmt(tx.balance_after)}` }] : []),
    ...(tx.description ? [{ label: "Description", value: tx.description }] : []),
    { label: "Date", value: new Date(tx.created_at).toLocaleString("en-BD") },
  ];

  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="fixed bottom-0 left-0 right-0 z-[81] bg-card rounded-t-3xl shadow-float max-h-[80vh] overflow-y-auto
                   md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90vw] md:max-w-md md:rounded-3xl"
      >
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/25" /></div>
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-foreground">Transaction Details</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <X size={15} />
            </button>
          </div>
          <div className="text-center py-4">
            <p className={`text-3xl font-extrabold ${isCredit ? "text-primary" : "text-foreground"}`}>
              {isCredit ? "+" : "−"}৳{fmt(tx.amount)}
            </p>
            <Badge className={`mt-2 ${statusCls} border-0 text-[10px] font-bold`}>{status}</Badge>
          </div>
          <Card className="border-0 shadow-card rounded-2xl overflow-hidden">
            <div className="divide-y divide-border/50">
              {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-semibold text-foreground text-right max-w-[60%] break-all">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border/50 bg-muted/30">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Transaction ID</p>
              <p className="text-[10px] font-mono font-bold text-primary break-all mt-0.5">{tx.short_id || tx.id}</p>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onShare(tx)} className="rounded-xl h-11 text-xs font-bold gap-2">
              <Share2 size={14} /> Share Receipt
            </Button>
            <Button onClick={onClose} className="gradient-primary text-primary-foreground rounded-xl h-11 text-xs font-bold">
              Done
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
AgentTxnDetailModal.displayName = "AgentTxnDetailModal";

export default AgentTxnDetailModal;
