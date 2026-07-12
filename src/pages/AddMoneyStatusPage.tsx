import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface FundRow {
  id: string;
  status: string;
  amount: number;
  reviewed_at: string | null;
  transaction_id_proof: string | null;
  admin_note: string | null;
  source_method: string | null;
  created_at: string;
}

export default function AddMoneyStatusPage() {
  const [params] = useSearchParams();
  const requestId = params.get("request_id");
  const [row, setRow] = useState<FundRow | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  const [gatewayTrxId, setGatewayTrxId] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<{ paid: number; expected: number } | null>(null);

  const load = useCallback(async () => {
    if (!requestId) { setLoading(false); return; }
    const { data } = await supabase
      .from("fund_requests")
      .select("id,status,amount,reviewed_at,transaction_id_proof,admin_note,source_method,created_at")
      .eq("id", requestId)
      .maybeSingle();
    setRow((data as FundRow) ?? null);
    setLoading(false);
  }, [requestId]);

  const verify = useCallback(async () => {
    if (!requestId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("uddoktapay-confirm-addmoney", {
        body: { request_id: requestId },
      });
      if (error) throw error;
      const res = data as { credited?: boolean; status?: string; gateway_trx_id?: string | null; error?: string; paid?: number; expected?: number };
      if (res?.gateway_trx_id) setGatewayTrxId(res.gateway_trx_id);
      if (res?.error === "amount_mismatch") {
        setMismatch({ paid: Number(res.paid), expected: Number(res.expected) });
        toast.error(`Amount mismatch — paid ৳${res.paid}, expected ৳${res.expected}`);
      } else if (res?.credited) toast.success("Balance credited");
      else if (res?.status && res.status !== "COMPLETED") toast.info(`Payment status: ${res.status}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  }, [requestId, load]);

  useEffect(() => { load(); }, [load]);

  // Auto-verify once when we land here with a pending request
  useEffect(() => {
    if (row && row.status === "pending" && row.source_method === "uddoktapay" && !verifying) {
      verify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  // Realtime status updates
  useEffect(() => {
    if (!requestId) return;
    const ch = supabase
      .channel(`fr-${requestId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fund_requests", filter: `id=eq.${requestId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [requestId, load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  if (!requestId || !row) return (
    <div className="p-6 text-center space-y-3">
      <p className="text-sm text-muted-foreground">No add-money request found.</p>
      <Button asChild variant="outline"><Link to="/"><ArrowLeft size={14} className="mr-1" /> Home</Link></Button>
    </div>
  );

  const isApproved = row.status === "approved";
  const isRejected = row.status === "rejected";
  const Icon = isApproved ? CheckCircle2 : isRejected ? XCircle : Clock;
  const color = isApproved ? "text-emerald-500" : isRejected ? "text-red-500" : "text-amber-500";
  const label = isApproved ? "Balance credited" : isRejected ? "Rejected" : "Pending verification";

  return (
    <div className="max-w-md mx-auto p-4 space-y-4" data-testid="addmoney-status-page">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/"><ArrowLeft size={18} /></Link></Button>
        <h1 className="text-lg font-bold">Add Money Status</h1>
      </div>

      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <Icon size={56} className={`mx-auto ${color}`} data-testid="status-icon" />
          <p className="text-xl font-bold" data-testid="status-label">{label}</p>
          <p className="text-3xl font-bold">৳{Number(row.amount).toLocaleString()}</p>
          {isApproved && row.reviewed_at && (
            <p className="text-xs text-muted-foreground" data-testid="approved-at">
              Approved at {new Date(row.reviewed_at).toLocaleString()}
            </p>
          )}
          {row.admin_note && <p className="text-xs text-muted-foreground italic">{row.admin_note}</p>}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1 px-2">
        <div className="flex justify-between"><span>Invoice</span><span className="font-mono">{row.transaction_id_proof || "—"}</span></div>
        <div className="flex justify-between"><span>Method</span><span>{row.source_method || "—"}</span></div>
        <div className="flex justify-between"><span>Created</span><span>{new Date(row.created_at).toLocaleString()}</span></div>
      </div>

      {!isApproved && !isRejected && (
        <Button className="w-full" onClick={verify} disabled={verifying} data-testid="verify-btn">
          {verifying ? <Loader2 size={16} className="animate-spin mr-1" /> : <RefreshCw size={16} className="mr-1" />}
          {verifying ? "Verifying with UddoktaPay…" : "Verify payment now"}
        </Button>
      )}
      <Button asChild variant="outline" className="w-full"><Link to="/">Back to home</Link></Button>
    </div>
  );
}
