import { useMemo, useState } from "react";
import { Copy, ArrowDownLeft, ArrowUpRight, Receipt, Building2, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getAgentTxnLabel, isAgentCashOutTxn } from "@/lib/agentTransactions";

export interface AdminTxnRow {
  id: string;
  short_id?: string | null;
  user_id?: string | null;
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
  [k: string]: any;
}

const money = (n: any) =>
  `৳${new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(Number(n) || 0),
  )}`;

/**
 * Ledger direction from the perspective of the account whose profile is open.
 * Agent-side rows (commission earned / "cash out at ..." descriptions) are
 * classified by flow, not by the raw `type` column.
 */
export function resolveTxnDirection(tx: AdminTxnRow): "credit" | "debit" {
  const desc = (tx.description || "").toLowerCase();
  const isAgentSide = Number(tx.commission || 0) > 0 || desc.includes("agent cash");

  if (isAgentSide) {
    // Agent receives e-money when a customer cashes out; pays out e-money on cash-in.
    return isAgentCashOutTxn(tx) ? "credit" : "debit";
  }
  return ["receive", "addmoney", "cashin", "refund", "reversal", "deposit"].includes(tx.type)
    ? "credit"
    : "debit";
}

export function resolveTxnLabel(tx: AdminTxnRow) {
  return getAgentTxnLabel(tx);
}

const statusTone = (s: string) =>
  s === "completed" || s === "success"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : s === "pending" || s === "processing"
      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
      : "bg-destructive/10 text-destructive border-destructive/30";

export default function AdminTxnDetailDialog({
  tx,
  onClose,
}: {
  tx: AdminTxnRow;
  onClose: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const direction = useMemo(() => resolveTxnDirection(tx), [tx]);
  const label = resolveTxnLabel(tx);
  const status = (tx.status || "completed").toLowerCase();
  const isCredit = direction === "credit";
  const net = (Number(tx.amount) || 0) + (isCredit ? 1 : -1) * 0; // amount is gross

  const copy = (v: string, what: string) => {
    void navigator.clipboard.writeText(v);
    toast.success(`${what} copied`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4" /> Transaction record
          </DialogTitle>
        </DialogHeader>

        {/* Ledger header */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`border text-[10px] font-bold uppercase ${
                    isCredit
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                  }`}
                >
                  {isCredit ? <ArrowDownLeft className="w-3 h-3 mr-1" /> : <ArrowUpRight className="w-3 h-3 mr-1" />}
                  {isCredit ? "Credit" : "Debit"}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{label}</Badge>
                <Badge className={`border text-[10px] uppercase ${statusTone(status)}`}>{status}</Badge>
              </div>
              <p className={`mt-2 text-2xl font-bold ${isCredit ? "text-emerald-600" : "text-foreground"}`}>
                {isCredit ? "+" : "−"}
                {money(tx.amount)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(tx.created_at).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "medium" })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference</p>
              <button
                onClick={() => copy(tx.short_id || tx.id, "Reference")}
                className="text-xs font-mono font-semibold text-primary inline-flex items-center gap-1 hover:underline"
              >
                {tx.short_id || tx.id.slice(0, 12)} <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Amount breakdown */}
        <section className="grid sm:grid-cols-2 gap-3">
          <Field label="Gross amount" value={money(tx.amount)} />
          <Field label="Fee charged" value={money(tx.fee)} />
          <Field label="Agent commission" value={Number(tx.commission || 0) > 0 ? `+${money(tx.commission)}` : money(0)} />
          <Field
            label="Balance after"
            value={tx.balance_after != null ? money(tx.balance_after) : "—"}
          />
        </section>

        {/* Parties */}
        <section>
          <SectionTitle icon={Building2}>Parties</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Counterparty name" value={tx.recipient_name || "—"} />
            <Field label="Counterparty phone" value={tx.recipient_phone || "—"} mono />
            <Field label="Account holder (user_id)" value={tx.user_id || "—"} mono />
            <Field label="Narration" value={tx.description || "—"} />
          </div>
        </section>

        {/* System */}
        <section>
          <SectionTitle icon={Hash}>System</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Raw type" value={tx.type} mono />
            <Field label="Resolved flow" value={label} />
            <Field label="Transaction UUID" value={tx.id} mono />
            <Field label="Status" value={status} mono />
          </div>
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => setShowRaw((v) => !v)} className="text-xs">
              {showRaw ? "Hide raw record" : "Show raw record"}
            </Button>
            {showRaw && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/50 border border-border/60 p-3 text-[10px] font-mono">
                {JSON.stringify(tx, null, 2)}
              </pre>
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
      <Icon className="w-3.5 h-3.5" /> {children}
    </h4>
  );
}

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
