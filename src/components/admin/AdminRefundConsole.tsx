import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, RotateCcw, Loader2, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import TransactionStatusTimeline from "@/components/TransactionStatusTimeline";
import { useUserRoles } from "@/hooks/use-user-roles";

const REFUND_ROLES = new Set(["admin", "finance", "compliance"]);
const DISPUTE_ROLES = new Set(["admin", "finance", "compliance", "risk"]);

type OrphanRow = {
  transaction_id: string;
  user_id: string;
  amount: number;
  fee: number | null;
  status: string;
  refund_status: string | null;
  reference: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  description: string | null;
  created_at: string;
  settlement_id: string | null;
  settlement_status: string | null;
  flag: string;
};

export default function AdminRefundConsole() {
  const { roles } = useUserRoles();
  const canRefund = roles.some((r) => REFUND_ROLES.has(r));
  const canDispute = roles.some((r) => DISPUTE_ROLES.has(r));
  const [rows, setRows] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("Orphan bill payment — auto-reversal");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("v_orphan_paybills")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as OrphanRow[]) ?? []);
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.reference ?? "").toLowerCase().includes(q) ||
           (r.recipient_name ?? "").toLowerCase().includes(q) ||
           (r.recipient_phone ?? "").toLowerCase().includes(q) ||
           r.transaction_id.toLowerCase().includes(q);
  }), [rows, search]);

  const eligible = filtered.filter((r) => r.settlement_status !== "paid");
  const allSelected = eligible.length > 0 && eligible.every((r) => selected.has(r.transaction_id));

  const toggleAll = () => {
    if (allSelected) { setSelected(new Set()); return; }
    setSelected(new Set(eligible.map((r) => r.transaction_id)));
  };

  const toggleRow = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const totalSelected = useMemo(() =>
    filtered.filter((r) => selected.has(r.transaction_id)).reduce((s, r) => s + Number(r.amount || 0), 0),
    [filtered, selected]);

  const runBulkRefund = async () => {
    if (!selected.size) return;
    if (!canRefund) { toast.error("You don't have permission to approve refunds"); return; }
    setProcessing(true);
    let ok = 0, failed = 0, locked = 0;
    for (const id of Array.from(selected)) {
      const { error } = await supabase.rpc("admin_refund_transaction" as any, { p_txn_id: id, p_reason: reason });
      if (error) {
        if (/already in progress|already refunded|already reversed/i.test(error.message)) locked++;
        else failed++;
        console.error("refund failed:", id, error.message);
      } else { ok++; }
    }
    setProcessing(false);
    setConfirmOpen(false);
    if (ok) toast.success(`Refunded ${ok} transaction${ok === 1 ? "" : "s"}`);
    if (locked) toast.info(`${locked} skipped — already refunded or locked`);
    if (failed) toast.error(`${failed} refund${failed === 1 ? "" : "s"} failed — see console`);
    load();
  };

  const openDispute = async (settlementId: string | null, txnId: string) => {
    if (!settlementId) { toast.error("This paybill has no settlement row to dispute"); return; }
    if (!canDispute) { toast.error("You don't have permission to open disputes"); return; }
    const reason = window.prompt("Reason for dispute (required)");
    if (!reason?.trim()) return;
    setDisputing(txnId);
    const { error } = await supabase.rpc("admin_open_paybill_dispute" as any, {
      p_settlement_id: settlementId, p_reason: reason.trim(),
    });
    setDisputing(null);
    if (error) toast.error(error.message);
    else { toast.success("Dispute opened — awaiting provider evidence"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert size={18} className="text-fuchsia-500" />
            Admin Refund Console
          </h2>
          <p className="text-xs text-muted-foreground">
            Search orphan paybills · bulk-approve refunds · every refund writes a reversal ledger row + notifies the customer.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ref, phone, name, or txn id" className="h-9 text-xs pl-7" />
        </div>
        <Button
          size="sm"
          disabled={!selected.size || processing}
          onClick={() => setConfirmOpen(true)}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
        >
          {processing ? <Loader2 size={14} className="animate-spin mr-1" /> : <RotateCcw size={14} className="mr-1" />}
          Refund {selected.size} · ৳{totalSelected}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : eligible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" /> No orphan paybills to refund.
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="p-2 border-b flex items-center gap-2 text-xs">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span className="text-muted-foreground">Select all eligible ({eligible.length})</span>
            </div>
            <div className="divide-y divide-border/40">
              {filtered.map((r) => {
                const ineligible = r.settlement_status === "paid";
                const isSelected = selected.has(r.transaction_id);
                return (
                  <div key={r.transaction_id} className="p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={isSelected}
                        disabled={ineligible}
                        onCheckedChange={() => toggleRow(r.transaction_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {r.recipient_name ?? "Bill"} · ৳{r.amount}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          {r.reference ?? r.transaction_id.slice(0, 8)} · {r.recipient_phone ?? "-"} · {format(new Date(r.created_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {ineligible ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600">Paid — cannot refund</Badge>
                        ) : r.flag === "missing_settlement" ? (
                          <Badge className="bg-red-500/15 text-red-500">Missing settlement</Badge>
                        ) : r.flag === "settlement_failed" ? (
                          <Badge className="bg-red-500/15 text-red-500">Failed</Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">{r.flag.replace(/_/g, " ")}</Badge>
                        )}
                        <button
                          onClick={() => setExpanded(expanded === r.transaction_id ? null : r.transaction_id)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          {expanded === r.transaction_id ? "Hide" : "View"} timeline
                        </button>
                      </div>
                    </div>
                    {expanded === r.transaction_id && (
                      <div className="mt-2">
                        <TransactionStatusTimeline transactionId={r.transaction_id} compact />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund {selected.size} paybill{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Total ৳{totalSelected} will be credited back to customer wallets. Each refund creates a reversal ledger row and sends an in-app notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (stored in audit)" className="text-xs" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={processing} onClick={runBulkRefund} className="bg-fuchsia-600 hover:bg-fuchsia-700">
              {processing ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Approve refunds
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
