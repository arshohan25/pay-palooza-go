import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Zap, RotateCcw, CheckCircle2, AlertTriangle, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Row = {
  txn_id: string;
  user_id: string;
  user_name: string | null;
  user_phone: string | null;
  amount: number;
  fee: number;
  reference: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  created_at: string;
  txn_status: string;
  refund_status: string | null;
  settlement_id: string | null;
  settlement_status: string | null; // 'pending' | 'paid' | 'failed' | 'refunded' | null (missing)
  provider_ref: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  eligible:   { label: "Eligible",           cls: "bg-emerald-500/15 text-emerald-500" },
  pending:    { label: "Settlement pending", cls: "bg-amber-500/15 text-amber-500" },
  paid:       { label: "Paid to biller",     cls: "bg-blue-500/15 text-blue-500" },
  failed:     { label: "Settlement failed",  cls: "bg-red-500/15 text-red-500" },
  refunded:   { label: "Refunded",           cls: "bg-fuchsia-500/15 text-fuchsia-400" },
  reversed:   { label: "Reversed",           cls: "bg-fuchsia-500/15 text-fuchsia-400" },
  missing:    { label: "No settlement row",  cls: "bg-orange-500/15 text-orange-400" },
};

function derivedStatus(r: Row): keyof typeof STATUS_META {
  if (r.refund_status === "reversed" || r.refund_status === "refunded") return r.refund_status;
  if (!r.settlement_id) return "missing";
  const s = r.settlement_status || "pending";
  if (s === "paid") return "paid";
  if (s === "failed") return "failed";
  if (s === "refunded") return "refunded";
  // pending settlement = eligible for refund
  return r.txn_status === "completed" ? "eligible" : "pending";
}

export default function AdminBillerSettlements() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [refundTarget, setRefundTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // paybill txns (last 500) with joined settlement + profile
    const { data: txns } = await supabase
      .from("transactions")
      .select("id, user_id, amount, fee, reference, recipient_name, recipient_phone, created_at, status, refund_status")
      .eq("type", "paybill")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = (txns ?? []).map(t => t.id);
    const userIds = Array.from(new Set((txns ?? []).map(t => t.user_id)));
    const [{ data: sets }, { data: profs }] = await Promise.all([
      supabase.from("biller_settlements").select("id, transaction_id, status, provider_ref").in("transaction_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("profiles").select("user_id, name, phone").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const setMap = new Map((sets ?? []).map(s => [s.transaction_id as string, s]));
    const profMap = new Map((profs ?? []).map(p => [p.user_id as string, p]));
    const combined: Row[] = (txns ?? []).map(t => {
      const s = setMap.get(t.id);
      const p = profMap.get(t.user_id);
      return {
        txn_id: t.id,
        user_id: t.user_id,
        user_name: p?.name ?? null,
        user_phone: p?.phone ?? null,
        amount: Number(t.amount),
        fee: Number(t.fee ?? 0),
        reference: t.reference ?? null,
        recipient_name: t.recipient_name ?? null,
        recipient_phone: t.recipient_phone ?? null,
        created_at: t.created_at,
        txn_status: t.status,
        refund_status: (t as any).refund_status ?? null,
        settlement_id: s?.id ?? null,
        settlement_status: s?.status ?? null,
        provider_ref: s?.provider_ref ?? null,
      };
    });
    setRows(combined);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("biller-settlements-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "biller_settlements" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: "type=eq.paybill" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const s = derivedStatus(r);
      if (filter !== "all" && s !== filter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.reference?.toLowerCase().includes(q) ||
        r.recipient_name?.toLowerCase().includes(q) ||
        r.user_phone?.includes(search) ||
        r.user_name?.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const summary = useMemo(() => {
    const c = { total: rows.length, missing: 0, pending: 0, paid: 0, refunded: 0, reversed: 0 };
    rows.forEach(r => {
      const s = derivedStatus(r);
      if (s === "missing") c.missing++;
      else if (s === "pending" || s === "eligible") c.pending++;
      else if (s === "paid") c.paid++;
      else if (s === "refunded") c.refunded++;
      else if (s === "reversed") c.reversed++;
    });
    return c;
  }, [rows]);

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const { data, error } = await supabase.rpc("admin_refund_paybill", {
        p_txn_id: refundTarget.txn_id,
        p_reason: reason || null,
      });
      if (error) throw error;
      const res = data as any;
      toast.success(`Refunded ৳${res.amount} — ref ${res.reference}`);

      // Fire SMS/email confirmation via notify-recipient (best effort)
      try {
        await supabase.functions.invoke("notify-recipient", {
          body: {
            user_id: res.user_id,
            amount: res.amount,
            sender_name: "EasyPay Support",
            reference: res.reference,
            type: "refund",
            txn_id: res.refund_txn_id,
            balance_after: res.new_balance,
            created_at: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.warn("SMS notify failed", e);
      }

      setRefundTarget(null);
      setReason("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Ref", "User", "Phone", "Biller", "Account", "Amount", "Status", "Provider Ref", "Date"];
    const csv = [headers.join(",")].concat(filtered.map(r => [
      r.reference || r.txn_id.slice(0, 8),
      r.user_name || "",
      r.user_phone || "",
      r.recipient_name || "",
      r.recipient_phone || "",
      r.amount,
      derivedStatus(r),
      r.provider_ref || "",
      r.created_at,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `biller-settlements-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Biller Payouts & Refunds
          </h3>
          <p className="text-sm text-muted-foreground">Track paybill funds pending payout to real billers. Refund customers when a bill can't be delivered.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> Export</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Missing settlement</p><p className="text-lg font-bold text-orange-500">{summary.missing}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Pending</p><p className="text-lg font-bold text-amber-500">{summary.pending}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Paid</p><p className="text-lg font-bold text-blue-500">{summary.paid}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Refunded / Reversed</p><p className="text-lg font-bold text-fuchsia-500">{summary.refunded + summary.reversed}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="missing">Missing settlement</SelectItem>
            <SelectItem value="eligible">Eligible for refund</SelectItem>
            <SelectItem value="pending">Settlement pending</SelectItem>
            <SelectItem value="paid">Paid to biller</SelectItem>
            <SelectItem value="failed">Settlement failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search ref, user, biller…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No transactions match this filter</CardContent></Card>
        ) : filtered.map(r => {
          const s = derivedStatus(r);
          const meta = STATUS_META[s];
          const canRefund = s === "eligible" || s === "missing" || s === "failed";
          return (
            <Card key={r.txn_id}>
              <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">{r.recipient_name || "Unknown biller"}</p>
                    <Badge className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {r.user_name || "—"} · {r.user_phone || "—"} · ref <span className="font-mono">{r.reference || r.txn_id.slice(0, 8)}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(r.created_at), "MMM d, yyyy HH:mm")}
                    {r.provider_ref && <> · provider {r.provider_ref}</>}
                  </p>
                </div>
                <div className="text-right sm:min-w-[120px]">
                  <p className="text-lg font-bold text-foreground">৳{r.amount.toLocaleString()}</p>
                  {r.fee > 0 && <p className="text-[10px] text-muted-foreground">+ ৳{r.fee} fee</p>}
                </div>
                {canRefund && (
                  <Button size="sm" variant="outline" onClick={() => setRefundTarget(r)} className="shrink-0">
                    <RotateCcw className="w-4 h-4 mr-1" /> Refund
                  </Button>
                )}
                {s === "paid" && <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />}
                {(s === "refunded" || s === "reversed") && <CheckCircle2 className="w-5 h-5 text-fuchsia-500 shrink-0" />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Refund bill payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {refundTarget && (
                <>Credit ৳{(refundTarget.amount + refundTarget.fee).toLocaleString()} back to <strong>{refundTarget.user_name || refundTarget.user_phone}</strong>, mark the original bill payment as reversed, and notify the customer.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Reason (shown to customer & logged)</label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Biller unreachable, duplicate payment" rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refunding}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={refunding} onClick={handleRefund}>
              {refunding ? "Refunding…" : "Refund & Notify"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
