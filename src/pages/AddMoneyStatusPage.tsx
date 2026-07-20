import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
        toast.error(`${t("amsVerifyFailed")} — ৳${res.paid} / ৳${res.expected}`);
      } else if (res?.credited) toast.success(t("amsCredited"));
      else if (res?.status && res.status !== "COMPLETED") toast.info(`${t("amsPaymentStatus")}: ${res.status}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || t("amsVerifyFailed"));
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
      <p className="text-sm text-muted-foreground">{t("amsNoRequest")}</p>
      <Button asChild variant="outline"><Link to="/"><ArrowLeft size={14} className="mr-1" /> {t("amsHome")}</Link></Button>
    </div>
  );

  const isApproved = row.status === "approved";
  const isRejected = row.status === "rejected";
  const Icon = isApproved ? CheckCircle2 : isRejected ? XCircle : Clock;
  const color = isApproved ? "text-emerald-500" : isRejected ? "text-red-500" : "text-amber-500";
  const label = isApproved ? t("amsCredited") : isRejected ? t("amsRejected") : t("amsPending");

  return (
    <div className="max-w-md mx-auto p-4 space-y-4" data-testid="addmoney-status-page">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/"><ArrowLeft size={18} /></Link></Button>
        <h1 className="text-lg font-bold">{t("amsTitle")}</h1>
      </div>

      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <Icon size={56} className={`mx-auto ${color}`} data-testid="status-icon" />
          <p className="text-xl font-bold" data-testid="status-label">{label}</p>
          <p className="text-3xl font-bold">৳{Number(row.amount).toLocaleString()}</p>
          {isApproved && row.reviewed_at && (
            <p className="text-xs text-muted-foreground" data-testid="approved-at">
              {t("amsApprovedAt")} {new Date(row.reviewed_at).toLocaleString()}
            </p>
          )}
          {row.admin_note && <p className="text-xs text-muted-foreground italic">{row.admin_note}</p>}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1 px-2">
        <div className="flex justify-between items-center gap-2">
          <span>{t("amsGatewayTrxId")}</span>
          {(() => {
            const trx = gatewayTrxId || row.transaction_id_proof;
            return trx ? (
              <Link
                to={`/admin?gateway_txn=${encodeURIComponent(trx)}#fund_requests`}
                className="font-mono text-primary hover:underline truncate max-w-[60%] text-right"
                data-testid="gateway-trx-id"
                title="Open in admin fund requests"
              >
                {trx}
              </Link>
            ) : <span className="font-mono" data-testid="gateway-trx-id">—</span>;
          })()}
        </div>
        <div className="flex justify-between"><span>{t("amsMethod")}</span><span>{row.source_method || "—"}</span></div>
        <div className="flex justify-between"><span>{t("amsCreated")}</span><span>{new Date(row.created_at).toLocaleString()}</span></div>
      </div>

      {mismatch && (
        <div className="text-xs p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900" data-testid="mismatch-banner">
          Amount mismatch: paid ৳{mismatch.paid.toLocaleString()} but expected ৳{mismatch.expected.toLocaleString()}. Balance was not credited.
        </div>
      )}

      {!isApproved && !isRejected && (
        <Button className="w-full" onClick={verify} disabled={verifying} data-testid="verify-btn">
          {verifying ? <Loader2 size={16} className="animate-spin mr-1" /> : <RefreshCw size={16} className="mr-1" />}
          {verifying ? t("amsVerifyingUp") : t("amsVerifyBtn")}
        </Button>
      )}
      <Button asChild variant="outline" className="w-full"><Link to="/">{t("amsBackHome")}</Link></Button>
    </div>
  );
}
