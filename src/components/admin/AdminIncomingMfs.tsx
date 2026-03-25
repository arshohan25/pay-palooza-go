import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Link2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface MfsPayment {
  id: string;
  provider: string;
  txn_id: string;
  sender_number: string | null;
  amount: number;
  status: string;
  matched_request_id: string | null;
  created_at: string;
}

export default function AdminIncomingMfs() {
  const [payments, setPayments] = useState<MfsPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linkTarget, setLinkTarget] = useState<MfsPayment | null>(null);
  const [requestIdInput, setRequestIdInput] = useState("");
  const [linking, setLinking] = useState(false);

  const fetchPayments = useCallback(async () => {
    const { data } = await supabase
      .from("mfs_incoming_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setPayments((data as MfsPayment[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPayments();
    const ch = supabase
      .channel("admin-mfs-incoming")
      .on("postgres_changes", { event: "*", schema: "public", table: "mfs_incoming_payments" }, () => fetchPayments())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPayments]);

  const filtered = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.txn_id.toLowerCase().includes(q) ||
      p.provider.toLowerCase().includes(q) ||
      p.sender_number?.includes(q) ||
      false;
  });

  const handleLink = async () => {
    if (!linkTarget || !requestIdInput.trim()) return;
    setLinking(true);
    try {
      // Approve the fund request
      const { error: approveErr } = await supabase.rpc("admin_approve_fund_request", {
        p_request_id: requestIdInput.trim(),
        p_admin_note: `Manually linked to MFS payment ${linkTarget.provider}:${linkTarget.txn_id}`,
      });
      if (approveErr) throw approveErr;

      // Update MFS payment status
      const { error: updateErr } = await supabase
        .from("mfs_incoming_payments")
        .update({ status: "manual", matched_request_id: requestIdInput.trim() })
        .eq("id", linkTarget.id);
      if (updateErr) throw updateErr;

      toast.success("Payment linked and request approved");
      setLinkTarget(null);
      setRequestIdInput("");
    } catch (e: any) {
      toast.error(e.message || "Failed to link payment");
    } finally {
      setLinking(false);
    }
  };

  const unmatchedCount = payments.filter(p => p.status === "unmatched").length;

  if (loading) return <div className="text-sm text-muted-foreground text-center py-8">Loading incoming MFS payments…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          Incoming MFS Payments
          {unmatchedCount > 0 && <Badge variant="destructive" className="text-[10px]">{unmatchedCount} unmatched</Badge>}
        </h3>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by TxnID, provider…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No incoming MFS payments yet.</p>}
        {filtered.map(p => {
          const isMatched = p.status === "matched" || p.status === "manual";
          return (
            <Card key={p.id} className="border shadow-sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{p.provider}</Badge>
                    <span className="text-xs font-mono text-foreground">{p.txn_id}</span>
                  </div>
                  <Badge className={`text-[10px] ${isMatched
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                    {isMatched ? <><CheckCircle2 size={10} className="mr-1" />Matched</> : <><Clock size={10} className="mr-1" />Unmatched</>}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-foreground">৳{p.amount.toLocaleString()}</span></div>
                  {p.sender_number && <div><span className="text-muted-foreground">Sender:</span> <span className="text-foreground">{p.sender_number}</span></div>}
                  <div className="col-span-2"><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{new Date(p.created_at).toLocaleString()}</span></div>
                </div>
                {!isMatched && (
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => { setLinkTarget(p); setRequestIdInput(""); }}>
                    <Link2 size={12} /> Link to Request
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Link Dialog */}
      <AlertDialog open={!!linkTarget} onOpenChange={() => setLinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link MFS Payment to Fund Request</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the Fund Request ID to link this {linkTarget?.provider} payment of ৳{linkTarget?.amount.toLocaleString()} (TxnID: {linkTarget?.txn_id}) and auto-approve it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Fund Request UUID…" value={requestIdInput} onChange={e => setRequestIdInput(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={linking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLink} disabled={linking || !requestIdInput.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {linking ? "Linking…" : "Link & Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
