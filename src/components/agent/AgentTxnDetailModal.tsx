import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Share2, Bug, Loader2, CheckCircle2, AlertCircle, History, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAgentTxnLabel, isAgentTxnCredit } from "@/lib/agentTransactions";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { downloadTxnReceiptPdf } from "@/lib/txnReceiptPdf";
import { useI18n } from "@/lib/i18n";

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

const inferRpc = (tx: AgentTxnDetailTx): string => {
  const d = (tx.description || "").toLowerCase();
  if (tx.type === "cashin" && !d.includes("cash out")) return "agent_cashin";
  if (tx.type === "send" && d.includes("b2b")) return "agent_b2b_transfer";
  if (tx.type === "receive" && d.includes("b2b")) return "agent_b2b_transfer";
  if (tx.type === "cashout" || (tx.type === "cashin" && d.includes("cash out"))) return "transfer_money (cash-out)";
  return "transfer_money";
};

import { subscribeRealtime } from "@/lib/realtimeManager";

const AgentTxnDetailModal = React.forwardRef<HTMLDivElement, Props>(({ tx: initialTx, onClose, onShare }, ref) => {
  const { t, lang } = useI18n();
  const [tx, setTx] = useState<AgentTxnDetailTx>(initialTx);
  useEffect(() => { setTx(initialTx); }, [initialTx]);

  // Live-refresh this transaction until it settles. Manager de-duplicates by id
  // so multiple detail views for the same txn share one channel.
  useEffect(() => {
    if (!tx.id) return;
    const handle = subscribeRealtime(`txn-detail:${tx.id}`, (ch) =>
      ch.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${tx.id}` },
        (payload) => {
          const row = payload.new as Partial<AgentTxnDetailTx>;
          setTx((prev) => ({ ...prev, ...row }));
        },
      ),
    );
    return () => handle.unsubscribe();
  }, [tx.id]);

  const isCredit = isAgentTxnCredit(tx);
  const { isAdmin } = useAdmin();
  const [showDebug, setShowDebug] = useState(false);
  const [reconLoading, setReconLoading] = useState(false);
  const [recon, setRecon] = useState<any>(null);
  const [reconErr, setReconErr] = useState<string | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const status = (tx.status || "completed").toLowerCase();
  const statusCls =
    status === "completed" || status === "success"
      ? "bg-primary/10 text-primary"
      : status === "pending"
        ? "bg-amber-500/10 text-amber-600"
        : "bg-destructive/10 text-destructive";

  const displayType = getAgentTxnLabel(tx);
  const isCashFlow = tx.type === "cashin" || tx.type === "cashout";
  const rpcName = inferRpc(tx);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("list_txn_reconciliation_checks", { p_txn_id: tx.id, p_limit: 20 });
      if (error) throw error;
      setHistory((data as any[]) ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (showDebug && isAdmin && history === null) void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDebug, isAdmin]);

  const runRecon = async () => {
    setReconLoading(true); setReconErr(null); setRecon(null);
    try {
      const { data, error } = await (supabase as any).rpc("reconcile_txn_treasury", { p_txn_id: tx.id });
      if (error) throw error;
      setRecon(data);
      void loadHistory();
    } catch (e: any) {
      setReconErr(e?.message || "Reconcile failed");
    } finally {
      setReconLoading(false);
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: t("atdmType"), value: displayType },
    ...(tx.recipient_name ? [{ label: t("atdmName"), value: tx.recipient_name }] : []),
    ...(tx.recipient_phone ? [{ label: t("atdmPhone"), value: tx.recipient_phone }] : []),
    { label: t("atdmAmount"), value: `৳${fmt(tx.amount)}` },
    ...(isCashFlow || Number(tx.commission) > 0
      ? [{ label: t("atdmCommission"), value: Number(tx.commission) > 0 ? `+৳${fmt(tx.commission!)}` : "৳0.00" }]
      : []),
    ...(tx.balance_after != null ? [{ label: t("atdmBalanceAfter"), value: `৳${fmt(tx.balance_after)}` }] : []),
    ...(tx.description ? [{ label: t("atdmDescription"), value: tx.description }] : []),
    { label: t("atdmDate"), value: new Date(tx.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD") },
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
            <h3 className="text-base font-extrabold text-foreground">{t("atdmTitle")}</h3>
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
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{t("atdmTxnId")}</p>
              <p className="text-[10px] font-mono font-bold text-primary break-all mt-0.5">{tx.short_id || tx.id}</p>
            </div>
          </Card>

          {isAdmin && (
          <div data-testid="advanced-debug" className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
            <button
              onClick={() => setShowDebug(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted/40"
            >
              <span className="flex items-center gap-1.5"><Bug size={12} /> Advanced Debug <Badge className="bg-primary/15 text-primary border-0 text-[9px] ml-1">admin</Badge></span>
              <span>{showDebug ? "Hide" : "Show"}</span>
            </button>
            {showDebug && (
              <div className="px-4 py-3 border-t border-border/50 space-y-3 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[9px] uppercase text-muted-foreground">RPC</p><p className="font-mono font-semibold">{rpcName}</p></div>
                  <div><p className="text-[9px] uppercase text-muted-foreground">Txn Type</p><p className="font-mono font-semibold">{tx.type}</p></div>
                  <div><p className="text-[9px] uppercase text-muted-foreground">commission (raw)</p><p className="font-mono font-semibold">{tx.commission ?? "null"}</p></div>
                  <div><p className="text-[9px] uppercase text-muted-foreground">fee (raw)</p><p className="font-mono font-semibold">{tx.fee ?? "null"}</p></div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Commission source: <span className="font-mono">transactions.commission</span>
                  {" · "}displayed when <span className="font-mono">cashin/cashout</span> or <span className="font-mono">commission &gt; 0</span>.
                </p>
                <div className="pt-1">
                  <Button size="sm" variant="outline" onClick={runRecon} disabled={reconLoading} className="h-8 text-[11px] gap-1.5">
                    {reconLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Reconcile treasury
                  </Button>
                </div>
                {reconErr && (
                  <p className="text-destructive flex items-center gap-1"><AlertCircle size={11} /> {reconErr}</p>
                )}
                {recon && (
                  <div data-testid="recon-result" className={`rounded-lg p-2 border ${recon.matches ? "border-emerald-400/40 bg-emerald-500/5" : "border-amber-400/40 bg-amber-500/5"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{recon.matches ? "✓ Matches" : "✗ Mismatch"}</span>
                      <span className="font-mono">expected ৳{fmt(Number(recon.expected_amount))} · ledger ৳{fmt(Number(recon.ledger_amount))}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 break-all">ref: {recon.txn_reference || "—"} · entries: {Array.isArray(recon.entries) ? recon.entries.length : 0}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-border/50">
                  <p className="text-[9px] uppercase text-muted-foreground font-semibold flex items-center gap-1 mb-1.5">
                    <History size={11} /> Reconciliation history
                  </p>
                  {historyLoading ? (
                    <p className="text-muted-foreground flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Loading…</p>
                  ) : !history || history.length === 0 ? (
                    <p className="text-muted-foreground">No prior checks.</p>
                  ) : (
                    <ul data-testid="recon-history" className="space-y-1 max-h-40 overflow-y-auto">
                      {history.map((h) => (
                        <li
                          key={h.id}
                          className={`flex items-center justify-between rounded px-2 py-1 border ${
                            h.matches
                              ? "border-emerald-400/30 bg-emerald-500/5"
                              : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                          }`}
                        >
                          <span className="flex items-center gap-1 font-mono">
                            {h.matches ? <CheckCircle2 size={11} className="text-emerald-600" /> : <AlertCircle size={11} />}
                            {new Date(h.created_at).toLocaleString("en-BD")}
                          </span>
                          <span className="font-mono text-[10px]">
                            ৳{fmt(Number(h.expected_amount))} / ৳{fmt(Number(h.ledger_amount))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
          <Button
            variant="outline"
            onClick={() =>
              downloadTxnReceiptPdf({
                id: tx.id,
                short_id: tx.short_id,
                type: tx.type,
                typeLabel: displayType,
                amount: tx.amount,
                fee: tx.fee,
                commission: tx.commission,
                status: tx.status,
                party_name: tx.recipient_name,
                party_phone: tx.recipient_phone,
                description: tx.description,
                balance_after: tx.balance_after,
                created_at: tx.created_at,
                isCredit,
              })
            }
            className="w-full rounded-xl h-11 text-xs font-bold gap-2"
          >
            <Download size={14} />
            {status === "completed" || status === "success"
              ? t("atdmDlReceipt")
              : status === "pending" || status === "processing"
                ? t("atdmDlPending")
                : t("atdmDlFailed")}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onShare(tx)} className="rounded-xl h-11 text-xs font-bold gap-2">
              <Share2 size={14} /> {t("atdmShare")}
            </Button>
            <Button onClick={onClose} className="gradient-primary text-primary-foreground rounded-xl h-11 text-xs font-bold">
              {t("atdmDone")}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
AgentTxnDetailModal.displayName = "AgentTxnDetailModal";

export default AgentTxnDetailModal;
